jest.mock('../services/userService', () => ({
  userService: {
    getUserProfile: jest.fn(),
    getUserStats: jest.fn(),
    getGlobalLeaderboard: jest.fn(),
    getLeaderboardByGameType: jest.fn(),
    getSinglePlayerLeaderboard: jest.fn(),
  },
}))

import { NextFunction, Request, Response } from 'express'
import { userService } from '../services/userService'
import {
  getLeaderboard,
  getLeaderboardByType,
  getSinglePlayerLeaderboard,
  getUserProfile,
} from './userController'

const service = userService as unknown as {
  getUserProfile: jest.Mock
  getGlobalLeaderboard: jest.Mock
  getLeaderboardByGameType: jest.Mock
  getSinglePlayerLeaderboard: jest.Mock
}

function response(): Response {
  return { json: jest.fn() } as unknown as Response
}

describe('user controller input validation', () => {
  beforeEach(() => jest.clearAllMocks())

  it.each([
    'not-an-object-id',
    '507F1F77BCF86CD799439011',
    null,
    [],
    { $ne: null },
  ])('rejects a non-canonical public-profile id (%p) before querying', async (userId) => {
    const req = { params: { userId } } as unknown as Request
    const next = jest.fn() as NextFunction

    await getUserProfile(req, response(), next)

    expect(next).toHaveBeenCalledWith(expect.anything())
    expect(service.getUserProfile).not.toHaveBeenCalled()
  })

  it.each([
    { limit: '0' },
    { limit: '101' },
    { limit: '-1' },
    { limit: '1e2' },
    { limit: ['10'] },
    { page: '0' },
    { page: '10001' },
  ])('rejects unsafe leaderboard pagination (%p)', async (query) => {
    const req = { query } as unknown as Request
    const next = jest.fn() as NextFunction

    await getLeaderboard(req, response(), next)

    expect(next).toHaveBeenCalledWith(expect.anything())
    expect(service.getGlobalLeaderboard).not.toHaveBeenCalled()
  })

  it.each(['unknown', 'TicTacToe', { $ne: null }, [], null])(
    'rejects an invalid game-specific leaderboard type (%p)',
    async (gameType) => {
      const req = { params: { gameType }, query: {} } as unknown as Request
      const next = jest.fn() as NextFunction

      await getLeaderboardByType(req, response(), next)

      expect(next).toHaveBeenCalledWith(expect.anything())
      expect(service.getLeaderboardByGameType).not.toHaveBeenCalled()
    }
  )

  it('returns an empty verified Snake leaderboard through the bounded controller contract', async () => {
    service.getSinglePlayerLeaderboard.mockResolvedValue([])
    const req = { params: { gameType: 'snake' }, query: { limit: '10', page: '1' } } as unknown as Request
    const res = response()
    const next = jest.fn() as NextFunction

    await getSinglePlayerLeaderboard(req, res, next)

    expect(service.getSinglePlayerLeaderboard).toHaveBeenCalledWith('snake', 10, 1)
    expect(res.json).toHaveBeenCalledWith({ leaderboard: [] })
    expect(next).not.toHaveBeenCalled()
  })
})
