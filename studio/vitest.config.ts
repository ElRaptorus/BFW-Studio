import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '#bifrost': path.resolve(__dirname, 'src/bifrost'),
      '#components': path.resolve(__dirname, 'src/components'),
      '#modules': path.resolve(__dirname, 'src/modules'),
    },
  },
  test: {
    globals: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    sequence: { shuffle: true },
    include: ['test/**/*.test.ts'],
    pool: 'forks',
  },
});
