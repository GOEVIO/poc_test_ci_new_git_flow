/** @type  {import('ts-jest').JestConfigWithTsJest} */
module.exports  = {
	preset:  "ts-jest",
	testEnvironment:  "node",
	transform: {
		"^.+\\.tsx?$":  "ts-jest", // Forces Jest to use `ts-jest` instead of `babel-jest`
	},
	extensionsToTreatAsEsm: [".ts"], // Ensures Jest treats TypeScript as ES modules
	modulePaths: ["./"],
	moduleDirectories: ["node_modules", "src"],
	moduleNameMapper: {
		'@/(.*)': ['src/$1']
	},
	testPathIgnorePatterns: ["/node_modules/", "/dist/"], // Ignore compiled files
	collectCoverageFrom: [
		"**/*.(t|j)s"
	],
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
	coverageDirectory:  "./coverage",
  setupFilesAfterEnv: ["./tests/mockLocalLibraries.js"],
  injectGlobals: false
};