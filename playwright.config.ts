import { defineConfig, devices } from '@playwright/test';

// Runs against `astro preview` (the real static output, same URL rules as Vercel: build.format 'file', no trailing slash).
// Overrides for local runs against another build dir / port:
//   E2E_BASE_URL=http://localhost:4325 E2E_SERVER_CMD='npx astro preview --config /tmp/preview.config.mjs --port 4325' npx playwright test
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4321';
const command = process.env.E2E_SERVER_CMD ?? 'npx astro preview --port 4321';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
