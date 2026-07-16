import { randomUUID } from 'crypto'
import { Response } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { config } from '../config'
import { AuthPayload } from '../types/api'

const AUTH_TOKEN_ALGORITHM = 'HS256' as const
const AUTH_TOKEN_ISSUER = 'games-arena-api'
const AUTH_TOKEN_AUDIENCE = 'games-arena-web'
const MAX_AUTH_TOKEN_LENGTH = 4096

export const AUTH_COOKIE_NAME = config.isProduction ? '__Host-games_arena_token' : 'games_arena_token'
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface VerifiedAuthPayload extends AuthPayload {
  authVersion: number
  iat: number
  exp: number
  jti: string
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {}

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (!rawName || rawValue.length === 0) return cookies
    try {
      cookies[rawName] = decodeURIComponent(rawValue.join('='))
    } catch {
      // Ignore malformed cookie values. Authentication will fail closed below.
    }
    return cookies
  }, {})
}

export function signAuthToken(payload: Pick<AuthPayload, 'userId' | 'username'> & { authVersion: number }): string {
  return jwt.sign(
    { username: payload.username, authVersion: payload.authVersion },
    config.jwtSecret,
    {
      algorithm: AUTH_TOKEN_ALGORITHM,
      audience: AUTH_TOKEN_AUDIENCE,
      expiresIn: '7d',
      issuer: AUTH_TOKEN_ISSUER,
      jwtid: randomUUID(),
      subject: payload.userId,
    }
  )
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: '/',
  })
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    path: '/',
  })
}

export function getAuthTokenFromCookie(cookieHeader?: string): string | null {
  const cookies = parseCookies(cookieHeader)
  const token = cookies[AUTH_COOKIE_NAME]
  if (token && token.length <= MAX_AUTH_TOKEN_LENGTH) return token

  return null
}

export function verifyAuthToken(token: string): VerifiedAuthPayload {
  const decoded = jwt.verify(token, config.jwtSecret, {
    algorithms: [AUTH_TOKEN_ALGORITHM],
    audience: AUTH_TOKEN_AUDIENCE,
    issuer: AUTH_TOKEN_ISSUER,
  })

  if (typeof decoded === 'string') throw new Error('Invalid authentication token')

  const payload = decoded as JwtPayload & { username?: unknown; authVersion?: unknown }
  if (
    typeof payload.sub !== 'string' ||
    !/^[a-f\d]{24}$/i.test(payload.sub) ||
    typeof payload.username !== 'string' ||
    payload.username.length === 0 ||
    typeof payload.authVersion !== 'number' ||
    !Number.isSafeInteger(payload.authVersion) ||
    payload.authVersion < 0 ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.jti !== 'string' ||
    payload.jti.length === 0
  ) {
    throw new Error('Invalid authentication token')
  }

  return {
    userId: payload.sub,
    username: payload.username,
    authVersion: payload.authVersion,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti,
  }
}
