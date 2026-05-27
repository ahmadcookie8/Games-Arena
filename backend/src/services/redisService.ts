import { getRedisClient } from '../utils/redis'

export const KEYS = {
  game: (gameType: string, gameId: string) => `game:${gameType}:${gameId}`,
  session: (userId: string, socketId: string) => `session:${userId}:${socketId}`,
  onlineUsers: 'online:users',
  leaderboard: (gameType: string) => `leaderboard:${gameType}`,
  stats: (userId: string) => `stats:${userId}`,
  queue: (gameType: string) => `queue:${gameType}`,
}

class RedisService {
  private get client() {
    return getRedisClient()
  }

  async addOnlineUser(userId: string): Promise<void> {
    await this.client.sadd(KEYS.onlineUsers, userId)
    await this.client.expire(KEYS.onlineUsers, 24 * 60 * 60)
  }

  async removeOnlineUser(userId: string): Promise<void> {
    await this.client.srem(KEYS.onlineUsers, userId)
  }

  async getOnlineUsers(): Promise<string[]> {
    return this.client.smembers(KEYS.onlineUsers)
  }

  async setSession(userId: string, socketId: string, data: Record<string, unknown>): Promise<void> {
    const key = KEYS.session(userId, socketId)
    await this.client.set(key, JSON.stringify(data), 'EX', 7 * 24 * 60 * 60)
  }

  async deleteSession(userId: string, socketId: string): Promise<void> {
    await this.client.del(KEYS.session(userId, socketId))
  }

  async updateLeaderboard(gameType: string, username: string, wins: number): Promise<void> {
    await this.client.zadd(KEYS.leaderboard(gameType), wins, username)
    await this.client.expire(KEYS.leaderboard(gameType), 60 * 60)
  }
}

export const redisService = new RedisService()
