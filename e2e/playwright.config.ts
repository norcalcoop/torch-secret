import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    bypassCSP: true,
  },

  webServer: {
    // In CI, secrets are already injected by the Infisical GitHub Action, so we
    // run the server directly with tsx. Locally we use dev:server (infisical run).
    command: process.env.CI
      ? 'npm run build:client && tsx ../server/src/server.ts'
      : 'npm run build:client && npm run dev:server',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { NODE_ENV: 'test', FORCE_HTTPS: 'false', E2E_TEST: 'true' },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
