import { randomBytes } from 'node:crypto'
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test'

const backendURL = process.env.MULTIPLAYER_E2E_BACKEND_URL || 'http://127.0.0.1:3185'
const frontendURL = process.env.MULTIPLAYER_E2E_FRONTEND_URL || 'http://127.0.0.1:4185'
const password = 'ArenaE2E!2026'
const runToken = `${Date.now().toString(36).slice(-6)}${randomBytes(2).toString('hex')}`
const accounts = {
  tttHost: makeAccount('ttthost'),
  tttGuest: makeAccount('tttguest'),
  wiseHost: makeAccount('wisehost'),
  wiseGuest: makeAccount('wiseguest'),
  wiseThird: makeAccount('wisethird'),
  scrabbleHost: makeAccount('scrhost'),
  scrabbleGuest: makeAccount('scrguest'),
  propertyHost: makeAccount('pmhost'),
  propertyGuest: makeAccount('pmguest'),
}
let clientIpSequence = 10

interface PlayerBrowser {
  context: BrowserContext
  page: Page
}

test.describe('published multiplayer games against real services', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ request }) => {
    let signupIpSuffix = 100
    for (const account of Object.values(accounts)) {
      await createAccount(request, account, `203.0.113.${signupIpSuffix++}`)
    }
  })

  test('Tic Tac Toe completes and coordinates a two-browser rematch', async ({ browser }) => {
    const players = await openPlayers(browser, [accounts.tttHost, accounts.tttGuest])
    const [host, guest] = players.map(({ page }) => page)

    try {
      const code = await createRoom(host, 'Tic Tac Toe')
      await joinRoom(guest, code, 'Tic Tac Toe')

      await playTicTacToeCell(host, 1, 1)
      await playTicTacToeCell(guest, 2, 1)
      await playTicTacToeCell(host, 1, 2)
      await playTicTacToeCell(guest, 2, 2)
      await playTicTacToeCell(host, 1, 3)

      await expect(host.getByRole('heading', { name: 'You won' })).toBeVisible()
      await expect(guest.getByRole('heading', { name: `${accounts.tttHost.username} won` })).toBeVisible()
      await expect(host.getByRole('group', { name: 'Tic Tac Toe final board.' })).toBeVisible()

      await startCoordinatedRematch(host, [host, guest])
      await expect(host.getByRole('button', { name: /empty/ })).toHaveCount(9)
      await expect(guest.getByRole('button', { name: /empty/ })).toHaveCount(9)

      await guest.goto('/history')
      await expect(guest.getByText(code, { exact: true })).toBeVisible()
    } finally {
      await closePlayers(players)
    }
  })

  test('a Tic Tac Toe guest can close an active room for every participant', async ({ browser }) => {
    const players = await openPlayers(browser, [accounts.tttHost, accounts.tttGuest])
    const [host, guest] = players.map(({ page }) => page)

    try {
      const code = await createRoom(host, 'Tic Tac Toe')
      await joinRoom(guest, code, 'Tic Tac Toe')

      await guest.getByRole('button', { name: 'Close game', exact: true }).click()
      const confirmation = guest.getByRole('dialog', { name: 'Close this game for everyone?' })
      await expect(confirmation).toBeVisible()
      await confirmation.getByRole('button', { name: 'Close game', exact: true }).click()

      await expect(guest).toHaveURL(`${frontendURL}/?tab=multiplayer`)
      const closedDialog = host.getByRole('dialog', { name: 'Game closed' })
      await expect(closedDialog).toBeVisible()
      await expect(closedDialog).toContainText('no longer available')
    } finally {
      await closePlayers(players)
    }
  })

  test('Wisecracker completes and returns three browsers to one fresh lobby', async ({ browser }) => {
    const players = await openPlayers(browser, [accounts.wiseHost, accounts.wiseGuest, accounts.wiseThird])
    const [host, guest, third] = players.map(({ page }) => page)

    try {
      const code = await createRoom(host, 'Wisecracker')
      await Promise.all([
        joinRoom(guest, code, 'Wisecracker'),
        joinRoom(third, code, 'Wisecracker'),
      ])

      const target = host.getByLabel('Points to win')
      await expect(target).toBeVisible()
      await target.fill('1')
      await host.getByRole('button', { name: 'Start match' }).click()

      const prompt = host.getByLabel('Your prompt')
      await expect(prompt).toBeVisible()
      await prompt.fill('A reliable game night needs _')
      await host.getByRole('button', { name: 'Use prompt' }).click()

      await submitWisecrackerAnswer(guest, 'working sockets')
      await submitWisecrackerAnswer(third, 'good friends')

      await expect(host.getByRole('button', { name: 'Reveal first answer' })).toBeVisible()
      await host.getByRole('button', { name: 'Reveal first answer' }).click()
      await expect(host.getByRole('button', { name: 'Reveal next answer' })).toBeVisible()
      await host.getByRole('button', { name: 'Reveal next answer' }).click()

      const firstAnswer = host.getByRole('button', { name: 'Choose answer 1 as the round winner' })
      await expect(firstAnswer).toBeVisible()
      await firstAnswer.click()

      await expect(host.getByText('First to 1 takes the spotlight.')).toBeVisible()
      await expect(guest.getByText('Match complete', { exact: true }).first()).toBeVisible()
      await expect(third.getByText('Match complete', { exact: true }).first()).toBeVisible()

      await startCoordinatedRematch(host, [host, guest, third])
      await expect(host.getByLabel('Points to win')).toHaveValue('3')
      await expect(host.getByRole('button', { name: 'Start match' })).toBeEnabled()
      await expect(guest.getByText('Waiting for the host', { exact: true })).toBeVisible()
    } finally {
      await closePlayers(players)
    }
  })

  test('Scrabble completes after a live exchange and coordinates a fresh table', async ({ browser }) => {
    const players = await openPlayers(browser, [accounts.scrabbleHost, accounts.scrabbleGuest])
    const [host, guest] = players.map(({ page }) => page)

    try {
      const code = await createRoom(host, 'Scrabble')
      await joinRoom(guest, code, 'Scrabble')

      const swapButton = host.getByRole('button', { name: 'Swap tiles' })
      await expect(swapButton).toBeEnabled()
      await swapButton.click()

      const rack = host.getByLabel('Your tile rack')
      const firstTile = rack.getByRole('button').first()
      await expect(firstTile).toBeVisible()
      await firstTile.click()
      const exchange = host.getByRole('button', { name: 'Exchange (1)' })
      await expect(exchange).toBeEnabled()
      await exchange.click()

      const giveUp = guest.getByRole('button', { name: 'Give up' })
      await expect(giveUp).toBeEnabled()
      await giveUp.click()
      const dialog = guest.getByRole('dialog', { name: 'Give up this game?' })
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: 'Give up' }).click()

      await expect(host.getByText('Game complete', { exact: true }).first()).toBeVisible()
      await expect(guest.getByText('Game complete', { exact: true }).first()).toBeVisible()
      await host.getByRole('tab', { name: 'History' }).click()
      await expect(host.getByText(`${accounts.scrabbleHost.username} exchanged 1 tile`)).toBeVisible()

      await startCoordinatedRematch(host, [host, guest])
      await expect(host.getByLabel('Your tile rack')).toBeVisible()
      await expect(guest.getByLabel('Your tile rack')).toBeVisible()
      await expect(host.getByRole('button', { name: 'Play tiles' })).toBeDisabled()
    } finally {
      await closePlayers(players)
    }
  })

  test('Property Management resolves bankruptcy and coordinates a fresh lobby', async ({ browser }) => {
    const players = await openPlayers(browser, [accounts.propertyHost, accounts.propertyGuest])
    const [host, guest] = players.map(({ page }) => page)

    try {
      const code = await createRoom(host, 'Property Management')
      await joinRoom(guest, code, 'Property Management')

      const start = host.getByRole('button', { name: 'Start the game' })
      await expect(start).toBeEnabled()
      await start.click()

      const bankruptcy = host.getByRole('button', { name: 'Declare bankruptcy' })
      await expect(bankruptcy).toBeEnabled()
      await bankruptcy.click()
      const dialog = host.getByRole('dialog', { name: 'Declare bankruptcy?' })
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: 'Declare bankruptcy' }).click()

      await expect(host.getByRole('heading', { name: `${accounts.propertyGuest.username} wins` })).toBeVisible()
      await expect(guest.getByRole('heading', { name: `${accounts.propertyGuest.username} wins` })).toBeVisible()
      await expect(host.getByText('Game complete', { exact: true }).first()).toBeVisible()

      await startCoordinatedRematch(host, [host, guest])
      await expect(host.getByRole('button', { name: 'Start the game' })).toBeEnabled()
      await expect(guest.getByText('The host will start when everyone is ready.', { exact: true })).toBeVisible()
    } finally {
      await closePlayers(players)
    }
  })
})

