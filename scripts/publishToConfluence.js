// scripts/publish-to-confluence.js
import axios from "axios";

export default async (pluginConfig, context) => {
  const { nextRelease, logger } = context;
  const { notes } = nextRelease;

  // Confluence Configuration
  const auth = {
    username: process.env.CONFLUENCE_USERNAME,
    password: process.env.CONFLUENCE_API_TOKEN,
  };

  const spaceKey = "CHARGE"; // e.g., "DEV"
  const parentPageId = "7971635928"; // ID of the parent page where notes will be added

  // Create a new Confluence page
  try {
    const response = await axios.post(
      process.env.CONFLUENCE_URL,
      {
        type: "page",
        title: `Release ${nextRelease.version} - ${new Date().toISOString()}`,
        space: { key: spaceKey },
        ancestors: [{ id: parentPageId }],
        body: {
          storage: {
            value: `<p>${notes.replace(/\n/g, "</p><p>")}</p>`, // Convert markdown to HTML
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
