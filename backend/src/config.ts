import dotenv from 'dotenv'
import { randomBytes } from 'crypto'

dotenv.config()

const allowedNodeEnvironments = ['development', 'test', 'production'] as const
type NodeEnvironment = (typeof allowedNodeEnvironments)[number]

function getNodeEnvironment(): NodeEnvironment {
  const value = process.env.NODE_ENV?.trim() || 'development'
  if (!allowedNodeEnvironments.includes(value as NodeEnvironment)) {
    throw new Error(`NODE_ENV must be one of: ${allowedNodeEnvironments.join(', ')}`)
  }
  return value as NodeEnvironment
}

const nodeEnv = getNodeEnvironment()
const isProduction = nodeEnv === 'production'
const CANONICAL_PRODUCTION_ORIGIN = 'https://games.penguincookie.ca'

function requireProductionValue(name: string, fallback = ''): string {
  const value = process.env[name]?.trim()
  if (value) return value
  if (isProduction) throw new Error(`${name} is required in production`)
  return fallback
}

function parsePositiveInteger(name: string, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const rawValue = process.env[name]?.trim()
  if (!rawValue) return fallback

  const value = Number(rawValue)
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}`)
  }
  return value
}

function parseTimestamp(name: string, fallback: string): number {
  const value = process.env[name]?.trim() || fallback
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error(`${name} must be an ISO-8601 timestamp`)
  return timestamp
}

function getJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET?.trim()
  if (!configuredSecret) {
    if (isProduction) throw new Error('JWT_SECRET is required in production')

    // Development and test processes get an ephemeral secret instead of sharing a
    // checked-in credential. Sessions intentionally expire when the process restarts.
    return randomBytes(32).toString('base64url')
  }

  if (isProduction && Buffer.byteLength(configuredSecret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must contain at least 32 bytes in production')
  }

  return configuredSecret
}

function getCorsOrigin(): string {
  const origin = requireProductionValue('CORS_ORIGIN', 'http://localhost:5173')
  let parsed: URL

  try {
    parsed = new URL(origin)
  } catch {
    throw new Error('CORS_ORIGIN must be an absolute origin URL')
  }

  if (parsed.origin !== origin || parsed.username || parsed.password) {
    throw new Error('CORS_ORIGIN must contain only scheme, hostname, and optional port')
  }
  if (isProduction && parsed.protocol !== 'https:') {
    throw new Error('CORS_ORIGIN must use HTTPS in production')
  }
  if (isProduction && origin !== CANONICAL_PRODUCTION_ORIGIN) {
    throw new Error(`CORS_ORIGIN must be ${CANONICAL_PRODUCTION_ORIGIN} in production`)
  }

  return origin
}

export const config = {
  nodeEnv,
  isProduction,
  port: parsePositiveInteger('PORT', 3000, 65535),
  mongodbUri: requireProductionValue('MONGODB_URI'),
  redisUrl: requireProductionValue('REDIS_URL', 'redis://localhost:6379'),
  jwtSecret: getJwtSecret(),
  corsOrigin: getCorsOrigin(),
  logLevel: process.env.LOG_LEVEL || 'debug',
  // Six-character room codes predate cryptographic invite codes. They remain
  // usable only for this finite migration window unless operators shorten it.
  legacyGameCodeCutoff: parseTimestamp('LEGACY_GAME_CODE_CUTOFF', '2026-10-15T00:00:00.000Z'),
}
