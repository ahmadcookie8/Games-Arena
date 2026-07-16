jest.mock('../models/User', () => ({
  User: { findById: jest.fn(), updateMany: jest.fn(), findByIdAndUpdate: jest.fn() },
}))

jest.mock('../models/Game', () => ({
  Game: { find: jest.fn(), aggregate: jest.fn() },
}))

jest.mock('../utils/redis', () => ({
  redisDel: jest.fn(),
  redisGet: jest.fn(),
  redisSet: jest.fn(),
}))

jest.mock('../middleware/rateLimit', () => ({
  acquireRedisConcurrencySlot: jest.fn(),
  releaseRedisConcurrencySlot: jest.fn(),
}))

import { Game } from '../models/Game'
import { User } from '../models/User'
import { redisDel, redisGet, redisSet } from '../utils/redis'
import { acquireRedisConcurrencySlot, releaseRedisConcurrencySlot } from '../middleware/rateLimit'
import { userService } from './userService'

const findMock = Game.find as jest.Mock
const aggregateMock = Game.aggregate as jest.Mock
const redisGetMock = redisGet as jest.Mock
const redisSetMock = redisSet as jest.Mock
const redisDelMock = redisDel as jest.Mock
const findByIdAndUpdateMock = User.findByIdAndUpdate as jest.Mock
const acquireSlotMock = acquireRedisConcurrencySlot as jest.Mock
const releaseSlotMock = releaseRedisConcurrencySlot as jest.Mock

function mockFindResult(result: unknown[]): void {
  const lean = jest.fn().mockResolvedValue(result)
  const select = jest.fn().mockReturnValue({ lean })
  findMock.mockReturnValue({ select })
}

describe('leaderboard security filters', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    redisGetMock.mockResolvedValue(null)
    redisSetMock.mockResolvedValue(undefined)
    redisDelMock.mockResolvedValue(undefined)
    findByIdAndUpdateMock.mockResolvedValue(undefined)
    acquireSlotMock.mockResolvedValue({ allowed: true, count: 1 })
    releaseSlotMock.mockResolvedValue(undefined)
  })

  it('only queries explicitly verified multiplayer results for the global leaderboard', async () => {
    mockFindResult([])

    await expect(userService.getGlobalLeaderboard(10, 1)).resolves.toEqual([])

    expect(findMock).toHaveBeenCalledWith({
      status: 'completed',
      'result.isDraw': false,
      'result.winner': { $exists: true },
      'result.verification': { $in: ['server', 'replay'] },
      $or: [
        { 'metadata.mode': 'multiplayer' },
        { 'metadata.mode': { $exists: false } },
      ],
    })
    expect(redisSetMock).toHaveBeenCalledWith('leaderboard:v2:global', [], 60 * 60)
  })

  it('applies the same verification and mode filter to game-specific leaderboards', async () => {
    aggregateMock.mockResolvedValue([])

    await expect(userService.getLeaderboardByGameType('ticTacToe', 10, 1)).resolves.toEqual([])

    const pipeline = aggregateMock.mock.calls[0][0]
    expect(pipeline[0]).toEqual({
      $match: {
        gameType: 'ticTacToe',
        status: 'completed',
        'result.isDraw': false,
        'result.verification': { $in: ['server', 'replay'] },
        $or: [
          { 'metadata.mode': 'multiplayer' },
          { 'metadata.mode': { $exists: false } },
        ],
      },
    })
  })

  it.each(['snake', 'mazeChase'] as const)(
    'requires deterministic replay verification for the %s leaderboard',
    async (gameType) => {
      mockFindResult([])

      await expect(userService.getSinglePlayerLeaderboard(gameType, 10, 1)).resolves.toEqual([])

      expect(findMock).toHaveBeenCalledWith({
        gameType,
        status: 'completed',
        'metadata.mode': 'singlePlayer',
        'result.verification': 'replay',
      })
      expect(redisSetMock).toHaveBeenCalledWith(`leaderboard:v2:singlePlayer:${gameType}`, [], 60 * 60)
    }
  )

  it('requires result verification for the server-simulated single-player leaderboard', async () => {
    mockFindResult([])

    await expect(userService.getSinglePlayerLeaderboard('ticTacToe', 10, 1)).resolves.toEqual([])

    expect(findMock).toHaveBeenCalledWith({
      gameType: 'ticTacToe',
      status: 'completed',
      'metadata.mode': 'singlePlayer',
      'result.verification': { $in: ['server', 'replay'] },
    })
  })
})

