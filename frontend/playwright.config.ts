import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4175'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './node_modules/.cache/playwright-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: './node_modules/.cache/playwright-report', open: 'never' }]]
    : 'list',
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_API_URL: baseURL,
      VITE_SOCKET_URL: baseURL,
    },
  },
  projects: [
    {
      name: 'chromium',
      grepInvert: /@visual/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual',
      grep: /@visual/,
      use: {
        ...devices['Desktop Chrome'],
        hasTouch: true,
      },
    },
  ],
})
