import { defineConfig, devices } from '@playwright/test'

const frontendURL = process.env.MULTIPLAYER_E2E_FRONTEND_URL || 'http://127.0.0.1:4185'
const backendURL = process.env.MULTIPLAYER_E2E_BACKEND_URL || 'http://127.0.0.1:3185'
const mongodbUri = process.env.MULTIPLAYER_E2E_MONGODB_URI || 'mongodb://127.0.0.1:27017/games_arena_multiplayer_e2e'
const redisUrl = process.env.MULTIPLAYER_E2E_REDIS_URL || 'redis://127.0.0.1:6379/14'

assertIsolatedMongoDatabase(mongodbUri)
assertIsolatedRedisDatabase(redisUrl)

export default defineConfig({
  testDir: './tests/multiplayer-e2e',
  outputDir: './node_modules/.cache/multiplayer-playwright-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  // Account creation is deliberately subject to the production-shaped signup
  // rate limit. Retrying a serial worker would test polluted limiter state.
  retries: 0,
  workers: 1,
  timeout: 120_000,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: './node_modules/.cache/multiplayer-playwright-report', open: 'never' }]]
    : 'list',
  expect: {
    timeout: 12_000,
  },
  use: {
    baseURL: frontendURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  webServer: [
    {
      command: 'npm --prefix ../backend run start',
      url: `${backendURL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: new URL(backendURL).port || '3185',
        MONGODB_URI: mongodbUri,
        REDIS_URL: redisUrl,
        JWT_SECRET: process.env.MULTIPLAYER_E2E_JWT_SECRET || 'isolated-multiplayer-e2e-secret-2026',
        CORS_ORIGIN: frontendURL,
        LOG_LEVEL: process.env.LOG_LEVEL || 'warn',
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${new URL(frontendURL).port || '4185'} --strictPort`,
      url: frontendURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_URL: backendURL,
        VITE_SOCKET_URL: backendURL,
      },
    },
  ],
  projects: [
    {
      name: 'multiplayer-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
})

function assertIsolatedMongoDatabase(uri: string): void {
  const database = new URL(uri).pathname.replace(/^\//, '').split('?', 1)[0]
  if (!database || !/e2e/i.test(database)) {
    throw new Error('MULTIPLAYER_E2E_MONGODB_URI must name a dedicated database containing "e2e"')
  }
}

function assertIsolatedRedisDatabase(uri: string): void {
  const database = new URL(uri).pathname.replace(/^\//, '')
  if (!database || database === '0' || !/^\d+$/.test(database)) {
    throw new Error('MULTIPLAYER_E2E_REDIS_URL must select a dedicated non-zero Redis database')
  }
}
