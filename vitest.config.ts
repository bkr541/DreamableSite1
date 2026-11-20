import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Several suites start an in-process Postgres and apply every migration. That takes a few seconds on its own and a lot
    // more when the whole suite runs in parallel, so the defaults (5s / 10s) made them fail at random.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
