import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const isCi = process.env.CI === 'true';
const suite = (process.env.PLAYWRIGHT_SUITE ?? 'local').replace(/[^a-z0-9-]/gi, '-');

export default defineConfig({
  testDir: './e2e',
  timeout: 210_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCi ? 1 : 0,
  reporter: isCi
    ? [['line'], ['html', { open: 'never', outputFolder: `playwright-report/${suite}` }]]
    : 'line',
  outputDir: `test-results/${suite}`,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: isCi ? 60_000 : 30_000,
  },
});
