import publishToConfluence from "./publishToConfluence.js";

// Mock context object that semantic-release would provide
const mockContext = {
  nextRelease: {
    version: "1.0.0",
    notes: `# Release Notes

## New Features
- Added new feature A
- Implemented feature B

## Bug Fixes
- Fixed issue with X
- Resolved problem with Y`,
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
