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
