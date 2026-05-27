import { User } from '../models/User'
import { Game } from '../models/Game'
import { redisGet, redisSet } from '../utils/redis'

const STATS_TTL = 30 * 60 // 30 minutes

class UserService {
  async getUserProfile(userId: string) {
    const user = await User.findById(userId).select('-passwordHash')
    if (!user) return null

    const recentGames = await Game.find({ 'players.userId': userId, status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(10)

    return { user, stats: user.stats, recentGames }
  }

  async getUserStats(userId: string) {
    const cacheKey = `stats:${userId}`
    const cached = await redisGet(cacheKey)
    if (cached) return cached

    const user = await User.findById(userId).select('username stats')
    if (!user) return null

    const stats = {
      userId,
      username: user.username,
      ...user.stats,
      lastUpdated: new Date().toISOString(),
    }

    await redisSet(cacheKey, stats, STATS_TTL)
    return stats
  }

  async getGlobalLeaderboard() {
    const users = await User.find({ 'stats.gamesPlayed': { $gt: 0 } })
      .sort({ 'stats.gamesWon': -1 })
      .limit(10)
      .select('username stats')

    return {
      global: users.map((u, i) => ({
        rank: i + 1,
        username: u.username,
        wins: u.stats.gamesWon,
        losses: u.stats.gamesLost,
        winRate: u.stats.winRate,
      })),
    }
  }

  async getLeaderboardByGameType(gameType: string, limit: number, page: number) {
    const cacheKey = `leaderboard:${gameType}`
    const cached = await redisGet<unknown[]>(cacheKey)
    if (cached) {
      const start = (page - 1) * limit
      return cached.slice(start, start + limit)
    }

    // Build leaderboard from completed games for this type
    const results = await Game.aggregate([
      { $match: { gameType, status: 'completed', 'result.isDraw': false } },
      { $group: { _id: '$result.winner', wins: { $sum: 1 }, winnerName: { $first: '$result.winnerName' } } },
      { $sort: { wins: -1 } },
      { $limit: 100 },
    ])

    const leaderboard = results.map((r, i) => ({
      rank: i + 1,
      username: r.winnerName,
      wins: r.wins,
      losses: 0,
      winRate: 0,
    }))

    await redisSet(cacheKey, leaderboard, 60 * 60) // 1 hour TTL
    const start = (page - 1) * limit
    return leaderboard.slice(start, start + limit)
  }

  async updateStatsAfterGame(winnerId: string, loserId?: string, isDraw = false): Promise<void> {
    if (isDraw) {
      await User.updateMany({ _id: { $in: [winnerId, loserId] } }, { $inc: { 'stats.gamesPlayed': 1, 'stats.gamesDraw': 1 } })
    } else {
      await User.findByIdAndUpdate(winnerId, { $inc: { 'stats.gamesPlayed': 1, 'stats.gamesWon': 1 } })
      if (loserId) {
        await User.findByIdAndUpdate(loserId, { $inc: { 'stats.gamesPlayed': 1, 'stats.gamesLost': 1 } })
      }
    }

    // Recalculate win rates
    for (const id of [winnerId, loserId].filter(Boolean)) {
      const user = await User.findById(id)
      if (user && user.stats.gamesPlayed > 0) {
        user.stats.winRate = user.stats.gamesWon / user.stats.gamesPlayed
        await user.save()
      }
    }
  }
}

export const userService = new UserService()
