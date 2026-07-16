import Redis from 'ioredis'
import { config } from '../config'
import { logSecurityEvent } from './securityLogger'

let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl)
    redisClient.on('error', (err) => logSecurityEvent('redis.failure', { errorName: err.name }, 'error'))
    redisClient.on('connect', () => logSecurityEvent('redis.connected', {}, 'info'))
  }
  return redisClient
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient()
  const value = await client.get(key)
  return value ? JSON.parse(value) : null
}

export async function redisSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const client = getRedisClient()
  const serialized = JSON.stringify(value)
  if (ttlSeconds) {
    await client.setex(key, ttlSeconds, serialized)
  } else {
    await client.set(key, serialized)
  }
}

export async function redisDel(key: string): Promise<void> {
  const client = getRedisClient()
  await client.del(key)
}

export async function redisDelMany(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const client = getRedisClient()
  const uniqueKeys = [...new Set(keys)]
  for (let index = 0; index < uniqueKeys.length; index += 500) {
    await client.del(...uniqueKeys.slice(index, index + 500))
  }
}

export async function closeRedisClient(): Promise<void> {
  const client = redisClient
  redisClient = null
  if (!client) return
  try {
    await client.quit()
  } catch {
    client.disconnect()
  }
}

export async function redisIsConnected(): Promise<boolean> {
  try {
    const client = getRedisClient()
    await client.ping()
    return true
  } catch {
    return false
  }
}
