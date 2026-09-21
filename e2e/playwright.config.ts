import { defineConfig, devices } from '@playwright/test';

const HOST = '127.0.0.1';
const PORT = 5173;
const BASE_URL = `http://${HOST}:${PORT}`;
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const WEB_SERVER_TIMEOUT_MS = 60_000;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    viewport: MOBILE_VIEWPORT,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: MOBILE_VIEWPORT } }],
  webServer: {
    command: `npm run dev -w web -- --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
    cwd: '..',
    env: { VITE_MOCK: '1' },
    reuseExistingServer: !process.env.CI,
    timeout: WEB_SERVER_TIMEOUT_MS,
  },
});
