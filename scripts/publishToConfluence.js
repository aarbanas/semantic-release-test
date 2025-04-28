// Simple markdown to Confluence converter
const convertMarkdownToConfluence = (markdown) => {
  let confluenceMarkdown = markdown;

  // Convert headers to HTML format
  confluenceMarkdown = confluenceMarkdown
    .replace(/^# (.*?)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*?)$/gm, "<h3>$1</h3>");

  // Convert lists
  confluenceMarkdown = confluenceMarkdown
    .replace(/^\s*[-*] (.*?)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/^\s*\d+\. (.*?)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ol>$1</ol>");

  // Convert code blocks
  confluenceMarkdown = confluenceMarkdown.replace(
    /```(\w*)\n([\s\S]*?)\n```/g,
    '<ac:structured-macro ac:name="code" ac:schema-version="1"><ac:parameter ac:name="language">$1</ac:parameter><ac:plain-text-body><![CDATA[$2]]></ac:plain-text-body></ac:structured-macro>'
  );

  // Convert inline code
  confluenceMarkdown = confluenceMarkdown.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  // Convert links
  confluenceMarkdown = confluenceMarkdown.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>'
  );

  // Convert bold and italic
  confluenceMarkdown = confluenceMarkdown
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Convert paragraphs and ensure proper spacing
  confluenceMarkdown = confluenceMarkdown
    .split("\n\n")
    .map((block) => {
      if (!block.startsWith("<") || !block.endsWith(">")) {
        return `<p>${block}</p>`;
      }
      return block;
    })
    .join("\n");

  // Convert user mentions (if any)
  confluenceMarkdown = confluenceMarkdown.replace(
    /@([\w-]+)/g,
    '<ac:link><ri:user ri:username="$1" /></ac:link>'
  );

  // Clean up any remaining newlines
  confluenceMarkdown = confluenceMarkdown.replace(/\n{3,}/g, "\n\n").trim();

  return confluenceMarkdown;
};

const getCurrentYearAndWeek = () => {
  const now = new Date();
  const year = now.getFullYear();
  const currentWeek = Math.ceil(
    (now - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000)
  );
  return { year, currentWeek };
};

const getChildPages = async (url, parentId, auth) => {
  try {
    const response = await fetch(
      `${url}/${parentId}/child/page?expand=version`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${auth.username}:${auth.password}`
          ).toString("base64")}`,
        },
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error getting child pages:", error.message);
    throw error;
  }
};

const findPIForCurrentWeek = (pages, year, currentWeek) => {
  // Parse each page title to find the matching one
  return pages.find((page, index) => {
    if (!page.title.startsWith("PI-")) return false;

    const [, yearWeek] = page.title.split("-");
    const [pageYear, pageWeek] = yearWeek.split(".");
    if (parseInt(pageYear) < new Date().getFullYear()) {
      return false;
    }

    // If this is the last page, only check if current week is greater than or equal to its week
    if (index === pages.length - 1) {
      return parseInt(pageYear) === year && parseInt(pageWeek) <= currentWeek;
    }

    // For all other pages, check against the next page
    const nextPage = pages[index + 1];
    if (!nextPage || !nextPage.title.startsWith("PI-")) {
      return false;
    }

    const [, nextChildYearWeek] = nextPage.title.split("-");
    const [, nextChildPageWeek] = nextChildYearWeek.split(".");

    return (
      parseInt(pageYear) === year &&
      parseInt(pageWeek) <= currentWeek &&
      parseInt(nextChildPageWeek) > currentWeek
    );
  });
};

const updateConfluencePage = async (pageId, content, auth, title, version) => {
  try {
    const response = await fetch(
      `https://porschedigital.atlassian.net/wiki/rest/api/content/${pageId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            `${auth.username}:${auth.password}`
          ).toString("base64")}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          version: {
            number: version + 1,
          },
          type: "page",
          title: title,
          body: {
            storage: {
              value: content,
              representation: "storage",
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${JSON.stringify(
          errorData
        )}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating Confluence page:", error.message);
    throw error;
  }
};

export default async (pluginConfig, context) => {
  const { nextRelease, logger } = context;
  const { notes } = nextRelease;

  // Confluence Configuration
  const auth = {
    username: process.env.CONFLUENCE_USERNAME,
    password: process.env.CONFLUENCE_API_TOKEN,
  };

  const url = process.env.CONFLUENCE_URL;
  const spaceKey = "CHARGE";
  const parentPageId = "7971635928";

  try {
    // Get current year and week
    const { year, currentWeek } = getCurrentYearAndWeek();

    // Get all child pages under the parent
    const { results: childPages } = await getChildPages(
      url,
      parentPageId,
      auth
    );

    // Find the appropriate PI page for current week
    const targetPage = findPIForCurrentWeek(childPages, year, currentWeek);
    if (!targetPage) {
      throw new Error(
        `No PI page found for current week ${currentWeek} in year ${year}`
      );
    }

    // Convert markdown to Confluence format
    const confluenceContent = convertMarkdownToConfluence(notes);

    console.log(targetPage);
    // Update the found page
    const updatedPage = await updateConfluencePage(
      targetPage.id,
      confluenceContent,
      auth,
      targetPage.title,
      targetPage.version.number
    );
    logger.log(`Successfully updated PI page: ${updatedPage._links.webui}`);
  } catch (error) {
    logger.error("Failed to push release notes to Confluence:", error.message);
    logger.error(error);
    process.exit(1);
  }
};
