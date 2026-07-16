jest.mock('mongoose', () => ({
  __esModule: true,
  default: { disconnect: jest.fn() },
}))

jest.mock('../models/Game', () => ({
  Game: { find: jest.fn(), bulkWrite: jest.fn() },
}))

jest.mock('../models/User', () => ({
  User: { find: jest.fn(), bulkWrite: jest.fn() },
}))

jest.mock('../utils/mongoose', () => ({
  connectMongoDB: jest.fn(),
}))

jest.mock('../utils/redis', () => ({
  closeRedisClient: jest.fn(),
  redisDelMany: jest.fn(),
}))

import mongoose from 'mongoose'
import { Game } from '../models/Game'
import { User } from '../models/User'
import { connectMongoDB } from '../utils/mongoose'
import { closeRedisClient, redisDelMany } from '../utils/redis'
import { runSecurityMigration } from './securityMigration'

function mockLeanFind(model: { find: jest.Mock }, records: unknown[]): void {
  const lean = jest.fn().mockResolvedValue(records)
  const select = jest.fn().mockReturnValue({ lean })
  model.find.mockReturnValue({ select })
}

describe('security migration safeguards', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(connectMongoDB as jest.Mock).mockResolvedValue(undefined)
    ;(Game.bulkWrite as jest.Mock).mockResolvedValue(undefined)
    ;(User.bulkWrite as jest.Mock).mockResolvedValue(undefined)
  })

  it('refuses write mode unless a database backup was explicitly confirmed', async () => {
    await expect(runSecurityMigration(['--apply'])).rejects.toThrow('Refusing to apply without --backup-confirmed')

    expect(connectMongoDB).not.toHaveBeenCalled()
    expect(Game.bulkWrite).not.toHaveBeenCalled()
    expect(User.bulkWrite).not.toHaveBeenCalled()
  })

  it('classifies and reconciles in report-only mode without modifying MongoDB', async () => {
    mockLeanFind(Game as unknown as { find: jest.Mock }, [
      {
        _id: 'game-1',
        status: 'completed',
        gameType: 'ticTacToe',
        players: [{ userId: 'a' }, { userId: 'b' }],
        result: { winner: 'a', isDraw: false, winType: 'three-in-a-row' },
      },
      {
        _id: 'game-2',
        status: 'completed',
        gameType: 'snake',
        metadata: { mode: 'singlePlayer' },
        players: [{ userId: 'a' }],
        result: { winner: 'a', isDraw: false, winType: 'score:999999' },
      },
      {
        _id: 'game-3',
        status: 'completed',
        gameType: 'ticTacToe',
        players: [{ userId: 'a' }, { userId: 'b' }],
        result: { winner: 'b', isDraw: false, winType: 'resignation' },
      },
      {
        _id: 'game-4',
        status: 'completed',
        gameType: 'checkers',
        metadata: { mode: 'multiplayer' },
        players: [{ userId: 'a' }, { userId: 'c' }],
        result: { isDraw: true, winType: 'draw' },
      },
    ])
    mockLeanFind(User as unknown as { find: jest.Mock }, [
      { _id: 'a', stats: {} },
      { _id: 'b', stats: {} },
      { _id: 'c', stats: {} },
    ])

    await expect(runSecurityMigration([])).resolves.toEqual({
      mode: 'report-only',
      completedGames: 4,
      missingModes: 2,
      resultClassifications: { server: 2, replay: 0, unverified: 2 },
      resultClassificationsToWrite: 4,
      statsProcessedMarkersToWrite: 2,
      usersToReconcile: 3,
      usersWhoseStatsChange: 3,
    })

    expect(Game.bulkWrite).not.toHaveBeenCalled()
    expect(User.bulkWrite).not.toHaveBeenCalled()
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1)
  })

  it('writes conservative classifications and verified-only aggregate stats in guarded apply mode', async () => {
    const completedAt = new Date('2026-01-02T03:04:05.000Z')
    mockLeanFind(Game as unknown as { find: jest.Mock }, [
      {
        _id: 'game-1',
        status: 'completed',
        gameType: 'ticTacToe',
        completedAt,
        players: [{ userId: 'a' }, { userId: 'b' }],
        result: { winner: 'a', isDraw: false, winType: 'three-in-a-row' },
      },
      {
        _id: 'game-2',
        status: 'completed',
        gameType: 'mazeChase',
        metadata: { mode: 'singlePlayer' },
        players: [{ userId: 'a' }],
        result: { winner: 'a', isDraw: false, winType: 'score:999999' },
      },
    ])
    mockLeanFind(User as unknown as { find: jest.Mock }, [
      { _id: 'a', stats: { gamesPlayed: 99, gamesWon: 99 } },
      { _id: 'b', stats: { gamesPlayed: 99, gamesWon: 99 } },
    ])

    await runSecurityMigration(['--apply', '--backup-confirmed'])

    expect(Game.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'game-1' },
          update: {
            $set: {
              'metadata.mode': 'multiplayer',
              'result.verification': 'server',
              statsProcessedAt: completedAt,
            },
          },
        },
      },
      {
        updateOne: {
          filter: { _id: 'game-2' },
          update: { $set: { 'result.verification': 'unverified' } },
        },
      },
    ])
    expect(User.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'a' },
          update: {
            $set: {
              stats: { gamesPlayed: 1, gamesWon: 1, gamesLost: 0, gamesDraw: 0, winRate: 1 },
            },
          },
        },
      },
      {
        updateOne: {
          filter: { _id: 'b' },
          update: {
            $set: {
              stats: { gamesPlayed: 1, gamesWon: 0, gamesLost: 1, gamesDraw: 0, winRate: 0 },
            },
          },
        },
      },
    ])
    expect(redisDelMany).toHaveBeenCalledWith(expect.arrayContaining([
      'stats:a',
      'stats:b',
      'leaderboard:v2:global',
      'leaderboard:v2:ticTacToe',
      'leaderboard:v2:singlePlayer:mazeChase',
    ]))
    expect(closeRedisClient).toHaveBeenCalledTimes(1)
  })
})
