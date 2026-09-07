import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '#bifrost': path.resolve(import.meta.dirname, 'src/bifrost'),
      '#components': path.resolve(import.meta.dirname, 'src/components'),
      '#modules': path.resolve(import.meta.dirname, 'src/modules'),
    },
  },
  test: {
    globals: false,
    testTimeout: 80_000,
    hookTimeout: 80_000,
    // v4 `shuffle: true` randomized files and tests. Spell both out so a future
    // boolean-default change cannot drop one of the two axes.
    sequence: {
      shuffle: {
        files: true,
        tests: true,
      },
    },
    include: ['test/**/*.test.ts'],
    pool: 'forks',
  },
});
