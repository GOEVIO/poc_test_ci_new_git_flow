module.exports = {
    extends: ['prettier', 'airbnb-base'],
    rules: {
        'no-console': 'off',
        'comma-dangle': 'off',
        'no-shadow': 'warn',
        semi: 'error',
        indent: ['error', 4, { SwitchCase: 1 }],
        'import/extensions': [
            'error',
            'ignorePackages',
            {
                js: 'never',
                ts: 'never',
            },
        ],
    },
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script',
        tsconfigRootDir: __dirname,
    },
    env: {
        browser: false,
        es6: true,
    },
    ignorePatterns: ['node_modules/**', 'build/**'],
    overrides: [
        {
            files: ['**/*.ts', '**/*.tsx'],
            plugins: ['@typescript-eslint'],
            extends: [
                'eslint:recommended',
                'plugin:@typescript-eslint/recommended',
            ],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: ['./tsconfig.json'],
            },
        },
    ],
    settings: {
        'import/resolver': {
            node: {
                extensions: ['.js', '.ts'],
            },
        },
    },
};
