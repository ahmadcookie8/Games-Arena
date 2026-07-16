import mongoose from 'mongoose'
import { randomBytes } from 'crypto'
import { Game } from '../models/Game'
import { User } from '../models/User'
import { connectMongoDB } from '../utils/mongoose'
import { classifyLegacyResult, LegacyGameForVerification, ResultVerification } from '../utils/resultVerification'
import { reconcileVerifiedStats, zeroStats } from '../utils/statsReconciliation'
import { closeRedisClient, redisDelMany } from '../utils/redis'

interface MigrationGame extends LegacyGameForVerification {
  _id: mongoose.Types.ObjectId
  completedAt?: Date
  statsProcessedAt?: Date
  statsParticipantIds?: mongoose.Types.ObjectId[]
  gameState?: Record<string, unknown>
}

interface MigrationReport {
  mode: 'report-only' | 'apply'
  completedGames: number
  missingModes: number
  resultClassifications: Record<ResultVerification, number>
  resultClassificationsToWrite: number
  statsProcessedMarkersToWrite: number
  usersToReconcile: number
  usersWhoseStatsChange: number
  wisecrackerGamesNeedingResponseIdRepair: number
  wisecrackerResponseIdsToWrite: number
  wisecrackerUnresolvedWinnerReferences: number
}

interface WisecrackerResponseIdRepair {
  gameId: mongoose.Types.ObjectId
  responseIds: Record<string, string>
  repairedCount: number
  unresolvedWinner: boolean
}

const USER_ID_PATTERN = /^[a-f0-9]{24}$/
const RESPONSE_ID_PATTERN = /^[a-f0-9]{32}$/

function equalStats(left: unknown, right: unknown): boolean {
  const fields = ['gamesPlayed', 'gamesWon', 'gamesLost', 'gamesDraw', 'winRate'] as const
  const a = (left || {}) as Record<string, unknown>
  const b = (right || {}) as Record<string, unknown>
  return fields.every((field) => Number(a[field] || 0) === Number(b[field] || 0))
}

