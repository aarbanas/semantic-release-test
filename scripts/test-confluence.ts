#!/usr/bin/env npx ts-node

import * as fs from 'fs';
import moment from 'moment-timezone';

interface Auth {
  username: string;
  password: string;
}

interface ConfluencePage {
  id: string;
  title: string;
  version: {
    number: number;
  };
  body: {
    storage: {
      value: string;
    };
  };
  _links: {
    webui: string;
  };
}

interface ConfluenceChildPagesResponse {
  results: ConfluencePage[];
}

const convertMarkdownToConfluence = (markdown: string): string => {
  let confluenceMarkdown = markdown;

  confluenceMarkdown = confluenceMarkdown
      .replace(/^# (.*?)$/gm, '<h1>$1</h1><hr />')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2><hr />')
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>');

  // Convert lists
  confluenceMarkdown = confluenceMarkdown
      .replace(/^\s*[-*] (.*?)$/gm, '<li>$1</li>')
      .replace(/^\s*\d+\. (.*?)$/gm, '<li>$1</li>')
      .replace(/^\s*[a-z]\. (.*?)$/gm, '<li>$1</li>')
      .replace(/(<li>.*?<\/li>\n?)+/gs, (match) => {
        const originalLines = match.split('\n');
        const firstLine = originalLines[0];
        if (firstLine.match(/^\s*\d+\./)) {
          return `<ol>${match}</ol>`;
        } else if (firstLine.match(/^\s*[a-z]\./)) {
          return `<ol type="a">${match}</ol>`;
        } else {
          return `<ul>${match}</ul>`;
        }
      });

  // Convert code blocks
  confluenceMarkdown = confluenceMarkdown.replace(
      /```(\w*)\n([\s\S]*?)\n```/g,
      '<ac:structured-macro ac:name="code" ac:schema-version="1"><ac:parameter ac:name="language">$1</ac:parameter><ac:plain-text-body><![CDATA[$2]]></ac:plain-text-body></ac:structured-macro>',
  );

  // Convert inline code
  confluenceMarkdown = confluenceMarkdown.replace(
      /`([^`]+)`/g,
      '<code>$1</code>',
  );

  // Convert GitHub PR/Issue URLs to cleaner links (must be before general link conversion)
  // "in https://github.com/owner/repo/pull/1809" -> "[#1809](https://github.com/owner/repo/pull/1809)"
  confluenceMarkdown = confluenceMarkdown.replace(
      /in (https:\/\/github\.com\/[\w-]+\/[\w-]+\/pull\/(\d+))/g,
      '[#$2]($1)',
  );

  // Convert links
  confluenceMarkdown = confluenceMarkdown.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2">$1</a>',
  );

  // Convert bold and italic
  confluenceMarkdown = confluenceMarkdown
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Remove user mentions
  confluenceMarkdown = confluenceMarkdown.replace(/by @([\w-]+)/g, '');

  // Clean up any remaining newlines
  confluenceMarkdown = confluenceMarkdown.replace(/\n{3,}/g, '\n\n').trim();
  return confluenceMarkdown;
};

const getCurrentYearAndWeek = (): { year: number; currentWeek: number } => {
  const now = new Date();
  const year = now.getFullYear();
  const currentWeek = Math.ceil(
      (now.getTime() - new Date(year, 0, 1).getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  );
  return { year, currentWeek };
};

const getChildPages = async (
    url: string,
    parentId: string,
    auth: Auth,
): Promise<ConfluenceChildPagesResponse> => {
  const response = await fetch(
      `${url}/${parentId}/child/page?expand=version,body.storage`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`,
        },
      },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

const getYearPage = async (
    url: string,
    parentId: string,
    year: number,
    auth: Auth,
): Promise<ConfluencePage> => {
  const { results: yearPages } = await getChildPages(url, parentId, auth);
  const yearPage = yearPages.find((page) => page.title === year.toString());

  if (!yearPage) {
    throw new Error(`No page found for year ${year}`);
  }

  return yearPage;
};

const getPIPages = async (
    url: string,
    yearPageId: string,
    auth: Auth,
): Promise<ConfluencePage[]> => {
  const { results: piPages } = await getChildPages(url, yearPageId, auth);
  return piPages.filter((page) => page.title.startsWith('PI-'));
};

const getAllPIPages = async (
    url: string,
    parentPageId: string,
    year: number,
    auth: Auth,
): Promise<ConfluencePage[]> => {
  const allPiPages: ConfluencePage[] = [];
  const yearsToCheck = [year - 1, year];

  for (const targetYear of yearsToCheck) {
    try {
      const yearPage = await getYearPage(url, parentPageId, targetYear, auth);
      console.log(`Found year page: ${yearPage.title}`);
      const piPages = await getPIPages(url, yearPage.id, auth);
      allPiPages.push(...piPages);
      console.log(`Found ${piPages.length} PI pages for year ${targetYear}`);
    } catch {
      console.log(`No year page found for ${targetYear}, skipping...`);
    }
  }

  console.log(`Total PI pages across years: ${allPiPages.length}`);
  return allPiPages;
};

