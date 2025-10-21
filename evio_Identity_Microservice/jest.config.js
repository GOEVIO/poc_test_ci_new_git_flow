/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest/presets/js-with-ts',
    testEnvironment: 'node',
    testPathIgnorePatterns: ["/node_modules/", "/build/"], // Ignore compiled files
};