export async function runSecurityMigration(args = process.argv.slice(2)): Promise<MigrationReport> {
  const apply = args.includes('--apply')
  if (apply && !args.includes('--backup-confirmed')) {
    throw new Error('Refusing to apply without --backup-confirmed. Back up MongoDB and review a report-only run first.')
  }

  await connectMongoDB()

  try {
    const allGames = await Game.find({
      $or: [{ status: 'completed' }, { gameType: 'wisecracker' }],
    })
      .select('gameType status players metadata result completedAt statsProcessedAt statsParticipantIds gameState')
      .lean<MigrationGame[]>()
    const games = allGames.filter((game) => game.status === 'completed')
    const wisecrackerRepairs = allGames
      .filter((game) => game.gameType === 'wisecracker')
      .map(analyzeWisecrackerResponseIds)
      .filter((repair): repair is WisecrackerResponseIdRepair => repair !== null)

    const effectiveGames = games.map((game) => {
      const verification = classifyLegacyResult(game)
      return {
        ...game,
        metadata: { ...(game.metadata || {}), mode: game.metadata?.mode || 'multiplayer' },
        result: game.result ? { ...game.result, verification } : undefined,
      }
    })

    const classifications: Record<ResultVerification, number> = { server: 0, replay: 0, unverified: 0 }
    for (const game of effectiveGames) {
      if (game.result?.verification) classifications[game.result.verification] += 1
    }

    const reconciled = reconcileVerifiedStats(effectiveGames)
    const users = await User.find({}).select('_id stats').lean<Array<{ _id: mongoose.Types.ObjectId; stats?: unknown }>>()
    const usersWhoseStatsChange = users.filter((user) => !equalStats(user.stats, reconciled.get(String(user._id)) || zeroStats())).length

    const resultClassificationsToWrite = games.filter((game) => game.result && !game.result.verification).length
    const statsProcessedMarkersToWrite = effectiveGames.filter((game) =>
      !game.statsProcessedAt
      && game.metadata?.mode === 'multiplayer'
      && (game.result?.verification === 'server' || game.result?.verification === 'replay')
    ).length

    const report: MigrationReport = {
      mode: apply ? 'apply' : 'report-only',
      completedGames: games.length,
      missingModes: games.filter((game) => !game.metadata?.mode).length,
      resultClassifications: classifications,
      resultClassificationsToWrite,
      statsProcessedMarkersToWrite,
      usersToReconcile: users.length,
      usersWhoseStatsChange,
      wisecrackerGamesNeedingResponseIdRepair: wisecrackerRepairs.filter((repair) => repair.repairedCount > 0).length,
      wisecrackerResponseIdsToWrite: wisecrackerRepairs.reduce((total, repair) => total + repair.repairedCount, 0),
      wisecrackerUnresolvedWinnerReferences: wisecrackerRepairs.filter((repair) => repair.unresolvedWinner).length,
    }

    if (apply) {
      const now = new Date()
      const effectiveById = new Map(effectiveGames.map((game) => [String(game._id), game]))
      const responseRepairById = new Map(wisecrackerRepairs.map((repair) => [String(repair.gameId), repair]))
      const gameOperations = allGames.map((game) => {
        const effective = effectiveById.get(String(game._id))
        const set: Record<string, unknown> = {}
        if (game.status === 'completed' && !game.metadata?.mode) set['metadata.mode'] = 'multiplayer'
        if (game.status === 'completed' && game.result && !game.result.verification) {
          set['result.verification'] = effective?.result?.verification || 'unverified'
        }
        if (
          game.status === 'completed'
          && !game.statsProcessedAt
          && effective?.metadata?.mode === 'multiplayer'
          && (effective?.result?.verification === 'server' || effective?.result?.verification === 'replay')
        ) {
          set.statsProcessedAt = game.completedAt || now
        }
        const responseRepair = responseRepairById.get(String(game._id))
        if (responseRepair && responseRepair.repairedCount > 0) {
          set['gameState.responseIds'] = responseRepair.responseIds
        }
        return Object.keys(set).length > 0
          ? { updateOne: { filter: { _id: game._id }, update: { $set: set } } }
          : null
      }).filter((operation): operation is NonNullable<typeof operation> => operation !== null)

      if (gameOperations.length > 0) await Game.bulkWrite(gameOperations)

      const userOperations = users.map((user) => ({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { stats: reconciled.get(String(user._id)) || zeroStats() } },
        },
      }))
      if (userOperations.length > 0) await User.bulkWrite(userOperations)

      // The database changes and derived stats are authoritative only after no
      // pre-migration personalized or leaderboard response can be served.
      const gameTypes = [...new Set(effectiveGames.map((game) => game.gameType).filter((value): value is string => Boolean(value)))]
      await redisDelMany([
        ...users.map((user) => `stats:${String(user._id)}`),
        'leaderboard:v2:global',
        'leaderboard:global',
        ...gameTypes.flatMap((gameType) => [
          `leaderboard:v2:${gameType}`,
          `leaderboard:v2:singlePlayer:${gameType}`,
          `leaderboard:${gameType}`,
          `leaderboard:singlePlayer:${gameType}`,
        ]),
      ])
    }

    return report
  } finally {
    await closeRedisClient()
    await mongoose.disconnect()
  }
}

function analyzeWisecrackerResponseIds(game: MigrationGame): WisecrackerResponseIdRepair | null {
  const state = game.gameState
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null
  const submittedAnswers = isRecord(state.submittedAnswers) ? state.submittedAnswers : {}
  const currentResponseIds = isRecord(state.responseIds) ? state.responseIds : {}
  const submittedUserIds = Object.entries(submittedAnswers)
    .filter(([userId, answers]) => USER_ID_PATTERN.test(userId) && Array.isArray(answers))
    .map(([userId]) => userId)
  const usedResponseIds = new Set<string>()
  const responseIds: Record<string, string> = {}

  for (const [userId, responseId] of Object.entries(currentResponseIds)) {
    if (
      USER_ID_PATTERN.test(userId)
      && typeof responseId === 'string'
      && RESPONSE_ID_PATTERN.test(responseId)
      && !usedResponseIds.has(responseId)
    ) {
      responseIds[userId] = responseId
      usedResponseIds.add(responseId)
    }
  }

  let repairedCount = 0
  for (const userId of submittedUserIds) {
    if (responseIds[userId]) continue
    let responseId: string
    do responseId = randomBytes(16).toString('hex')
    while (usedResponseIds.has(responseId))
    usedResponseIds.add(responseId)
    responseIds[userId] = responseId
    repairedCount += 1
  }

  const roundWinnerUserId = typeof state.roundWinnerUserId === 'string' ? state.roundWinnerUserId : null
  return {
    gameId: game._id,
    responseIds,
    repairedCount,
    unresolvedWinner: Boolean(roundWinnerUserId && !responseIds[roundWinnerUserId]),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

if (require.main === module) {
  runSecurityMigration()
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : 'Security migration failed')
      process.exitCode = 1
    })
}
