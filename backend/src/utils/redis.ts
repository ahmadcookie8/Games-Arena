import Redis from 'ioredis'
import { config } from '../config'

let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl)
    redisClient.on('error', (err) => console.error('Redis error:', err))
    redisClient.on('connect', () => console.log('Redis connected'))
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

export async function redisIsConnected(): Promise<boolean> {
  try {
    const client = getRedisClient()
    await client.ping()
    return true
  } catch {
    return false
  }
}
