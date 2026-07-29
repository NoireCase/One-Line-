import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const e2ePort = 5210;
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'production-smoke.spec.js',

  timeout: 30 * 1000,
  expect: {
    timeout: 10 * 1000,
  },

  retries: process.env.CI ? 1 : 0,
  workers: 2,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    baseURL: e2eBaseUrl,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      VITE_E2E_DEV_CANDIDATES: '1',
      VITE_E2E_PROOF_BRIDGE: '1',
    },
  },
});
