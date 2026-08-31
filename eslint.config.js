import js from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
  { ignores: ['dist/', 'node_modules/', 'design/'] },
  js.configs.recommended,
  ...ts.configs.strict,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
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
