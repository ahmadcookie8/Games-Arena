jest.mock('../services/sessionAuthService', () => ({
  authenticateSessionPayload: jest.fn(),
}))

import { NextFunction, Response } from 'express'
import { authenticateSessionPayload } from '../services/sessionAuthService'
import { UnauthorizedError } from '../utils/errors'
import { AUTH_COOKIE_NAME, signAuthToken, verifyAuthToken } from '../utils/authToken'
import { AuthRequest, authMiddleware } from './auth'

const USER_ID = '507f1f77bcf86cd799439011'
const authenticate = authenticateSessionPayload as jest.Mock

function response(): Response {
  return { clearCookie: jest.fn() } as unknown as Response
}

describe('authMiddleware', () => {
  beforeEach(() => jest.clearAllMocks())

  it('ignores bearer credentials and requires the HttpOnly cookie', async () => {
    const req = { headers: { authorization: 'Bearer attacker-token' } } as AuthRequest
    const next = jest.fn() as NextFunction

    await authMiddleware(req, response(), next)

    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError)
    expect(authenticate).not.toHaveBeenCalled()
  })

  it('attaches a currently active session to the request', async () => {
    const token = signAuthToken({ userId: USER_ID, username: 'alice', authVersion: 3 })
    const activeSession = verifyAuthToken(token)
    authenticate.mockResolvedValue(activeSession)
    const req = { headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` } } as AuthRequest
    const next = jest.fn() as NextFunction

    await authMiddleware(req, response(), next)

    expect(req.user).toEqual(activeSession)
    expect(next).toHaveBeenCalledWith()
  })

  it('clears an invalid signed cookie', async () => {
    const res = response()
    const req = { headers: { cookie: `${AUTH_COOKIE_NAME}=invalid` } } as AuthRequest
    const next = jest.fn() as NextFunction

    await authMiddleware(req, res, next)

    expect(res.clearCookie).toHaveBeenCalled()
    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError)
  })
})
