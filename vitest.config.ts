import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    testTimeout: 10_000,
    setupFiles: ['dotenv/config'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
    },
    projects: [
      {
        test: {
          name: 'client',
          include: ['client/src/**/*.test.ts'],
          environment: 'happy-dom',
        },
      },
      {
        test: {
          name: 'server',
          include: ['server/src/**/*.test.ts'],
          environment: 'node',
          fileParallelism: false,
          testTimeout: 15_000,
          env: { NODE_ENV: 'test' },
        },
      },
    ],
  },
});
