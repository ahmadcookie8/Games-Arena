import jwt from 'jsonwebtoken'
import { Response } from 'express'
import { config } from '../config'
import {
  AUTH_COOKIE_MAX_AGE_MS,
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  getAuthTokenFromCookie,
  setAuthCookie,
  signAuthToken,
  verifyAuthToken,
} from './authToken'

const USER_ID = '507f1f77bcf86cd799439011'

describe('authToken', () => {
  it('signs a seven-day, fixed-algorithm token with registered claims and authVersion', () => {
    const token = signAuthToken({ userId: USER_ID, username: 'alice', authVersion: 4 })
    const decoded = jwt.decode(token, { complete: true })
    const verified = verifyAuthToken(token)

    expect(decoded?.header.alg).toBe('HS256')
    expect(verified).toEqual(expect.objectContaining({
      userId: USER_ID,
      username: 'alice',
      authVersion: 4,
      jti: expect.any(String),
    }))
    expect(verified.exp - verified.iat).toBe(7 * 24 * 60 * 60)
  })

  it('rejects tokens without the fixed issuer, audience, and claim shape', () => {
    const legacyToken = jwt.sign({ userId: USER_ID, username: 'alice' }, config.jwtSecret, { expiresIn: '7d' })
    expect(() => verifyAuthToken(legacyToken)).toThrow()
  })

  it('extracts only the configured cookie and safely ignores malformed values', () => {
    expect(getAuthTokenFromCookie(`other=value; ${AUTH_COOKIE_NAME}=signed.token.value`)).toBe('signed.token.value')
    expect(getAuthTokenFromCookie(`${AUTH_COOKIE_NAME}=%E0%A4%A`)).toBeNull()
    expect(getAuthTokenFromCookie(`${AUTH_COOKIE_NAME}=${'x'.repeat(4097)}`)).toBeNull()
    expect(getAuthTokenFromCookie()).toBeNull()
  })

  it('sets and clears a host-only, HttpOnly, strict seven-day cookie', () => {
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response

    setAuthCookie(response, 'token')
    clearAuthCookie(response)

    expect(response.cookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, 'token', {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.isProduction,
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
      path: '/',
    })
    expect(response.clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.isProduction,
      path: '/',
    })
  })
})
