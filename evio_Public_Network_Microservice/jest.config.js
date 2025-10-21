/** @type {import('jest').Config} */
const config = {
  clearMocks: true,
  coverageProvider: "v8",
  injectGlobals: false,
  restoreMocks: true,
  testMatch: [
    "**/?(*.)+(spec|test).[jt]s?(x)",
    "**/test/**/*.js",
  ],
};

module.exports = config;