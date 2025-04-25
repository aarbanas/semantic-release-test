import getConfluencePage from "./getConfluencePage.js";
import publishToConfluence from "./publishToConfluence.js";

// Mock plugin config
const mockPluginConfig = {};

// Run the test
console.log("Starting Confluence integration test...");
getConfluencePage(mockPluginConfig, {
  logger: {
    log: console.log,
    error: console.error,
    dir: console.dir,
  },
})
  .then(() => console.log("Test completed successfully"))
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
