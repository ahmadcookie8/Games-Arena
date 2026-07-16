import { User } from '../models/User'
import { Game } from '../models/Game'
import { redisDel, redisGet, redisSet } from '../utils/redis'
import { isReplayLeaderboardEnabled, multiplayerModeFilter, replayVerifiedResultFilter, verifiedResultFilter } from '../utils/resultVerification'
import { reconcileVerifiedStats, zeroStats } from '../utils/statsReconciliation'
import { logSecurityEvent } from '../utils/securityLogger'
import { acquireRedisConcurrencySlot, releaseRedisConcurrencySlot } from '../middleware/rateLimit'
import { randomUUID } from 'crypto'

const STATS_TTL = 30 * 60 // 30 minutes
const LEADERBOARD_TTL = 60 * 60 // 1 hour
// Version the keys so a security release can never serve leaderboard entries
// cached before result verification and mode filters were introduced.
const GLOBAL_LEADERBOARD_CACHE_KEY = 'leaderboard:v2:global'

export interface LeaderboardEntry {
  rank: number
  username: string
  wins: number
  losses: number
  winRate: number
}

export interface SinglePlayerLeaderboardEntry extends LeaderboardEntry {
  gameType?: 'ticTacToe'
  difficulty?: 'easy' | 'medium' | 'hard'
  boardSize?: 'small' | 'medium' | 'large'
  wallLooping?: boolean
  score?: number
  draws: number
  gamesPlayed: number
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

export interface CompletedSinglePlayerGame {
  players: Array<{
    userId: { toString(): string } | string
    username: string
  }>
  metadata?: {
    difficulty?: 'easy' | 'medium' | 'hard'
    boardSize?: 'small' | 'medium' | 'large'
    wallLooping?: boolean
  }
  result?: {
    winner?: { toString(): string } | string
    winnerName?: string
    isDraw: boolean
    winType?: string
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

export function buildSinglePlayerScoreLeaderboard(gameType: 'snake' | 'mazeChase', games: CompletedSinglePlayerGame[]): SinglePlayerLeaderboardEntry[] {
  const bestScores = new Map<string, Omit<SinglePlayerLeaderboardEntry, 'rank' | 'winRate' | 'wins' | 'losses' | 'draws' | 'gamesPlayed'> & { wins: number; losses: number; draws: number; gamesPlayed: number; score: number }>()

  for (const game of games) {
    const player = game.players[0]
    if (!player || !game.result) continue

    const boardSize = game.metadata?.boardSize || 'medium'
    const wallLooping = Boolean(game.metadata?.wallLooping)
    const score = Number(String(game.result.winType || '').replace('score:', '')) || 0
    const key = gameType === 'snake' ? `${String(player.userId)}:${boardSize}:${wallLooping}` : String(player.userId)
    const entry = bestScores.get(key)

    if (!entry || score > entry.score) {
      bestScores.set(key, {
        username: player.username,
        boardSize: gameType === 'snake' ? boardSize : undefined,
        wallLooping: gameType === 'snake' ? wallLooping : undefined,
        score,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 1,
      })
    } else {
      entry.gamesPlayed += 1
    }
  }

  const sizeRank = { large: 3, medium: 2, small: 1 }
  return Array.from(bestScores.values())
    .map((entry) => ({ ...entry, rank: 0, winRate: 0 }))
    .sort((left, right) => {
      if (gameType === 'mazeChase') {
        if ((right.score || 0) !== (left.score || 0)) return (right.score || 0) - (left.score || 0)
        return left.username.localeCompare(right.username)
      }
      if (sizeRank[right.boardSize || 'medium'] !== sizeRank[left.boardSize || 'medium']) {
        return sizeRank[right.boardSize || 'medium'] - sizeRank[left.boardSize || 'medium']
      }
      if (Number(right.wallLooping) !== Number(left.wallLooping)) return Number(left.wallLooping) - Number(right.wallLooping)
      if ((right.score || 0) !== (left.score || 0)) return (right.score || 0) - (left.score || 0)
      return left.username.localeCompare(right.username)
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

class UserService {
  async getUserProfile(userId: string) {
    const user = await User.findById(userId)
      .select('_id username stats createdAt')
      .lean()
    if (!user) return null

    return {
      _id: user._id,
      username: user.username,
      stats: user.stats,
      createdAt: user.createdAt,
    }
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

    const games = await Game.find({
      status: 'completed',
      'result.isDraw': false,
      'result.winner': { $exists: true },
      ...verifiedResultFilter,
      ...multiplayerModeFilter,
    })
      .select('players result')
      .lean()

    const leaderboard = buildGlobalLeaderboard(games)
    await redisSet(GLOBAL_LEADERBOARD_CACHE_KEY, leaderboard, LEADERBOARD_TTL)

    const start = (page - 1) * limit
    return leaderboard.slice(start, start + limit)
  }

  async getLeaderboardByGameType(gameType: string, limit: number, page: number) {
    const cacheKey = `leaderboard:v2:${gameType}`
    const cached = await redisGet<unknown[]>(cacheKey)
    if (cached) {
      const start = (page - 1) * limit
      return cached.slice(start, start + limit)
    }

    // Build leaderboard from completed games for this type
    const results = await Game.aggregate([
      {
        $match: {
          gameType,
          status: 'completed',
          'result.isDraw': false,
          ...verifiedResultFilter,
          ...multiplayerModeFilter,
        },
      },
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

  async getSinglePlayerLeaderboard(gameType: 'ticTacToe' | 'snake' | 'mazeChase', limit: number, page: number): Promise<SinglePlayerLeaderboardEntry[]> {
    // Only game types with a trusted server/replay completion path are exposed.
    if (!isReplayLeaderboardEnabled(gameType)) return []

    const cacheKey = `leaderboard:v2:singlePlayer:${gameType}`
    const cached = await redisGet<SinglePlayerLeaderboardEntry[]>(cacheKey)
    if (cached) {
      const start = (page - 1) * limit
      return cached.slice(start, start + limit)
    }

    const games = await Game.find({
      gameType,
      status: 'completed',
      'metadata.mode': 'singlePlayer',
      ...(gameType === 'snake' || gameType === 'mazeChase'
        ? replayVerifiedResultFilter
        : verifiedResultFilter),
    })
      .select('players metadata result')
      .lean<CompletedSinglePlayerGame[]>()

    if (gameType === 'snake' || gameType === 'mazeChase') {
      const leaderboard = buildSinglePlayerScoreLeaderboard(gameType, games)

      await redisSet(cacheKey, leaderboard, LEADERBOARD_TTL)

      const start = (page - 1) * limit
      return leaderboard.slice(start, start + limit)
    }

    const statsByUserAndDifficulty = new Map<string, Omit<SinglePlayerLeaderboardEntry, 'rank' | 'winRate'>>()

    for (const game of games) {
      const player = game.players[0]
      if (!player || !game.result) continue

      const difficulty = game.metadata?.difficulty || 'easy'
      const playerId = String(player.userId)
      const key = `${playerId}:${difficulty}`
      const entry = statsByUserAndDifficulty.get(key) || {
        username: player.username,
        gameType: 'ticTacToe',
        difficulty,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0,
      }

      entry.username = player.username
      entry.gamesPlayed += 1
      if (game.result.isDraw) {
        entry.draws += 1
      } else if (game.result.winner && String(game.result.winner) === playerId) {
        entry.wins += 1
      } else {
        entry.losses += 1
      }
      statsByUserAndDifficulty.set(key, entry)
    }

    const difficultyRank = { hard: 3, medium: 2, easy: 1 }
    const leaderboard = Array.from(statsByUserAndDifficulty.values())
      .map((entry) => ({
        ...entry,
        rank: 0,
        winRate: entry.gamesPlayed > 0 ? entry.wins / entry.gamesPlayed : 0,
      }))
      .sort((left, right) => {
        const rightDifficulty = right.difficulty || 'easy'
        const leftDifficulty = left.difficulty || 'easy'
        if (difficultyRank[rightDifficulty] !== difficultyRank[leftDifficulty]) {
          return difficultyRank[rightDifficulty] - difficultyRank[leftDifficulty]
        }
        if (right.wins !== left.wins) return right.wins - left.wins
        if (right.winRate !== left.winRate) return right.winRate - left.winRate
        if (left.losses !== right.losses) return left.losses - right.losses
        return left.username.localeCompare(right.username)
      })
      .map((entry, index) => ({ ...entry, rank: index + 1 }))

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
    } else if (winnerId) {
      participantIds.add(winnerId)
      const uniqueLoserIds = [...new Set(loserIds.filter((loserId) => loserId && loserId !== winnerId))]
      uniqueLoserIds.forEach((loserId) => participantIds.add(loserId))
    }

    const ids = [...participantIds]
    if (ids.length === 0) return
    const lockUserIds = [...ids].sort()

    // A game involving user A may complete while a different game involving A
    // is also being reconciled. Serialize on every affected user, in a stable
    // order, so an older derived snapshot cannot overwrite a newer one.
    const reconciliationId = randomUUID()
    const lockedUserIds: string[] = []
    try {
      for (const id of lockUserIds) {
        const slot = await acquireRedisConcurrencySlot('stats-reconciliation', id, reconciliationId, 1, 2 * 60)
        if (!slot.allowed) throw new Error('Statistics reconciliation is already in progress')
        lockedUserIds.push(id)
      }

      // Derive rather than increment. This makes retries and reconciliation
      // idempotent even if a process dies after Mongo commits the game result.
      const verifiedGames = await Game.find({
        status: 'completed',
        'players.userId': { $in: ids },
        ...verifiedResultFilter,
        ...multiplayerModeFilter,
      })
        .select('players metadata result')
        .lean()
      const reconciled = reconcileVerifiedStats(verifiedGames)

      await Promise.all(ids.map((id) => User.findByIdAndUpdate(id, {
        $set: { stats: reconciled.get(id) || zeroStats() },
      })))

      try {
        await Promise.all(ids.map((id) => redisDel(`stats:${id}`)))
        await redisDel(GLOBAL_LEADERBOARD_CACHE_KEY)
      } catch (error) {
        // MongoDB is authoritative; a cache outage must not turn a committed,
        // idempotent stats update into a retried result application.
        logSecurityEvent('redis.stats_cache_invalidation_failed', {
          participantCount: ids.length,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }, 'error')
      }
    } finally {
      for (const id of lockedUserIds.reverse()) {
        try {
          await releaseRedisConcurrencySlot('stats-reconciliation', id, reconciliationId)
        } catch (error) {
          logSecurityEvent('stats.reconciliation_lock_release_failed', {
            userId: id,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          }, 'error')
        }
      }
    }
  }

  async invalidateLeaderboardCache(gameType: string): Promise<void> {
    await Promise.all([
      redisDel(GLOBAL_LEADERBOARD_CACHE_KEY),
      redisDel(`leaderboard:v2:${gameType}`),
      redisDel(`leaderboard:v2:singlePlayer:${gameType}`),
      // Remove legacy keys as a defense in depth measure during rolling deploys.
      redisDel('leaderboard:global'),
      redisDel(`leaderboard:${gameType}`),
      redisDel(`leaderboard:singlePlayer:${gameType}`),
    ])
  }
}

export const userService = new UserService()
