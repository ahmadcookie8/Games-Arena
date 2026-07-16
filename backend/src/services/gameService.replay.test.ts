import { createSnakeInitialState, replayMazeChase, replaySnake } from '@games-arena/game-engine'
import { AppError } from '../utils/errors'
import { gameService } from './gameService'

jest.mock('../models/Game', () => ({
  Game: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}))

jest.mock('../models/GameSnapshot', () => ({
  GameSnapshot: { countDocuments: jest.fn(), create: jest.fn() },
}))

jest.mock('../utils/redis', () => ({ redisSet: jest.fn(), redisDel: jest.fn() }))
jest.mock('../middleware/rateLimit', () => ({
  acquireRedisConcurrencySlot: jest.fn(),
  releaseRedisConcurrencySlot: jest.fn(),
}))
jest.mock('../utils/securityLogger', () => ({ logSecurityEvent: jest.fn() }))
jest.mock('./socketNotifier', () => ({
  emitGameOver: jest.fn(),
  emitChatMessage: jest.fn(),
  emitGameReplayCreated: jest.fn(),
  emitGameUpdated: jest.fn(),
  emitGamesChanged: jest.fn(),
  emitMoveMade: jest.fn(),
}))
jest.mock('./userService', () => ({
  userService: { updateStatsAfterGame: jest.fn(), invalidateLeaderboardCache: jest.fn() },
}))

const { Game } = jest.requireMock('../models/Game') as {
  Game: { findOne: jest.Mock; findOneAndUpdate: jest.Mock }
}

const userId = '0123456789abcdef01234567'
const gameId = 'abcdef0123456789abcdef01'
const seed = 'b'.repeat(64)

function id(value: string): { toString(): string } {
  return { toString: () => value }
}

