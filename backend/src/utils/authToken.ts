import { Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { AuthPayload } from '../types/api'

export const AUTH_COOKIE_NAME = 'games_arena_token'
export const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {}

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (!rawName || rawValue.length === 0) return cookies
    cookies[rawName] = decodeURIComponent(rawValue.join('='))
    return cookies
  }, {})
}

export function signAuthToken(payload: Pick<AuthPayload, 'userId' | 'username'>): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' })
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: '/',
  })
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
  })
}

export function getTokenFromHeaders(authorization?: string, cookieHeader?: string): string | null {
  const cookies = parseCookies(cookieHeader)
  if (cookies[AUTH_COOKIE_NAME]) return cookies[AUTH_COOKIE_NAME]

  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7)
  }

  return null
}

export function verifyAuthToken(token: string): AuthPayload {
  return jwt.verify(token, config.jwtSecret) as AuthPayload
}
