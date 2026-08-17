const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'src/graphql/generated/*'],
  },
  {
    files: ['jest.setup.js', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      globals: { jest: 'readonly' },
    },
  },
]);