function makeAccount(role: string): { username: string; password: string } {
  return { username: `e2e_${role}_${runToken}`.slice(0, 20), password }
}

async function createAccount(
  request: APIRequestContext,
  account: { username: string; password: string },
  clientIp: string,
): Promise<void> {
  const response = await request.post(`${backendURL}/api/auth/signup`, {
    // CI talks to the backend on loopback where production has one Nginx hop.
    // Distinct forwarded clients keep the real five-signups-per-IP policy active.
    headers: { Origin: frontendURL, 'X-Forwarded-For': clientIp },
    data: account,
  })
  const body = await response.text()
  expect(response.ok(), `signup failed for ${account.username}: ${response.status()} ${body}`).toBe(true)
}

async function openPlayers(
  browser: Browser,
  selectedAccounts: ReadonlyArray<{ username: string; password: string }>,
): Promise<PlayerBrowser[]> {
  const players: PlayerBrowser[] = []
  try {
    for (const account of selectedAccounts) {
      const clientIp = `203.0.113.${clientIpSequence++}`
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'reduce',
      })
      // The backend runs behind one trusted proxy in production. Give each
      // emulated Engine.IO handshake its own forwarded client address without
      // teaching browser application requests that they may spoof this header.
      await context.route(`${backendURL}/socket.io/**`, async (route) => {
        await route.continue({
          headers: { ...route.request().headers(), 'x-forwarded-for': clientIp },
        })
      })
      const page = await context.newPage()
      players.push({ context, page })
      await signIn(page, account)
    }
    return players
  } catch (error) {
    await closePlayers(players)
    throw error
  }
}