function activeGame(overrides: Record<string, unknown> = {}) {
  return {
    _id: id(gameId),
    __v: 4,
    gameType: 'snake',
    status: 'active',
    players: [{ userId: id(userId), username: 'alice', index: 0 }],
    currentTurnIndex: 0,
    currentTurn: id(userId),
    gameState: {},
    moveHistory: [],
    chatMessages: [],
    metadata: { mode: 'singlePlayer', ratedGame: false, boardSize: 'small', wallLooping: false },
    replay: { version: 1, seed, startedAt: new Date(Date.now() - 30_000) },
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function completedGame(source = activeGame()) {
  return { ...source, status: 'completed', gameState: replaySnake(seed, { boardSize: 'small', wallLooping: false }, { version: 1, tickCount: 6, inputs: [] }).state }
}

describe('single-player replay verification', () => {
  beforeEach(() => jest.clearAllMocks())

  it('derives the terminal state and score on the server and commits once', async () => {
    const source = activeGame()
    const committed = completedGame(source)
    Game.findOne.mockResolvedValue(source)
    Game.findOneAndUpdate.mockResolvedValue(committed)

    await expect(gameService.completeSinglePlayerReplay(gameId, userId, {
      version: 1,
      tickCount: 6,
      inputs: [],
    })).resolves.toBe(committed)

    const [filter, update] = Game.findOneAndUpdate.mock.calls[0]
    expect(filter).toEqual(expect.objectContaining({
      _id: source._id,
      'players.userId': userId,
      status: 'active',
      __v: 4,
      'replay.seed': seed,
    }))
    expect(update.$set).toEqual(expect.objectContaining({
      status: 'completed',
      result: expect.objectContaining({ winType: 'score:3', verification: 'replay' }),
      gameState: expect.objectContaining({ isGameOver: true, score: 3, tick: 6 }),
    }))
    expect(update.$inc).toEqual({ __v: 1 })
  })

  it('rejects incomplete and malformed logs without writing a result', async () => {
    Game.findOne.mockResolvedValue(activeGame())

    await expect(gameService.completeSinglePlayerReplay(gameId, userId, {
      version: 1,
      tickCount: 5,
      inputs: [],
    })).rejects.toMatchObject<Partial<AppError>>({ code: 'REPLAY_INCOMPLETE', statusCode: 400 })

    await expect(gameService.completeSinglePlayerReplay(gameId, userId, {
      version: 1,
      tickCount: 6,
      inputs: [{ tick: 2, direction: 'up' }, { tick: 1, direction: 'left' }],
    })).rejects.toMatchObject<Partial<AppError>>({ code: 'INVALID_REPLAY', statusCode: 400 })

    expect(Game.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('rejects a valid but temporally impossible replay', async () => {
    const mazeReplay = { version: 1 as const, tickCount: 69, inputs: [] }
    expect(replayMazeChase(seed, mazeReplay)).toMatchObject({ completed: true, elapsedMs: 10_350 })
    Game.findOne.mockResolvedValue(activeGame({
      gameType: 'mazeChase',
      metadata: { mode: 'singlePlayer', ratedGame: false },
      replay: { version: 1, seed, startedAt: new Date() },
    }))

    await expect(gameService.completeSinglePlayerReplay(gameId, userId, mazeReplay))
      .rejects.toMatchObject<Partial<AppError>>({ code: 'REPLAY_TOO_FAST', statusCode: 400 })
    expect(Game.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('makes a completion that overtakes the first start checkpoint safely retryable', async () => {
    const source = activeGame({ replay: { version: 1, seed } })
    const committed = completedGame(source)
    Game.findOne.mockResolvedValueOnce(source).mockResolvedValueOnce({
      ...source,
      replay: { version: 1, seed, startedAt: new Date(Date.now() - 5_000) },
    })
    Game.findOneAndUpdate.mockResolvedValue(committed)
    const replay = { version: 1 as const, tickCount: 6, inputs: [] }

    await expect(gameService.completeSinglePlayerReplay(gameId, userId, replay))
      .rejects.toMatchObject<Partial<AppError>>({ code: 'REPLAY_START_PENDING', statusCode: 409 })
    await expect(gameService.completeSinglePlayerReplay(gameId, userId, replay)).resolves.toBe(committed)

    expect(Game.findOneAndUpdate).toHaveBeenCalledTimes(1)
  })

  it('serializes concurrent first-start checkpoints through optimistic concurrency', async () => {
    const state = { ...createSnakeInitialState(seed, 'small'), hasStarted: true }
    const first = activeGame({ replay: { version: 1, seed }, gameState: state })
    const second = activeGame({ replay: { version: 1, seed }, gameState: state })
    second.save = jest.fn().mockRejectedValue(Object.assign(new Error('stale start'), { name: 'VersionError' }))
    Game.findOne.mockResolvedValueOnce(first).mockResolvedValueOnce(second)

    const starts = await Promise.allSettled([
      gameService.saveSinglePlayerSnakeState(gameId, userId, state),
      gameService.saveSinglePlayerSnakeState(gameId, userId, state),
    ])

    expect(starts.filter((start) => start.status === 'fulfilled')).toHaveLength(1)
    const rejected = starts.find((start): start is PromiseRejectedResult => start.status === 'rejected')
    expect(rejected?.reason).toMatchObject({ code: 'GAME_STATE_CONFLICT', statusCode: 409 })
    expect(first.markModified).toHaveBeenCalledWith('replay')
    expect(second.markModified).toHaveBeenCalledWith('replay')
  })

  it('allows only one conditional completion when identical submissions race', async () => {
    const source = activeGame()
    const committed = completedGame(source)
    Game.findOne.mockResolvedValue(source)
    Game.findOneAndUpdate.mockResolvedValueOnce(committed).mockResolvedValueOnce(null)

    const submissions = await Promise.allSettled([
      gameService.completeSinglePlayerReplay(gameId, userId, { version: 1, tickCount: 6, inputs: [] }),
      gameService.completeSinglePlayerReplay(gameId, userId, { version: 1, tickCount: 6, inputs: [] }),
    ])

    expect(submissions.filter((submission) => submission.status === 'fulfilled')).toHaveLength(1)
    const rejected = submissions.find((submission): submission is PromiseRejectedResult => submission.status === 'rejected')
    expect(rejected?.reason).toMatchObject({ code: 'GAME_STATE_CONFLICT', statusCode: 409 })
    expect(Game.findOneAndUpdate).toHaveBeenCalledTimes(2)
  })

  it('preserves legacy checkpoint completion as unverified history', async () => {
    const terminal = replaySnake(seed, { boardSize: 'small', wallLooping: false }, {
      version: 1,
      tickCount: 6,
      inputs: [],
    }).state
    const legacy = activeGame({ replay: undefined, gameState: terminal })
    Game.findOne.mockResolvedValue(legacy)

    await expect(gameService.saveSinglePlayerSnakeState(gameId, userId, terminal, true)).resolves.toBe(legacy)
    expect(legacy).toMatchObject({
      status: 'completed',
      result: expect.objectContaining({ verification: 'unverified', winType: 'score:3' }),
    })
    expect(Game.findOneAndUpdate).not.toHaveBeenCalled()
  })
})
