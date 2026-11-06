import { defineConfig, devices } from '@playwright/test';

// E2E test config for the TSM Lab Astro site. The webServer builds the static
// output and serves it via `astro preview` on :4321 (Astro's default preview port).
// `reuseExistingServer` lets a manually-started preview be reused during local dev.
const BASE_URL = 'http://localhost:4321';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: {
    // Playwright owns the process; disable Astro's automatic agent-background mode.
    command: 'npm run build && npm run preview -- --ignore-lock',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Mobile viewport (Pixel 5, 393px) — drives the <details> hamburger nav tests.
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
