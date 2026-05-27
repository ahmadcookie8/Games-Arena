import { User } from '../models/User'
import { Game } from '../models/Game'
import { redisDel, redisGet, redisSet } from '../utils/redis'

const STATS_TTL = 30 * 60 // 30 minutes
const LEADERBOARD_TTL = 60 * 60 // 1 hour
const GLOBAL_LEADERBOARD_CACHE_KEY = 'leaderboard:global'

export interface LeaderboardEntry {
  rank: number
  username: string
  wins: number
  losses: number
  winRate: number
}

interface CompletedGameForLeaderboard {
  players: Array<{
    userId: { toString(): string } | string
    username: string
  }>
  result?: {
    winner?: { toString(): string } | string
    winnerName?: string
    isDraw: boolean
  }
}

interface UpdateStatsAfterGameOptions {
  winnerId?: string
  loserIds?: string[]
  drawPlayerIds?: string[]
}

export function buildGlobalLeaderboard(games: CompletedGameForLeaderboard[]): LeaderboardEntry[] {
  const statsByUser = new Map<string, { username: string; wins: number; losses: number; gamesPlayed: number }>()

  for (const game of games) {
    if (!game.result || game.result.isDraw || !game.result.winner) {
      continue
    }

    const winnerId = String(game.result.winner)
    const winnerPlayer = game.players.find((player) => String(player.userId) === winnerId)
    const winnerUsername = game.result.winnerName || winnerPlayer?.username || 'Unknown player'
    const winnerStats = statsByUser.get(winnerId) || { username: winnerUsername, wins: 0, losses: 0, gamesPlayed: 0 }

    winnerStats.username = winnerUsername
    winnerStats.wins += 1
    winnerStats.gamesPlayed += 1
    statsByUser.set(winnerId, winnerStats)

    for (const player of game.players) {
      const playerId = String(player.userId)
      if (playerId === winnerId) {
        continue
      }

      const loserStats = statsByUser.get(playerId) || { username: player.username, wins: 0, losses: 0, gamesPlayed: 0 }
      loserStats.username = player.username
      loserStats.losses += 1
      loserStats.gamesPlayed += 1
      statsByUser.set(playerId, loserStats)
    }
  }

  return Array.from(statsByUser.values())
    .sort((left, right) => {
      if (right.wins !== left.wins) return right.wins - left.wins
      if (left.losses !== right.losses) return left.losses - right.losses
      return left.username.localeCompare(right.username)
    })
    .map((entry, index) => ({
      rank: index + 1,
      username: entry.username,
      wins: entry.wins,
      losses: entry.losses,
      winRate: entry.gamesPlayed > 0 ? entry.wins / entry.gamesPlayed : 0,
    }))
}

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

  async getGlobalLeaderboard(limit: number, page: number) {
    const cached = await redisGet<LeaderboardEntry[]>(GLOBAL_LEADERBOARD_CACHE_KEY)
    if (cached) {
      const start = (page - 1) * limit
      return cached.slice(start, start + limit)
    }

    const games = await Game.find({ status: 'completed', 'result.isDraw': false, 'result.winner': { $exists: true } })
      .select('players result')
      .lean()

    const leaderboard = buildGlobalLeaderboard(games)
    await redisSet(GLOBAL_LEADERBOARD_CACHE_KEY, leaderboard, LEADERBOARD_TTL)

    const start = (page - 1) * limit
    return leaderboard.slice(start, start + limit)
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

    await redisSet(cacheKey, leaderboard, LEADERBOARD_TTL)
    const start = (page - 1) * limit
    return leaderboard.slice(start, start + limit)
  }

  async updateStatsAfterGame({ winnerId, loserIds = [], drawPlayerIds = [] }: UpdateStatsAfterGameOptions): Promise<void> {
    const participantIds = new Set<string>()

    if (drawPlayerIds.length > 0) {
      for (const playerId of drawPlayerIds) {
        participantIds.add(playerId)
      }
      await User.updateMany({ _id: { $in: drawPlayerIds } }, { $inc: { 'stats.gamesPlayed': 1, 'stats.gamesDraw': 1 } })
    } else if (winnerId) {
      participantIds.add(winnerId)
      await User.findByIdAndUpdate(winnerId, { $inc: { 'stats.gamesPlayed': 1, 'stats.gamesWon': 1 } })

      const uniqueLoserIds = [...new Set(loserIds.filter((loserId) => loserId && loserId !== winnerId))]
      if (uniqueLoserIds.length > 0) {
        uniqueLoserIds.forEach((loserId) => participantIds.add(loserId))
        await User.updateMany({ _id: { $in: uniqueLoserIds } }, { $inc: { 'stats.gamesPlayed': 1, 'stats.gamesLost': 1 } })
      }
    }

    for (const id of participantIds) {
      const user = await User.findById(id)
      if (user && user.stats.gamesPlayed > 0) {
        user.stats.winRate = user.stats.gamesWon / user.stats.gamesPlayed
        await user.save()
      }

      await redisDel(`stats:${id}`)
    }

    await redisDel(GLOBAL_LEADERBOARD_CACHE_KEY)
  }

  async invalidateLeaderboardCache(gameType: string): Promise<void> {
    await Promise.all([redisDel(GLOBAL_LEADERBOARD_CACHE_KEY), redisDel(`leaderboard:${gameType}`)])
  }
}

export const userService = new UserService()