describe('idempotent verified statistics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    redisDelMock.mockResolvedValue(undefined)
    findByIdAndUpdateMock.mockResolvedValue(undefined)
    acquireSlotMock.mockReset().mockResolvedValue({ allowed: true, count: 1 })
    releaseSlotMock.mockReset().mockResolvedValue(undefined)
  })

  it('derives exact totals instead of incrementing them on retries', async () => {
    mockFindResult([{
      players: [{ userId: 'winner' }, { userId: 'loser' }],
      metadata: { mode: 'multiplayer' },
      result: { winner: 'winner', isDraw: false, verification: 'server' },
    }])

    await userService.updateStatsAfterGame({ winnerId: 'winner', loserIds: ['loser'] })
    await userService.updateStatsAfterGame({ winnerId: 'winner', loserIds: ['loser'] })

    expect(findByIdAndUpdateMock).toHaveBeenCalledTimes(4)
    expect(findByIdAndUpdateMock).toHaveBeenNthCalledWith(1, 'winner', {
      $set: { stats: { gamesPlayed: 1, gamesWon: 1, gamesLost: 0, gamesDraw: 0, winRate: 1 } },
    })
    expect(findByIdAndUpdateMock).toHaveBeenNthCalledWith(2, 'loser', {
      $set: { stats: { gamesPlayed: 1, gamesWon: 0, gamesLost: 1, gamesDraw: 0, winRate: 0 } },
    })
    for (const call of findByIdAndUpdateMock.mock.calls) {
      expect(call[1]).not.toHaveProperty('$inc')
    }
  })

  it('locks affected users in a stable order before deriving statistics', async () => {
    mockFindResult([])

    await userService.updateStatsAfterGame({ winnerId: 'middle', loserIds: ['z-user', 'a-user'] })

    expect(acquireSlotMock.mock.calls.map((call) => call[1])).toEqual(['a-user', 'middle', 'z-user'])
    expect(new Set(acquireSlotMock.mock.calls.map((call) => call[2])).size).toBe(1)
    expect(releaseSlotMock.mock.calls.map((call) => call[1])).toEqual(['z-user', 'middle', 'a-user'])
  })

  it('does not derive a stale snapshot while a shared user reconciliation lock is held', async () => {
    const heldByUser = new Map<string, string>()
    acquireSlotMock.mockImplementation(async (_scope: string, userId: string, slotId: string) => {
      const owner = heldByUser.get(userId)
      if (owner && owner !== slotId) return { allowed: false, count: 1 }
      heldByUser.set(userId, slotId)
      return { allowed: true, count: 1 }
    })
    releaseSlotMock.mockImplementation(async (_scope: string, userId: string, slotId: string) => {
      if (heldByUser.get(userId) === slotId) heldByUser.delete(userId)
    })

    let releaseFirstQuery!: (games: unknown[]) => void
    const firstQuery = new Promise<unknown[]>((resolve) => { releaseFirstQuery = resolve })
    const firstLean = jest.fn().mockReturnValue(firstQuery)
    const secondLean = jest.fn().mockResolvedValue([])
    findMock
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: firstLean }) })
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: secondLean }) })

    const first = userService.updateStatsAfterGame({ winnerId: 'shared', loserIds: ['first-opponent'] })
    await new Promise<void>((resolve) => setImmediate(resolve))

    await expect(userService.updateStatsAfterGame({ winnerId: 'shared', loserIds: ['second-opponent'] }))
      .rejects.toThrow('already in progress')
    expect(findMock).toHaveBeenCalledTimes(1)

    releaseFirstQuery([])
    await first
    expect(heldByUser.size).toBe(0)

    await expect(userService.updateStatsAfterGame({ winnerId: 'shared', loserIds: ['second-opponent'] }))
      .resolves.toBeUndefined()
    expect(findMock).toHaveBeenCalledTimes(2)
  })
})
