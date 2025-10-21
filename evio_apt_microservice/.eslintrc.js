// TODO: update to >= 9 version
// TODO: use eslint.config.js ES module format
// TODO: Centralize these configs for the whole repo
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint/eslint-plugin', 'prettier'],
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
      ],
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
      rules: {
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'Error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: ['class', 'interface', 'typeAlias', 'enum'],
            format: ['PascalCase'],
          },
          {
            selector: ['function', 'method', 'classMethod'],
            format: ['camelCase'],
            leadingUnderscore: 'allow',
          },
        ],
      },
    },
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
}
