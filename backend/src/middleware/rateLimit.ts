import { createHash } from 'crypto'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AuthRequest } from './auth'
import { getRedisClient } from '../utils/redis'
import { AppError, UnauthorizedError } from '../utils/errors'
import { logSecurityEvent } from '../utils/securityLogger'

const FIXED_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  ttl = tonumber(ARGV[2])
end
local allowed = 1
if current > tonumber(ARGV[1]) then allowed = 0 end
return { allowed, current, ttl }
`

const CONCURRENCY_SCRIPT = `
local now = tonumber(ARGV[1])
local cutoff = now - (tonumber(ARGV[4]) * 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', cutoff)

if redis.call('ZSCORE', KEYS[1], ARGV[2]) then
  redis.call('ZADD', KEYS[1], now, ARGV[2])
  redis.call('EXPIRE', KEYS[1], ARGV[4])
  return { 1, redis.call('ZCARD', KEYS[1]) }
end

local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[3]) then return { 0, count } end

redis.call('ZADD', KEYS[1], now, ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return { 1, count + 1 }
`

export const RATE_LIMIT_POLICIES = {
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
} as const

export interface RateLimitPolicy {
  scope: string
  limit: number
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterSeconds: number
}

interface RedisRateLimitMiddlewareOptions extends RateLimitPolicy {
  identify: (req: Request) => string | null
}

function assertPolicy(policy: RateLimitPolicy): void {
  if (!/^[a-z0-9-]+$/.test(policy.scope)) throw new Error('Invalid rate-limit scope')
  if (!Number.isSafeInteger(policy.limit) || policy.limit <= 0) throw new Error('Invalid rate-limit limit')
  if (!Number.isSafeInteger(policy.windowSeconds) || policy.windowSeconds <= 0) {
    throw new Error('Invalid rate-limit window')
  }
}

function digestIdentity(identity: string): string {
  return createHash('sha256').update(identity).digest('hex')
}

function rateLimitKey(scope: string, identity: string): string {
  return `rate-limit:${scope}:${digestIdentity(identity)}`
}

export function getRequestIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown'
}

export async function consumeRedisRateLimit(policy: RateLimitPolicy, identity: string): Promise<RateLimitResult> {
  assertPolicy(policy)
  const result = await getRedisClient().eval(
    FIXED_WINDOW_SCRIPT,
    1,
    rateLimitKey(policy.scope, identity),
    policy.limit,
    policy.windowSeconds
  ) as [number, number, number]

  const allowed = Number(result[0]) === 1
  const current = Number(result[1])
  const retryAfterSeconds = Math.max(1, Number(result[2]) || policy.windowSeconds)

  return {
    allowed,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - current),
    retryAfterSeconds,
  }
}

export function createRedisRateLimitMiddleware(options: RedisRateLimitMiddlewareOptions): RequestHandler {
  assertPolicy(options)

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identity = options.identify(req)
    if (!identity) {
      next(new UnauthorizedError('Authentication required'))
      return
    }

    let result: RateLimitResult
    try {
      result = await consumeRedisRateLimit(options, identity)
    } catch (err) {
      logSecurityEvent('rate_limit.backend_unavailable', {
        scope: options.scope,
        errorName: err instanceof Error ? err.name : 'UnknownError',
      }, 'error')
      next(new AppError('Service temporarily unavailable', 503, 'RATE_LIMIT_UNAVAILABLE'))
      return
    }

    res.setHeader('RateLimit-Limit', String(result.limit))
    res.setHeader('RateLimit-Remaining', String(result.remaining))

    if (!result.allowed) {
      logSecurityEvent('rate_limit.exceeded', {
        scope: options.scope,
        ip: getRequestIp(req),
      })
      res.setHeader('Retry-After', String(result.retryAfterSeconds))
      next(new AppError('Too many requests', 429, 'RATE_LIMITED'))
      return
    }

    next()
  }
}

function authUserId(req: Request): string | null {
  return (req as AuthRequest).user?.userId || null
}

function normalizedLoginIdentifier(req: Request): string {
  const identifier = req.body && typeof req.body.identifier === 'string'
    ? req.body.identifier.trim().toLowerCase()
    : '<invalid>'
  return identifier || '<invalid>'
}

export const loginIdentifierRateLimit = createRedisRateLimitMiddleware({
  ...RATE_LIMIT_POLICIES.loginIdentifier,
  identify: normalizedLoginIdentifier,
})

export const loginIpRateLimit = createRedisRateLimitMiddleware({
  ...RATE_LIMIT_POLICIES.loginIp,
  identify: getRequestIp,
})

export const signupIpRateLimit = createRedisRateLimitMiddleware({
  ...RATE_LIMIT_POLICIES.signupIp,
  identify: getRequestIp,
})

export const createGameRateLimit = createRedisRateLimitMiddleware({
  ...RATE_LIMIT_POLICIES.createGameUser,
  identify: authUserId,
})

export const joinGameRateLimit = createRedisRateLimitMiddleware({
  ...RATE_LIMIT_POLICIES.joinGameUser,
  identify: authUserId,
})

export const gameMutationRateLimit = createRedisRateLimitMiddleware({
  ...RATE_LIMIT_POLICIES.gameMutationUser,
  identify: authUserId,
})

export const replayVerificationRateLimit = createRedisRateLimitMiddleware({
  ...RATE_LIMIT_POLICIES.replayVerificationUser,
  identify: authUserId,
})

export async function acquireRedisConcurrencySlot(
  scope: string,
  identity: string,
  slotId: string,
  limit: number,
  ttlSeconds = 24 * 60 * 60
): Promise<{ allowed: boolean; count: number }> {
  assertPolicy({ scope, limit, windowSeconds: ttlSeconds })
  if (!slotId || slotId.length > 256) throw new Error('Invalid concurrency slot')

  const result = await getRedisClient().eval(
    CONCURRENCY_SCRIPT,
    1,
    rateLimitKey(`${scope}-concurrent`, identity),
    Date.now(),
    slotId,
    limit,
    ttlSeconds
  ) as [number, number]

  return { allowed: Number(result[0]) === 1, count: Number(result[1]) }
}

export async function releaseRedisConcurrencySlot(scope: string, identity: string, slotId: string): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(scope) || !slotId) return
  await getRedisClient().zrem(rateLimitKey(`${scope}-concurrent`, identity), slotId)
}
