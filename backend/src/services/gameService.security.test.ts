import { gameService } from './gameService'
import { AppError, BadRequestError, NotFoundError } from '../utils/errors'

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

jest.mock('../utils/redis', () => ({
  redisSet: jest.fn(),
  redisDel: jest.fn(),
}))

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
  userService: {
    updateStatsAfterGame: jest.fn(),
    invalidateLeaderboardCache: jest.fn(),
  },
}))

const { Game } = jest.requireMock('../models/Game') as {
  Game: {
    find: jest.Mock
    findOne: jest.Mock
    findOneAndUpdate: jest.Mock
  }
}
const { userService } = jest.requireMock('./userService') as {
  userService: { updateStatsAfterGame: jest.Mock; invalidateLeaderboardCache: jest.Mock }
}

const aliceId = '0123456789abcdef01234567'
const bobId = '1123456789abcdef01234567'
const malloryId = '2123456789abcdef01234567'
const gameId = 'abcdef0123456789abcdef01'

function id(value: string): { toString(): string } {
  return { toString: () => value }
}

function game(overrides: Record<string, unknown> = {}) {
  return {
    _id: id(gameId),
    gameType: 'ticTacToe',
    status: 'active',
    players: [
      { userId: id(aliceId), username: 'alice', index: 0 },
      { userId: id(bobId), username: 'bob', index: 1 },
    ],
    currentTurnIndex: 0,
    currentTurn: id(aliceId),
    gameState: { board: Array(9).fill(null), currentSymbol: 'X' },
    moveHistory: [],
    chatMessages: [],
    metadata: { mode: 'multiplayer', ratedGame: false },
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('gameService authorization and concurrency hardening', () => {
  beforeEach(() => jest.clearAllMocks())

  it('uses one participant-scoped query for game reads', async () => {
    Game.findOne.mockResolvedValue(null)

    await expect(gameService.getGame(gameId, malloryId)).resolves.toBeNull()
    expect(Game.findOne).toHaveBeenCalledWith({ _id: gameId, 'players.userId': malloryId })
  })

  it('rejects malformed ids before querying MongoDB', async () => {
    await expect(gameService.getGame(String({ $ne: null }), aliceId)).resolves.toBeNull()
    expect(Game.findOne).not.toHaveBeenCalled()
  })

  it('does not reveal whether a game exists to a nonparticipant', async () => {
    Game.findOne.mockResolvedValue(null)

    await expect(gameService.resignGame(gameId, malloryId)).rejects.toBeInstanceOf(NotFoundError)
    expect(userService.updateStatsAfterGame).not.toHaveBeenCalled()
  })

  it('completes a valid resignation and processes statistics once', async () => {
    const activeGame = game()
    Game.findOne.mockResolvedValueOnce(activeGame).mockResolvedValueOnce(activeGame)
    Game.findOneAndUpdate.mockResolvedValue(activeGame)

    await expect(gameService.resignGame(gameId, aliceId)).resolves.toEqual({ winner: 'bob', reason: 'resignation' })
    await expect(gameService.resignGame(gameId, aliceId)).rejects.toBeInstanceOf(BadRequestError)

    expect(userService.updateStatsAfterGame).toHaveBeenCalledTimes(1)
    expect(userService.updateStatsAfterGame).toHaveBeenCalledWith({ winnerId: bobId, loserIds: [aliceId] })
    expect(activeGame.result).toEqual(expect.objectContaining({ verification: 'server', loserName: 'alice' }))
  })

  it('keeps a committed resignation successful when statistics must be retried', async () => {
    const activeGame = game()
    Game.findOne.mockResolvedValue(activeGame)
    userService.updateStatsAfterGame.mockRejectedValueOnce(new Error('temporary stats failure'))

    await expect(gameService.resignGame(gameId, aliceId)).resolves.toEqual({ winner: 'bob', reason: 'resignation' })

    expect(activeGame.status).toBe('completed')
    expect(activeGame.statsProcessedAt).toBeUndefined()
    expect(Game.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('reconciles a bounded batch of committed verified results without markers', async () => {
    const pendingGame = game({
      status: 'completed',
      result: { winner: id(bobId), isDraw: false, verification: 'server' },
    })
    const limit = jest.fn().mockResolvedValue([pendingGame])
    const sort = jest.fn().mockReturnValue({ limit })
    Game.find.mockReturnValue({ sort })
    Game.findOneAndUpdate.mockResolvedValue(pendingGame)

    await expect(gameService.reconcilePendingStats(500)).resolves.toEqual({ scanned: 1, processed: 1, deferred: 0 })

    expect(Game.find).toHaveBeenCalledWith({
      status: 'completed',
      statsProcessedAt: null,
      'result.verification': { $in: ['server', 'replay'] },
      $or: [
        { 'metadata.mode': 'multiplayer' },
        { 'metadata.mode': { $exists: false } },
      ],
    })
    expect(limit).toHaveBeenCalledWith(100)
    expect(userService.updateStatsAfterGame).toHaveBeenCalledWith({ winnerId: bobId, loserIds: [aliceId] })
  })

  it('rejects solo and expired rooms when joining', async () => {
    Game.findOne.mockResolvedValueOnce(game({
      players: [{ userId: id(aliceId), username: 'alice', index: 0 }],
      metadata: { mode: 'singlePlayer', ratedGame: false },
    }))
    await expect(gameService.joinGame('ABCDEFGH', bobId, 'bob')).rejects.toBeInstanceOf(NotFoundError)

    Game.findOne.mockResolvedValueOnce(game({ inviteExpiresAt: new Date(Date.now() - 1000) }))
    await expect(gameService.joinGame('ABCDEFGH', malloryId, 'mallory')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('turns optimistic join conflicts into an HTTP 409 error', async () => {
    const waitingGame = game({
      players: [{ userId: id(aliceId), username: 'alice', index: 0 }],
      inviteExpiresAt: new Date(Date.now() + 60_000),
    })
    const conflict = Object.assign(new Error('stale'), { name: 'VersionError' })
    waitingGame.save = jest.fn().mockRejectedValue(conflict)
    Game.findOne.mockResolvedValue(waitingGame)

    const result = gameService.joinGame('ABCDEFGH', bobId, 'bob')
    await expect(result).rejects.toMatchObject<Partial<AppError>>({ statusCode: 409, code: 'GAME_STATE_CONFLICT' })
  })

  it('caps persisted move history while keeping move numbers monotonic', async () => {
    const boundedGame = game({
      moveHistory: Array.from({ length: 500 }, (_, index) => ({
        moveNumber: index + 1,
        playerId: id(index % 2 === 0 ? aliceId : bobId),
        playerName: index % 2 === 0 ? 'alice' : 'bob',
        move: String(index % 9),
        timestamp: new Date(),
      })),
    })
    Game.findOne.mockResolvedValue(boundedGame)

    await gameService.makeMove(gameId, aliceId, '0')
    await gameService.makeMove(gameId, bobId, '1')

    expect(boundedGame.moveHistory).toHaveLength(500)
    expect(boundedGame.moveHistory[0].moveNumber).toBe(3)
    expect(boundedGame.moveHistory[498].moveNumber).toBe(501)
    expect(boundedGame.moveHistory[499].moveNumber).toBe(502)
  })
})
