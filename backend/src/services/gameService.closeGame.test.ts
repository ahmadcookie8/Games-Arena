import { gameService } from './gameService'
import { BadRequestError, ForbiddenError } from '../utils/errors'

jest.mock('../models/Game', () => ({
  Game: {
    findById: jest.fn(),
  },
}))

jest.mock('../models/GameSnapshot', () => ({
  GameSnapshot: {
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
  },
}))

jest.mock('../utils/redis', () => ({
  redisGet: jest.fn(),
  redisSet: jest.fn(),
  redisDel: jest.fn(),
}))

jest.mock('./socketNotifier', () => ({
  emitGameOver: jest.fn(),
  emitGameUpdated: jest.fn(),
  emitGamesChanged: jest.fn(),
  emitMoveMade: jest.fn(),
}))

jest.mock('./userService', () => ({
  userService: {
    updateStatsAfterGame: jest.fn(),
    invalidateLeaderboardCache: jest.fn(),
  },
}))

const { Game } = jest.requireMock('../models/Game') as {
  Game: { findById: jest.Mock }
}
const { redisDel, redisGet, redisSet } = jest.requireMock('../utils/redis') as {
  redisDel: jest.Mock
  redisGet: jest.Mock
  redisSet: jest.Mock
}
const { emitGameUpdated, emitGamesChanged } = jest.requireMock('./socketNotifier') as {
  emitGameUpdated: jest.Mock
  emitGamesChanged: jest.Mock
}
const { userService } = jest.requireMock('./userService') as {
  userService: {
    updateStatsAfterGame: jest.Mock
    invalidateLeaderboardCache: jest.Mock
  }
}

function createGame(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'game-1',
    gameType: 'ticTacToe',
    status: 'active',
    players: [
      { userId: { toString: () => 'user-1' }, username: 'alice' },
      { userId: { toString: () => 'user-2' }, username: 'bob' },
    ],
    gameState: { board: Array(9).fill(null) },
    moveHistory: [],
    result: { winnerName: 'alice', isDraw: false, winType: 'three_in_a_row' },
    completedAt: undefined,
    lastMoveAt: new Date('2024-01-01T00:00:00.000Z'),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('gameService.closeGame', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('marks an active game as abandoned and emits refresh events', async () => {
    const game = createGame()
    Game.findById.mockResolvedValue(game)

    const result = await gameService.closeGame('game-1', 'user-1')

    expect(result).toBe(game)
    expect(game.status).toBe('abandoned')
    expect(game.result).toBeUndefined()
    expect(game.completedAt).toBeInstanceOf(Date)
    expect(game.lastMoveAt).toBeInstanceOf(Date)
    expect(game.save).toHaveBeenCalled()
    expect(redisDel).toHaveBeenCalledWith('game:ticTacToe:game-1')
    expect(emitGameUpdated).toHaveBeenCalledWith(game)
    expect(emitGamesChanged).toHaveBeenCalledWith(game)
    expect(userService.updateStatsAfterGame).not.toHaveBeenCalled()
    expect(userService.invalidateLeaderboardCache).not.toHaveBeenCalled()
  })

  it('rejects non-participants', async () => {
    Game.findById.mockResolvedValue(createGame())

    await expect(gameService.closeGame('game-1', 'user-3')).rejects.toBeInstanceOf(ForbiddenError)
    expect(redisDel).not.toHaveBeenCalled()
  })

  it('rejects non-active games', async () => {
    Game.findById.mockResolvedValue(createGame({ status: 'completed' }))

    await expect(gameService.closeGame('game-1', 'user-1')).rejects.toBeInstanceOf(BadRequestError)
    expect(redisDel).not.toHaveBeenCalled()
  })
})

describe('gameService.resumeGame', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not reactivate abandoned games', async () => {
    const game = createGame({ status: 'abandoned' })
    Game.findById.mockResolvedValue(game)

    const result = await gameService.resumeGame('game-1')

    expect(result).toBe(game)
    expect(redisGet).not.toHaveBeenCalled()
    expect(redisSet).not.toHaveBeenCalled()
    expect(game.save).not.toHaveBeenCalled()
  })
})
