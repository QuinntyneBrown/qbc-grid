import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'record-demo.spec.ts',
  outputDir: '../../tmp/demo/capture',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4382', viewport: { width: 1600, height: 900 } },
  webServer: {
    command: 'npm run tokens && npx ng serve e2e-app --port 4382',
    url: 'http://localhost:4382',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
