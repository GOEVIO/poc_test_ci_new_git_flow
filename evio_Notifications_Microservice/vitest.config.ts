import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true, // Enable global test functions like `describe` and `it`
        environment: 'node', // Use the Node.js environment for tests
        exclude: [
        'node_modules',
        '.serverless',
        '.webpack',
        '_warmup',
        '.vscode', // Exclude directories not relevant for tests
        ],
    },
});