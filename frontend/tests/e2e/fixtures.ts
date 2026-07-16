import type { Page, Route } from '@playwright/test'
import type { Game, GameType } from '../../src/types/game'

export const TEST_USER = {
  _id: '64f000000000000000000001',
  username: 'pixelpenguin',
  email: 'pixel@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  stats: {
    gamesPlayed: 12,
    gamesWon: 7,
    gamesLost: 3,
    gamesDraw: 2,
    winRate: 58,
  },
}

const OPPONENT = {
  userId: '64f000000000000000000002',
  username: 'neonrival',
  index: 1,
  isConnected: true,
}

const fixedDate = '2026-07-15T20:00:00.000Z'
const replaySeed = '1'.repeat(64)

function baseGame(
  _id: string,
  gameType: GameType,
  gameState: Record<string, unknown>,
  mode: 'multiplayer' | 'singlePlayer' = 'multiplayer',
): Game {
  return {
    _id,
    gameType,
    status: 'active',
    gameCode: 'PLAY2026',
    players: [{ userId: TEST_USER._id, username: TEST_USER.username, index: 0, isConnected: true }],
    currentTurnIndex: 0,
    gameState,
    moveHistory: [],
    chatMessages: [],
    createdAt: fixedDate,
    lastMoveAt: fixedDate,
    metadata: { ratedGame: false, mode },
  }
}

const emptyScrabbleBoard = Array.from({ length: 15 }, () => Array<null>(15).fill(null))

export const ROUTE_GAMES: Record<string, Game> = {
  'multi-tic': baseGame('multi-tic', 'ticTacToe', {
    board: Array<null>(9).fill(null),
    currentSymbol: 'X',
  }),
  'multi-wisecracker': baseGame('multi-wisecracker', 'wisecracker', {
    phase: 'lobby',
    hostUserId: TEST_USER._id,
    maxScore: 3,
    chooserUserId: null,
    chooserIndex: 0,
    activePlayerIds: [TEST_USER._id],
    waitingPlayerIds: [],
    prompt: '',
    answerSlots: 0,
    submissionStatus: {},
    myAnswers: [],
    revealedResponses: [],
    scores: { [TEST_USER._id]: 0 },
    roundWinnerResponseId: null,
    matchWinnerUserId: null,
  }),
  'multi-scrabble': baseGame('multi-scrabble', 'scrabble', {
    board: emptyScrabbleBoard,
    racks: {
      [TEST_USER._id]: [
        { id: 'tile-a', letter: 'A', value: 1, isBlank: false },
        { id: 'tile-r', letter: 'R', value: 1, isBlank: false },
        { id: 'tile-c', letter: 'C', value: 3, isBlank: false },
      ],
    },
    rackCounts: { [TEST_USER._id]: 3 },
    scores: { [TEST_USER._id]: 0 },
    bagCount: 93,
    infiniteLetters: false,
    usedPremiumSquares: [],
    pendingTrade: null,
    consecutivePasses: 0,
    givenUpUserIds: [],
    lastScoreEvent: null,
  }),
  'multi-property': baseGame('multi-property', 'propertyManagement', {
    phase: 'lobby',
    hostUserId: TEST_USER._id,
    currentPlayerUserId: TEST_USER._id,
    turnPhase: 'preRoll',
    dice: null,
    doublesCount: 0,
    playerOrder: [TEST_USER._id],
    playerStates: {
      [TEST_USER._id]: {
        userId: TEST_USER._id,
        username: TEST_USER.username,
        position: 0,
        money: 1500,
        inJail: false,
        jailRollCount: 0,
        getOutOfJailFreeCards: 0,
        isBankrupt: false,
      },
    },
    properties: {},
    chanceCardIndex: 0,
    communityChestCardIndex: 0,
    chanceCardOrder: [],
    communityChestCardOrder: [],
    chanceFreeCardReturned: true,
    communityChestFreeCardReturned: true,
    pendingAction: null,
    lastEventMessage: null,
    bankruptPlayerIds: [],
    winnerId: null,
  }),
  'solo-tic': {
    ...baseGame('solo-tic', 'ticTacToe', {
      board: Array<null>(9).fill(null),
      currentSymbol: 'X',
    }, 'singlePlayer'),
    metadata: { ratedGame: false, mode: 'singlePlayer', difficulty: 'medium' },
  },
  'solo-snake': {
    ...baseGame('solo-snake', 'snake', {
      width: 12,
      height: 12,
      snake: [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 9, y: 6 },
      score: 0,
      isGameOver: false,
      hasStarted: false,
      tickMs: 120,
      tick: 0,
    }, 'singlePlayer'),
    metadata: { ratedGame: false, mode: 'singlePlayer', boardSize: 'medium', wallLooping: false },
    replay: { version: 1, seed: replaySeed },
  },
  'solo-maze': {
    ...baseGame('solo-maze', 'mazeChase', {
      width: 7,
      height: 7,
      maze: [
        '#######',
        '#     #',
        '# ### #',
        '#     #',
        '# ### #',
        '#     #',
        '#######',
      ],
      player: {
        position: { x: 1, y: 1 },
        start: { x: 1, y: 1 },
        direction: 'none',
        pendingDirection: 'none',
      },
      ghosts: [{
        id: 'spark',
        color: 'cyan',
        position: { x: 5, y: 5 },
        start: { x: 5, y: 5 },
        direction: 'left',
        mode: 'chase',
      }],
      pellets: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }],
      powerPellets: [{ x: 5, y: 1 }],
      fruit: { position: { x: 3, y: 3 }, active: false, collected: false },
      score: 0,
      lives: 3,
      level: 1,
      frightenedUntil: 0,
      isGameOver: false,
      hasStarted: false,
      tickMs: 140,
      ghostStepCounter: 0,
      tick: 0,
      elapsedMs: 0,
    }, 'singlePlayer'),
    replay: { version: 1, seed: replaySeed },
  },
}

