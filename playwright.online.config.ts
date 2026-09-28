import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);

export default defineConfig({
  testDir: './e2e',
  testMatch: 'online-multiplayer.spec.ts',
  timeout: 210_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  outputDir: 'test-results/online',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: `npm run preview -- --host 127.0.0.1 --port ${port}`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'bash tools/start-online-e2e-worker.sh',
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
