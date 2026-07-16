import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { installApiFixtures } from './fixtures'

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `page is ${overflow}px wider than its viewport`).toBeLessThanOrEqual(1)
}

async function expectNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const violations = results.violations
    .filter(({ impact }) => impact === 'critical' || impact === 'serious')
    .map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.slice(0, 5).map((node) => node.target.join(' ')),
    }))
  expect(violations).toEqual([])
}

test.describe('authentication', () => {
  test.beforeEach(async ({ page }) => {
    await installApiFixtures(page, { authenticated: false })
  })

  test('has labeled sign-in and sign-up flows with keyboard tabs', async ({ page }) => {
    await page.goto('/auth')

    await expect(page.getByRole('heading', { name: 'Welcome to Games Arena' })).toBeVisible()
    await expect(page.getByLabel('Username or email')).toHaveAttribute('autocomplete', 'username')
    await expect(page.locator('input[name="password"]')).toHaveAttribute('autocomplete', 'current-password')

    const signInTab = page.getByRole('tab', { name: 'Sign in' })
    await signInTab.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Create account' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('input[name="username"]')).toHaveAttribute('autocomplete', 'username')
    await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'email')
    await expect(page.locator('input[name="confirmPassword"]')).toHaveAttribute('autocomplete', 'new-password')

    await expectNoPageOverflow(page)
    await expectNoSeriousAxeViolations(page)
  })

  test('announces stable inline validation errors', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('button', { name: 'Enter the arena' }).click()

    await expect(page.getByRole('alert')).toHaveCount(2)
    await expect(page.getByRole('alert').first()).toContainText('username or email')
    await expect(page.getByLabel('Username or email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('input[name="password"]')).toHaveAttribute('aria-invalid', 'true')
  })
})

test.describe('application shell', () => {
  test.beforeEach(async ({ page }) => {
    await installApiFixtures(page)
  })

  test('supports both URL-backed Dashboard modes and one main landmark', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /Pick your next challenge/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Continue playing' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Choose your arena' })).toBeVisible()
    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.getByRole('button', { name: /Create room/i }).first()).toBeVisible()

    await page.getByRole('radio', { name: 'Single player' }).click()
    await expect(page).toHaveURL(/\?tab=singlePlayer$/)
    await expect(page.getByRole('button', { name: /Start run/i }).first()).toBeVisible()

    await expectNoPageOverflow(page)
    await expectNoSeriousAxeViolations(page)
  })

  test('filters deterministic History data and identifies unranked results', async ({ page }) => {
    await page.goto('/history')

    await expect(page.getByRole('heading', { name: 'Game history', exact: true })).toBeVisible()
    await expect(page.getByText('Unranked')).toBeVisible()
    await page.getByRole('radio', { name: 'Single player' }).click()
    await expect(page.getByText('Final length 48')).toBeVisible()

    await expectNoPageOverflow(page)
    await expectNoSeriousAxeViolations(page)
  })

  test('renders a polished generic 404 route', async ({ page }) => {
    await page.goto('/definitely-not-a-route')

    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: /off the map/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /back to lobby/i })).toBeVisible()
    await expectNoSeriousAxeViolations(page)
  })
})

const reachableGames = [
  { route: '/game/multi-tic', title: 'Tic Tac Toe' },
  { route: '/game/multi-wisecracker', title: 'Wisecracker' },
  { route: '/game/multi-scrabble', title: 'Scrabble' },
  { route: '/game/multi-property', title: 'Property Management' },
  { route: '/single-player/tic-tac-toe/solo-tic', title: 'Solo Tic Tac Toe' },
  { route: '/single-player/snake/solo-snake', title: 'Snake' },
  { route: '/single-player/maze-chase/solo-maze', title: 'Maze Chase' },
] as const

test.describe('reachable game shells', () => {
  test.beforeEach(async ({ page }) => {
    await installApiFixtures(page)
  })

  for (const game of reachableGames) {
    test(`${game.title} uses the shared accessible shell`, async ({ page }) => {
      await page.goto(game.route)

      await expect(page.locator('main h1')).toHaveText(game.title)
      await expect(page.locator('main')).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible()
      await expectNoPageOverflow(page)
      await expectNoSeriousAxeViolations(page)
    })
  }
})
