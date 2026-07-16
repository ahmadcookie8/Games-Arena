jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    compare: jest.fn(),
    hash: jest.fn(),
  },
}))

jest.mock('../models/User', () => ({
  User: {
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}))

jest.mock('../services/socketNotifier', () => ({
  disconnectUserSockets: jest.fn(),
}))

import bcrypt from 'bcrypt'
import { NextFunction, Request, Response } from 'express'
import { User } from '../models/User'
import { AuthRequest } from '../middleware/auth'
import { disconnectUserSockets } from '../services/socketNotifier'
import { login, logout, signup } from './authController'

const USER_ID = '507f1f77bcf86cd799439011'
const user = {
  _id: USER_ID,
  username: 'alice',
  email: 'alice@example.com',
  passwordHash: 'hash',
  authVersion: 0,
  stats: { gamesPlayed: 0 },
  preferences: { theme: 'dark' },
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
}

function response() {
  const res = {
    clearCookie: jest.fn(),
    cookie: jest.fn(),
    json: jest.fn(),
    status: jest.fn(),
  }
  res.status.mockReturnValue(res)
  return res as unknown as Response
}

describe('authController session contracts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns signup user data without exposing the JWT', async () => {
    const lean = jest.fn().mockResolvedValue(null)
    const select = jest.fn().mockReturnValue({ lean })
    ;(User.findOne as jest.Mock).mockReturnValue({ select })
    ;(User.create as jest.Mock).mockResolvedValue(user)
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hash')
    const req = { body: { username: 'Alice', password: 'password123' } } as Request
    const res = response()
    const next = jest.fn() as NextFunction

    await signup(req, res, next)

    expect(res.cookie).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ user: expect.objectContaining({ _id: USER_ID, username: 'alice' }) })
    expect((res.json as jest.Mock).mock.calls[0][0]).not.toHaveProperty('token')
    expect(next).not.toHaveBeenCalled()
  })

  it('does not disclose whether the signup username or email is already registered', async () => {
    const lean = jest.fn().mockResolvedValue({ _id: USER_ID })
    const select = jest.fn().mockReturnValue({ lean })
    ;(User.findOne as jest.Mock).mockReturnValue({ select })
    const req = { body: { username: 'Alice', email: 'alice@example.com', password: 'password123' } } as Request
    const res = response()
    const next = jest.fn() as NextFunction

    await signup(req, res, next)

    expect(User.findOne).toHaveBeenCalledWith({
      $or: [{ username: 'alice' }, { email: 'alice@example.com' }],
    })
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      message: 'An account cannot be created with those details',
    }))
  })

  it('requires an active account and returns login user data without the JWT', async () => {
    const select = jest.fn().mockResolvedValue(user)
    ;(User.findOne as jest.Mock).mockReturnValue({ select })
    ;(User.findByIdAndUpdate as jest.Mock).mockResolvedValue(user)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
    const req = { body: { identifier: 'ALICE', password: 'password123' } } as Request
    const res = response()
    const next = jest.fn() as NextFunction

    await login(req, res, next)

    expect(User.findOne).toHaveBeenCalledWith({
      isActive: true,
      $or: [{ username: 'alice' }, { email: 'alice' }],
    })
    expect(res.json).toHaveBeenCalledWith({ user: expect.objectContaining({ _id: USER_ID, username: 'alice' }) })
    expect((res.json as jest.Mock).mock.calls[0][0]).not.toHaveProperty('token')
  })

  it('performs the same bcrypt work for an unknown login identifier', async () => {
    const select = jest.fn().mockResolvedValue(null)
    ;(User.findOne as jest.Mock).mockReturnValue({ select })
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
    const req = { body: { identifier: 'missing', password: 'password123' } } as Request
    const res = response()
    const next = jest.fn() as NextFunction

    await login(req, res, next)

    expect(bcrypt.compare).toHaveBeenCalledWith('password123', expect.stringMatching(/^\$2b\$12\$/))
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }))
    expect(res.json).not.toHaveBeenCalled()
  })

  it('atomically increments authVersion on logout before clearing the cookie', async () => {
    ;(User.findOneAndUpdate as jest.Mock).mockResolvedValue(user)
    const req = {
      user: { userId: USER_ID, username: 'alice', authVersion: 0, iat: 1, exp: 2, jti: 'id' },
    } as AuthRequest
    const res = response()
    const next = jest.fn() as NextFunction

    await logout(req, res, next)

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: USER_ID,
        isActive: true,
        $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }],
      },
      { $inc: { authVersion: 1 }, $set: { lastSeenAt: expect.any(Date) } }
    )
    expect(res.clearCookie).toHaveBeenCalled()
    expect(disconnectUserSockets).toHaveBeenCalledWith(USER_ID)
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })
})
