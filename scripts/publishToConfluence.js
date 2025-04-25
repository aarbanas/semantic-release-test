// scripts/publish-to-confluence.js
import axios from "axios";

// Get Confluence page by ID
const getConfluencePage = async (pageId, auth) => {
  try {
    const response = await axios.get(
      `${process.env.CONFLUENCE_URL}/${pageId}`,
      { auth }
    );
    return response.data;
  } catch (error) {
    console.error("Error getting Confluence page:", error.message);
    throw error;
  }
};

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
    // Get parent page to verify access
    const parentPage = await getConfluencePage(parentPageId, auth);
    logger.log(`Successfully accessed parent page: ${parentPage.title}`);

    // Convert markdown to Confluence format
    const confluenceContent = convertMarkdownToConfluence(notes);

    // Create a new Confluence page
    const response = await axios.post(
      url,
      {
        type: "page",
        title: `Release ${nextRelease.version} - ${new Date().toISOString()}`,
        space: { key: spaceKey },
        ancestors: [{ id: parentPageId }],
        body: {
          storage: {
            value: confluenceContent,
            representation: "storage",
          },
        },
      },
      { auth }
    );

    logger.log(
      `Successfully published notes to Confluence: ${response.data._links.webui}`
    );
  } catch (error) {
    logger.error("Failed to push release notes to Confluence:", error.message);
    process.exit(1);
  }
};