ROUTE_GAMES['multi-tic'].players.push(OPPONENT)

const completedMultiplayer: Game = {
  ...ROUTE_GAMES['multi-tic'],
  _id: 'complete-tic',
  status: 'completed',
  result: {
    winner: TEST_USER._id,
    winnerName: TEST_USER.username,
    isDraw: false,
    winType: 'line',
    verification: 'server',
  },
}

const completedSolo: Game = {
  ...ROUTE_GAMES['solo-snake'],
  _id: 'complete-snake',
  status: 'completed',
  gameState: { ...ROUTE_GAMES['solo-snake'].gameState, score: 48, isGameOver: true },
  result: {
    isDraw: false,
    winType: 'score:48',
    verification: 'unverified',
  },
}

export const MULTIPLAYER_LISTS = {
  active: [ROUTE_GAMES['multi-tic']],
  waiting: [ROUTE_GAMES['multi-wisecracker']],
  completed: [completedMultiplayer],
}

export const SINGLE_PLAYER_LISTS = {
  active: [ROUTE_GAMES['solo-snake']],
  waiting: [],
  completed: [completedSolo],
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://127.0.0.1:4175',
  'Access-Control-Allow-Credentials': 'true',
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(body),
  })
}

export async function installApiFixtures(page: Page, options: { authenticated?: boolean } = {}) {
  const authenticated = options.authenticated ?? true

  await page.route('**/socket.io/**', (route) => route.abort())
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const { pathname, searchParams } = url

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }

    if (pathname === '/api/auth/me') {
      await json(route, authenticated ? { user: TEST_USER } : { error: { message: 'Unauthorized' } }, authenticated ? 200 : 401)
      return
    }

    if (pathname === '/api/games' && request.method() === 'GET') {
      await json(route, searchParams.get('mode') === 'singlePlayer' ? SINGLE_PLAYER_LISTS : MULTIPLAYER_LISTS)
      return
    }

    if (pathname.startsWith('/api/games/') && request.method() === 'GET') {
      const gameId = pathname.split('/').at(-1) || ''
      const game = ROUTE_GAMES[gameId]
      await json(route, game ? { game } : { error: { message: 'Game not found' } }, game ? 200 : 404)
      return
    }

    if (pathname === '/api/leaderboards') {
      await json(route, { leaderboard: [], global: [] })
      return
    }

    if (pathname.startsWith('/api/leaderboards/single-player/')) {
      await json(route, { leaderboard: [] })
      return
    }

    await json(route, {})
  })
}
