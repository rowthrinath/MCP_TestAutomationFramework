import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file from project root (one level up)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Parse HEADLESS env var: 'false' means visible (headless=false), anything else or not set means headless
const isHeadless = process.env.HEADLESS?.toLowerCase() !== 'false';

/**
 * @see https://playwright.dev/docs/test-configuration
 * This config is for running Playwright tests from within the tests-playwright folder
 */
export default defineConfig({
  testDir: './',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI || process.env.FORBID_ONLY === 'true',
  /* Retry on CI only */
  retries: process.env.CI ? 2 : parseInt(process.env.RETRIES || '0', 10),
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : (process.env.WORKERS === 'undefined' ? undefined : parseInt(process.env.WORKERS || '1', 10)),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { open: 'never', outputFolder: '../playwright-report' }], // Don't auto-open browser
    ['json', { outputFile: '../test-results/results.json' }],
    ['junit', { outputFile: '../test-results/results.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'https://qa-challenge.codesubmit.io',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: process.env.SCREENSHOT_ONLY_ON_FAILURE === 'true' ? 'only-on-failure' : 'on',
    /* Record video on failure */
    video: process.env.VIDEO_RETAIN_ON_FAILURE === 'true' ? 'retain-on-failure' : 'off',
    /* Global timeout for each action */
    actionTimeout: parseInt(process.env.ACTION_TIMEOUT || '30000', 10),
    /* Global timeout for navigation */
    navigationTimeout: parseInt(process.env.NAVIGATION_TIMEOUT || '30000', 10),
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        headless: isHeadless,
      },
    },

    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        headless: isHeadless,
      },
    },

    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        headless: isHeadless,
      },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        headless: isHeadless,
      },
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        headless: isHeadless,
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

