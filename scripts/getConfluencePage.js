const getConfluencePage = async (pageId, url, auth) => {
  try {
    const response = await fetch(
      `${url}/${pageId}?expand=body.storage,version,space,history`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
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
    console.error("Error getting Confluence page:", error.message);
    throw error;
  }
};

export default async (pluginConfig, context) => {
  const { logger } = context;

  // Confluence Configuration
  const auth = {
    username: process.env.CONFLUENCE_USERNAME,
    password: process.env.CONFLUENCE_API_TOKEN,
  };

  const url = process.env.CONFLUENCE_URL;
  const spaceKey = "CHARGE";
  const parentPageId = "7171998357";

  try {
    // Get parent page to verify access
    const parentPage = await getConfluencePage(parentPageId, url, auth);

    logger.log("\n=== Page Content ===");
    if (parentPage.body?.storage?.value) {
      logger.dir(parentPage.body.storage.value);
    } else {
      logger.log("No content found");
    }
  } catch (error) {
    logger.error("Failed to get Confluence page:", error.message);
    if (error.response) {
      logger.error("Response data:", error.response.data);
      logger.error("Status:", error.response.status);
    }
    process.exit(1);
  }
};
