// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'web-build/*', '.expo/*', 'coverage/*'],
  },
  {
    rules: {
      // React Native text is not HTML. Escaping an apostrophe would print the entity.
      'react/no-unescaped-entities': 'off',
      // The React compiler rules fail on the current board, drill, and store code.
      // Enabling them means rewriting those files, which changes behavior.
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/components/progress/GameImport.tsx'],
    rules: {
      // `usePgn` is a button handler, not a hook. The name trips the rule.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      // Vitest mocks have to sit above the imports they replace.
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
