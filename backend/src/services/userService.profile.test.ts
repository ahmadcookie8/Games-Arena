jest.mock('../models/User', () => ({
  User: { findById: jest.fn() },
}))

jest.mock('../models/Game', () => ({
  Game: { find: jest.fn(), aggregate: jest.fn() },
}))

jest.mock('../utils/redis', () => ({
  redisDel: jest.fn(),
  redisGet: jest.fn(),
  redisSet: jest.fn(),
}))

import { Game } from '../models/Game'
import { User } from '../models/User'
import { userService } from './userService'

describe('userService.getUserProfile', () => {
  it('returns only the intentionally public profile fields and never loads game history', async () => {
    const publicUser = {
      _id: '507f1f77bcf86cd799439011',
      username: 'alice',
      stats: { gamesPlayed: 3, gamesWon: 2 },
      createdAt: new Date('2025-01-01T00:00:00Z'),
      email: 'must-not-leak@example.com',
      preferences: { theme: 'dark' },
      lastSeenAt: new Date(),
    }
    const lean = jest.fn().mockResolvedValue(publicUser)
    const select = jest.fn().mockReturnValue({ lean })
    ;(User.findById as jest.Mock).mockReturnValue({ select })

    await expect(userService.getUserProfile(publicUser._id)).resolves.toEqual({
      _id: publicUser._id,
      username: publicUser.username,
      stats: publicUser.stats,
      createdAt: publicUser.createdAt,
    })
    expect(select).toHaveBeenCalledWith('_id username stats createdAt')
    expect(Game.find).not.toHaveBeenCalled()
  })
})
