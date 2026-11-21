/**
 * End-to-end tests: phone-sized browsers (Chromium, Pixel 7 emulation) playing the real
 * app page against the real server run by `wrangler dev` (Worker, Durable Objects and
 * static files, all local), with the native photo plugin replaced by a fake library
 * (test/e2e/fake-phone.js). ./scripts/test.sh starts each run with empty local storage.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 8799;

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
  use: { ...devices['Pixel 7'], baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  webServer: {
    command: `npx wrangler dev --port ${PORT} --persist-to .wrangler/e2e`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
