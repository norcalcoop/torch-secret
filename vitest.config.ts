import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['client/src/**/*.test.ts', 'server/src/**/*.test.ts'],
    testTimeout: 10_000,
    setupFiles: ['dotenv/config'],
  },
});
