// scripts/publish-to-confluence.js
import axios from "axios";

// Get Confluence page by ID
const getConfluencePage = async (pageId, url, auth) => {
  try {
    const response = await axios.get(`${url}/${pageId}`, {
      auth,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      params: {
        expand: "body.storage,version,space,history",
      },
    });
    return response.data;
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

    // Print page details in a readable format
    // logger.log("\n=== Page Details ===");
    // logger.log(`Title: ${parentPage.title}`);
    // logger.log(`ID: ${parentPage.id}`);
    // logger.log(`Space: ${parentPage.space?.name || parentPage.space?.key}`);
    // logger.log(`Version: ${parentPage.version?.number}`);
    // logger.log(
    //   `Created: ${new Date(parentPage.history?.createdDate).toLocaleString()}`
    // );
    // logger.log(
    //   `Last Updated: ${new Date(
    //     parentPage.history?.lastUpdated?.when
    //   ).toLocaleString()}`
    // );

    logger.log("\n=== Page Content ===");
    logger.dir(parentPage.body, { depth: null });

    // logger.log("\n=== Page Links ===");
    // logger.log(`Web UI: ${parentPage._links?.webui}`);
    // logger.log(`Tiny UI: ${parentPage._links?.tinyui}`);
  } catch (error) {
    logger.error("Failed to get Confluence page:", error.message);
    if (error.response) {
      logger.error("Response data:", error.response.data);
      logger.error("Status:", error.response.status);
    }
    process.exit(1);
  }
};
