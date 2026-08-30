import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
  { ignores: ['dist/', 'node_modules/', 'design/'] },
  js.configs.recommended,
  ...ts.configs.strict,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: { globals: { ...globals.browser } },
  },
  // Svelte components parse <script lang="ts"> with the TS parser inside the svelte parser.
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: { parser: ts.parser, extraFileExtensions: ['.svelte'] },
    },
  },
  // Type-checked strict rules for plain TS modules.
  {
    files: ['src/**/*.ts'],
    extends: [...ts.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
    },
  },
  // Node config scripts.
  {
    files: ['*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
);
