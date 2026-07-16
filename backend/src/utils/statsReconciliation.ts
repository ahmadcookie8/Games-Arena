import { ResultVerification } from './resultVerification'

export interface ReconciliationGame {
  gameType?: string
  players?: Array<{ userId?: unknown }>
  statsParticipantIds?: unknown[]
  gameState?: Record<string, unknown>
  metadata?: { mode?: string }
  result?: {
    winner?: unknown
    isDraw?: boolean
    verification?: ResultVerification
  }
}

export interface ReconciledStats {
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  gamesDraw: number
  winRate: number
}

const emptyStats = (): ReconciledStats => ({
  gamesPlayed: 0,
  gamesWon: 0,
  gamesLost: 0,
  gamesDraw: 0,
  winRate: 0,
})

/** Rebuilds aggregate multiplayer statistics from explicitly verified results. */
export function reconcileVerifiedStats(games: ReconciliationGame[]): Map<string, ReconciledStats> {
  const byUser = new Map<string, ReconciledStats>()

  for (const game of games) {
    if ((game.metadata?.mode || 'multiplayer') !== 'multiplayer') continue
    if (game.result?.verification !== 'server' && game.result?.verification !== 'replay') continue

    const roomPlayerIds = [...new Set((game.players || [])
      .map((player) => player.userId === undefined || player.userId === null ? '' : String(player.userId))
      .filter(Boolean))]
    const roomPlayers = new Set(roomPlayerIds)
    const frozenIds = Array.isArray(game.statsParticipantIds)
      ? game.statsParticipantIds.map(String)
      : []
    const wisecrackerIds = game.gameType === 'wisecracker' && Array.isArray(game.gameState?.activePlayerIds)
      ? game.gameState.activePlayerIds.map(String)
      : []
    const eligibleIds = (frozenIds.length > 0 ? frozenIds : wisecrackerIds)
      .filter((playerId) => roomPlayers.has(playerId))
    const playerIds = eligibleIds.length > 0 ? [...new Set(eligibleIds)] : roomPlayerIds
    if (playerIds.length < 2 || !game.result) continue

    if (game.result.isDraw) {
      for (const playerId of playerIds) {
        const stats = byUser.get(playerId) || emptyStats()
        stats.gamesPlayed += 1
        stats.gamesDraw += 1
        byUser.set(playerId, stats)
      }
      continue
    }

    const winnerId = game.result.winner === undefined || game.result.winner === null ? '' : String(game.result.winner)
    if (!winnerId || !playerIds.includes(winnerId)) continue

    for (const playerId of playerIds) {
      const stats = byUser.get(playerId) || emptyStats()
      stats.gamesPlayed += 1
      if (playerId === winnerId) stats.gamesWon += 1
      else stats.gamesLost += 1
      byUser.set(playerId, stats)
    }
  }

  for (const stats of byUser.values()) {
    stats.winRate = stats.gamesPlayed > 0 ? stats.gamesWon / stats.gamesPlayed : 0
  }

  return byUser
}

export function zeroStats(): ReconciledStats {
  return emptyStats()
}
