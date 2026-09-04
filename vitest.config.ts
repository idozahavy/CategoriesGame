import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts', 'functions/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        'src/vite-env.d.ts',
        'src/main.ts',
        // Language packs and bundled word lists are data, not logic.
        'src/lib/i18n/{ar,en,es,fr,he,ru}.ts',
        'src/lib/words/*.json',
      ],
      reporter: ['text', 'json', 'json-summary'],
    },
  },
});
