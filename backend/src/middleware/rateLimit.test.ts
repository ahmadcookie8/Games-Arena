const evalMock = jest.fn()
const zremMock = jest.fn()

jest.mock('../utils/redis', () => ({
  getRedisClient: () => ({ eval: evalMock, zrem: zremMock }),
}))

import { NextFunction, Request, Response } from 'express'
import { AppError } from '../utils/errors'
import {
  consumeRedisRateLimit,
  createRedisRateLimitMiddleware,
  RATE_LIMIT_POLICIES,
} from './rateLimit'

describe('Redis rate limiting', () => {
  beforeEach(() => jest.clearAllMocks())

  it('keeps every public security threshold at the reviewed value', () => {
    expect(RATE_LIMIT_POLICIES).toEqual({
      loginIdentifier: { scope: 'auth-login-identifier', limit: 5, windowSeconds: 15 * 60 },
      loginIp: { scope: 'auth-login-ip', limit: 30, windowSeconds: 15 * 60 },
      signupIp: { scope: 'auth-signup-ip', limit: 5, windowSeconds: 60 * 60 },
      createGameUser: { scope: 'game-create-user', limit: 10, windowSeconds: 60 * 60 },
      joinGameUser: { scope: 'game-join-user', limit: 30, windowSeconds: 15 * 60 },
      gameMutationUser: { scope: 'game-mutation-user', limit: 60, windowSeconds: 60 },
      replayVerificationUser: { scope: 'replay-verification-user', limit: 5, windowSeconds: 60 },
      socketHandshakeIp: { scope: 'socket-handshake-ip', limit: 20, windowSeconds: 60 },
      socketEventUser: { scope: 'socket-event-user', limit: 120, windowSeconds: 60 },
      socketChatUser: { scope: 'socket-chat-user', limit: 20, windowSeconds: 60 },
      socketMoveUser: { scope: 'socket-move-user', limit: 60, windowSeconds: 60 },
    })
  })

  it('uses an atomic script and hashes identities stored in Redis keys', async () => {
    evalMock.mockResolvedValue([1, 2, 60])

    await expect(consumeRedisRateLimit(
      { scope: 'test-policy', limit: 5, windowSeconds: 60 },
      'alice@example.com'
    )).resolves.toEqual({ allowed: true, limit: 5, remaining: 3, retryAfterSeconds: 60 })

    const redisKey = evalMock.mock.calls[0][2]
    expect(redisKey).toMatch(/^rate-limit:test-policy:[a-f0-9]{64}$/)
    expect(redisKey).not.toContain('alice@example.com')
  })

  it('allows the request at the exact limit and rejects the next request', async () => {
    evalMock
      .mockResolvedValueOnce([1, 5, 900])
      .mockResolvedValueOnce([0, 6, 899])

    await expect(consumeRedisRateLimit(
      RATE_LIMIT_POLICIES.loginIdentifier,
      'alice@example.com'
    )).resolves.toEqual({ allowed: true, limit: 5, remaining: 0, retryAfterSeconds: 900 })

    await expect(consumeRedisRateLimit(
      RATE_LIMIT_POLICIES.loginIdentifier,
      'alice@example.com'
    )).resolves.toEqual({ allowed: false, limit: 5, remaining: 0, retryAfterSeconds: 899 })

    expect(evalMock.mock.calls[0].slice(3)).toEqual([5, 900])
  })

  it('returns a sanitized 429 with Retry-After when the limit is exhausted', async () => {
    evalMock.mockResolvedValue([0, 6, 42])
    const middleware = createRedisRateLimitMiddleware({
      scope: 'test-policy',
      limit: 5,
      windowSeconds: 60,
      identify: () => 'identity',
    })
    const res = { setHeader: jest.fn() } as unknown as Response
    const next = jest.fn() as NextFunction

    await middleware({ ip: '127.0.0.1' } as Request, res, next)

    const error = next.mock.calls[0][0] as AppError
    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(429)
    expect(error.code).toBe('RATE_LIMITED')
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '42')
  })

  it('rejects a missing authenticated identity without consulting Redis', async () => {
    const middleware = createRedisRateLimitMiddleware({
      scope: 'authenticated-policy',
      limit: 5,
      windowSeconds: 60,
      identify: () => null,
    })
    const next = jest.fn() as NextFunction

    await middleware({} as Request, {} as Response, next)

    const error = next.mock.calls[0][0] as AppError
    expect(error.statusCode).toBe(401)
    expect(error.code).toBe('UNAUTHORIZED')
    expect(evalMock).not.toHaveBeenCalled()
  })

  it('fails closed with a 503 when Redis is unavailable', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    evalMock.mockRejectedValue(new Error('connection failed'))
    const middleware = createRedisRateLimitMiddleware({
      scope: 'test-policy',
      limit: 5,
      windowSeconds: 60,
      identify: () => 'identity',
    })
    const res = { setHeader: jest.fn() } as unknown as Response
    const next = jest.fn() as NextFunction

    await middleware({} as Request, res, next)

    const error = next.mock.calls[0][0] as AppError
    expect(error.statusCode).toBe(503)
    expect(error.code).toBe('RATE_LIMIT_UNAVAILABLE')
    consoleError.mockRestore()
  })
})
