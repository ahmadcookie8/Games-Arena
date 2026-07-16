import { expect, test, type Page } from '@playwright/test'
import { installApiFixtures } from './fixtures'

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `page is ${overflow}px wider than its viewport`).toBeLessThanOrEqual(1)
}

test('captures light and dark Dashboard coverage at every acceptance width @visual', async ({ page }, testInfo) => {
  await installApiFixtures(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const theme of ['light', 'dark'] as const) {
    await page.addInitScript((preference) => window.localStorage.setItem('ga-theme', preference), theme)

    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 })
      await page.goto('/')
      await expect(page.getByRole('heading', { name: /Pick your next challenge/i })).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await assertNoOverflow(page)
      await page.screenshot({
        path: testInfo.outputPath(`dashboard-${theme}-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      })
    }
  }
})

test('keeps coarse targets actionable and reduced motion free of loops @visual', async ({ page }) => {
  await installApiFixtures(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Pick your next challenge/i })).toBeVisible()

  const undersizedTargets = await page.locator('main button, main a[href], main input, main [role="tab"]').evaluateAll((elements) => (
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return []
      if (rect.width >= 44 && rect.height >= 44) return []
      return [{
        label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }]
    })
  ))
  expect(undersizedTargets).toEqual([])

  const reducedMotionLeaks = await page.locator('body *').evaluateAll((elements) => (
    elements.flatMap((element) => {
      const style = getComputedStyle(element)
      const hasInfiniteAnimation = style.animationIterationCount.split(',').some((value) => value.trim() === 'infinite')
        && style.animationDuration.split(',').some((value) => value.trim() !== '0s')
      const isHiddenReveal = element.classList.contains('reveal') && style.opacity === '0'
      return hasInfiniteAnimation || isHiddenReveal
        ? [element.getAttribute('aria-label') || element.className || element.tagName]
        : []
    })
  ))
  expect(reducedMotionLeaks).toEqual([])
})

test('reflows at an effective 200 percent zoom without horizontal overflow @visual', async ({ page }, testInfo) => {
  await installApiFixtures(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 720, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Pick your next challenge/i })).toBeVisible()
  await assertNoOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('dashboard-effective-200-percent-zoom.png'),
    fullPage: true,
    animations: 'disabled',
  })
})
