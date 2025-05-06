import publishToConfluence from "./publishToConfluence.js";

// Mock context object that semantic-release would provide
const mockContext = {
  nextRelease: {
    version: "1.0.0",
    notes: `## [2.3.3](https://github.com/aarbanas/semantic-release-test/compare/v2.3.2...v2.3.3) (2025-04-28)


### Bug Fixes

* separation between versions mapping CHAR-1234 ([81db274](https://github.com/aarbanas/semantic-release-test/commit/81db274d3289bf416727754f81b32dd08fbea1ee))`,
  },
  logger: {
    log: console.log,
    error: console.error,
  },
};

// Mock plugin config
const mockPluginConfig = {};

// Run the test
console.log("Starting Confluence integration test...");
publishToConfluence(mockPluginConfig, mockContext)
  .then(() => console.log("Test completed successfully"))
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