async function closePlayers(players: PlayerBrowser[]): Promise<void> {
  await Promise.all(players.map(({ context }) => context.close()))
}

async function signIn(page: Page, account: { username: string; password: string }): Promise<void> {
  await page.goto('/auth')
  await page.getByLabel('Username or email').fill(account.username)
  await page.locator('input[name="password"]').fill(account.password)
  await page.getByRole('button', { name: 'Enter the arena' }).click()
  await expect(page.getByRole('heading', { name: /Pick your next challenge/i })).toBeVisible()
}

async function createRoom(page: Page, gameName: string): Promise<string> {
  const card = page
    .locator('section[aria-labelledby="arena-heading"] > div.grid > div')
    .filter({ has: page.getByRole('heading', { name: gameName, exact: true }) })
  await expect(card).toHaveCount(1)
  await card.getByRole('button', { name: 'Create room' }).click()
  await expect(page).toHaveURL(/\/game\/[a-f\d]{24}$/)
  await expect(page.locator('main h1')).toHaveText(gameName)
  const inviteLabel = await page.getByRole('button', { name: /Copy invite code/ }).getAttribute('aria-label')
  const code = inviteLabel?.match(/[A-Z0-9]{8}/)?.[0] || ''
  expect(code).toMatch(/^[A-Z0-9]{8}$/)
  return code
}

async function startCoordinatedRematch(host: Page, players: Page[]): Promise<string> {
  const oldPath = new URL(host.url()).pathname
  await host.getByRole('button', { name: 'Play Again', exact: true }).click()
  await expect.poll(() => new URL(host.url()).pathname).not.toBe(oldPath)

  const newPath = new URL(host.url()).pathname
  expect(newPath).toMatch(/^\/game\/[a-f\d]{24}$/)
  await Promise.all(players.map(async (page) => {
    await expect(page).toHaveURL(`${frontendURL}${newPath}`)
    await expect(page.getByText('Joining game...', { exact: true })).toBeHidden()
  }))
  return newPath
}

async function joinRoom(page: Page, code: string, gameName: string): Promise<void> {
  await page.getByLabel('Quick join').fill(code)
  await page.getByRole('button', { name: 'Join room' }).click()
  await expect(page).toHaveURL(/\/game\/[a-f\d]{24}$/)
  await expect(page.locator('main h1')).toHaveText(gameName)
  await expect(page.getByText('Joining game...', { exact: true })).toBeHidden()
}

async function playTicTacToeCell(page: Page, row: number, column: number): Promise<void> {
  const cell = page.getByRole('button', { name: new RegExp(`^Row ${row}, column ${column}, empty`) })
  await expect(cell).toBeEnabled()
  await cell.click()
}

async function submitWisecrackerAnswer(page: Page, answer: string): Promise<void> {
  const input = page.getByRole('textbox', { name: /^Your answer/ })
  await expect(input).toBeVisible()
  await input.fill(answer)
  await page.getByRole('button', { name: 'Lock in answers' }).click()
  // The last writer advances the room directly to reveal, while earlier
  // writers see the locked state. In both cases the editor must disappear.
  await expect(input).toBeHidden()
}
