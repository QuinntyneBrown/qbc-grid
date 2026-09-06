import { defineConfig, devices } from '@playwright/test';

const PORT = 4381;

/**
 * The acceptance suite drives `src/e2e-app` under the `e2e` build configuration, which
 * binds the deterministic layout store in place of browser storage.
 */
export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? 'blob' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'acceptance',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } },
      testIgnore: /.*\.bench\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npx ng serve e2e-app --configuration e2e --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
