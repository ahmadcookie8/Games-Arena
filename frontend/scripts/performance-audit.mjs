import { chromium } from '@playwright/test'
import { preview } from 'vite'

const host = '127.0.0.1'
const port = 4176
const origin = `http://${host}:${port}`
const server = await preview({
  logLevel: 'error',
  preview: { host, port, strictPort: true },
})

let browser

try {
  browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  const devtools = await context.newCDPSession(page)

  await devtools.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await devtools.send('Network.enable')
  await devtools.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 1_600_000 / 8,
    uploadThroughput: 750_000 / 8,
    connectionType: 'cellular4g',
  })

  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }),
  }))

  await page.addInitScript(() => {
    window.localStorage.setItem('ga-theme', 'dark')
    window.__gaPerformance = { cls: 0, lcp: 0 }

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__gaPerformance.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })

    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const latest = entries.at(-1)
      if (latest) window.__gaPerformance.lcp = latest.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })

  await page.goto(`${origin}/auth`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('heading', { name: /Welcome to Games Arena/i }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1_000)

  const { metrics, resources } = await page.evaluate(() => ({
    metrics: window.__gaPerformance,
    resources: performance.getEntriesByType('resource').map((entry) => entry.name),
  }))
  console.log(`Simulated mobile production: LCP ${Math.round(metrics.lcp)}ms, CLS ${metrics.cls.toFixed(3)}`)

  if (metrics.lcp <= 0 || metrics.lcp > 2_500) {
    throw new Error(`LCP budget exceeded: ${Math.round(metrics.lcp)}ms (budget: 2500ms)`)
  }
  if (metrics.cls > 0.1) {
    throw new Error(`CLS budget exceeded: ${metrics.cls.toFixed(3)} (budget: 0.100)`)
  }
  if (!resources.some((url) => url.includes('hero-dark-'))) {
    throw new Error('The resolved dark-theme backdrop was not requested')
  }
  if (resources.some((url) => url.includes('hero-light-'))) {
    throw new Error('The inactive light-theme backdrop was requested')
  }
} finally {
  await browser?.close()
  server.httpServer.close()
}