const findPIForCurrentWeek = (
        pages: ConfluencePage[],
    year: number,
    currentWeek: number,
    ): ConfluencePage | null => {
  const sortedPages = [...pages].sort((a, b) => {
    const [, aYearWeek] = a.title.split('-');
    const [aYear, aWeek] = aYearWeek.split('.');
    const [, bYearWeek] = b.title.split('-');
    const [bYear, bWeek] = bYearWeek.split('.');

    if (parseInt(aYear) !== parseInt(bYear)) {
      return parseInt(aYear) - parseInt(bYear);
    }
    return parseInt(aWeek) - parseInt(bWeek);
  });

  for (let i = sortedPages.length - 1; i >= 0; i--) {
    const page = sortedPages[i];
    const [, yearWeek] = page.title.split('-');
    const [pageYear, pageWeek] = yearWeek.split('.');

    const pageYearNum = parseInt(pageYear);
    const pageWeekNum = parseInt(pageWeek);

    if (
        pageYearNum < year ||
        (pageYearNum === year && pageWeekNum <= currentWeek)
    ) {
      if (i < sortedPages.length - 1) {
        const nextPage = sortedPages[i + 1];
        const [, nextYearWeek] = nextPage.title.split('-');
        const [nextPageYear, nextPageWeek] = nextYearWeek.split('.');

        const nextYearNum = parseInt(nextPageYear);
        const nextWeekNum = parseInt(nextPageWeek);

        if (
            year < nextYearNum ||
            (year === nextYearNum && currentWeek < nextWeekNum)
        ) {
          return page;
        }
      } else {
        return page;
      }
    }
  }

  return null;
};

const updateConfluencePage = async (
    url: string,
    pageId: string,
    content: string,
    auth: Auth,
    title: string,
    version: number,
    existingContent: string,
): Promise<ConfluencePage> => {
  const combinedContent = `${existingContent}${content}`;

  const response = await fetch(`${url}/${pageId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      version: { number: version + 1 },
      type: 'page',
      title,
      body: {
        storage: {
          value: combinedContent,
          representation: 'storage',
        },
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
        `HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`,
    );
  }

  return response.json();
};

const formatGitHubReleaseNotes = (
        releaseTag: string,
    releaseBody: string,
    releaseUrl: string,
    ): string => {
  const header = `# [${releaseTag}](${releaseUrl}) (${moment().utc().format('YYYY-MM-DD')})\n\n`;
  return header + releaseBody;
};

const main = async (): Promise<void> => {
  const releaseBody = process.env.RELEASE_BODY;
  const releaseTag = process.env.RELEASE_TAG || 'Unknown';
  const releaseUrl = process.env.RELEASE_URL || '';

  if (!releaseBody) {
    console.error('Error: RELEASE_BODY environment variable is required');
    process.exit(1);
  }

  const username = process.env.CONFLUENCE_USERNAME;
  const password = process.env.CONFLUENCE_API_TOKEN;

  if (!username || !password) {
    console.error(
        'Error: CONFLUENCE_USERNAME and CONFLUENCE_API_TOKEN environment variables are required',
    );
    process.exit(1);
  }

  const auth: Auth = { username, password };

  const url = process.env.CONFLUENCE_URL;
  const parentPageId = process.env.CONFLUENCE_PARENT_PAGE_ID;

  if (!url || !parentPageId) {
    console.error(
        'Error: CONFLUENCE_URL and CONFLUENCE_PARENT_PAGE_ID environment variables are required',
    );
    process.exit(1);
  }

  try {
    const { year, currentWeek } = getCurrentYearAndWeek();
    console.log(`Current year: ${year}, week: ${currentWeek}`);

    const allPiPages = await getAllPIPages(url, parentPageId, year, auth);

    const targetPage = findPIForCurrentWeek(allPiPages, year, currentWeek);
    if (!targetPage) {
      throw new Error(
          `No PI page found for current week ${currentWeek} in year ${year}`,
      );
    }

    console.log(`Target PI page: ${targetPage.title}`);

    const formattedNotes = formatGitHubReleaseNotes(
        releaseTag,
        releaseBody,
        releaseUrl,
    );
    const confluenceContent = convertMarkdownToConfluence(formattedNotes);

    const updatedPage = await updateConfluencePage(
        url,
        targetPage.id,
        confluenceContent,
        auth,
        targetPage.title,
        targetPage.version.number,
        targetPage.body.storage.value,
    );

    const confluenceBaseUrl = url.replace('/rest/api/content', '');
    const fullPageUrl = `${confluenceBaseUrl}${updatedPage._links.webui}#${releaseTag}-(${moment().utc().format('YYYY-MM-DD')})`;

    console.log(`Successfully updated PI page: ${fullPageUrl}`);

    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(
          process.env.GITHUB_OUTPUT,
          `confluence-url=${fullPageUrl}\n`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to push release notes to Confluence:', errorMessage);
    console.error(error);
    process.exit(1);
  }
};

main();
