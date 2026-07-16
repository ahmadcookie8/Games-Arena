export type ResultVerification = 'server' | 'replay' | 'unverified'

export interface LegacyGameForVerification {
  status?: string
  gameType?: string
  players?: Array<{ userId?: unknown }>
  metadata?: { mode?: string }
  result?: {
    winner?: unknown
    isDraw?: boolean
    winType?: string
    verification?: ResultVerification
  }
}

/**
 * Only explicitly verified results are allowed to influence public rankings.
 * Missing verification is intentionally not treated as trusted; the security
 * migration must classify legacy records before they can be ranked.
 */
export const verifiedResultFilter = {
  'result.verification': { $in: ['server', 'replay'] },
}

/** Client-simulated score games must prove the result through deterministic replay. */
export const replayVerifiedResultFilter = {
  'result.verification': 'replay',
}

/** Public multiplayer leaderboards exclude every single-player record. */
export const multiplayerModeFilter = {
  $or: [
    { 'metadata.mode': 'multiplayer' },
    { 'metadata.mode': { $exists: false } },
  ],
}

export function isReplayLeaderboardEnabled(gameType: string): boolean {
  return gameType === 'ticTacToe' || gameType === 'snake' || gameType === 'mazeChase'
}

function normalizeId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const normalized = String(value)
  return normalized.length > 0 ? normalized : undefined
}

/**
 * Conservative legacy classification used by the report/apply migration.
 * Anything that cannot be proven internally consistent stays unverified.
 */
export function classifyLegacyResult(game: LegacyGameForVerification): ResultVerification {
  if (game.result?.verification) return game.result.verification
  if (game.status !== 'completed' || !game.result) return 'unverified'

  const mode = game.metadata?.mode || 'multiplayer'
  const gameType = game.gameType || ''

  if (game.result.winType === 'resignation') return 'unverified'
  if (mode === 'singlePlayer' && (gameType === 'snake' || gameType === 'mazeChase')) return 'unverified'

  const playerIds = new Set((game.players || []).map((player) => normalizeId(player.userId)).filter(Boolean))
  if (game.result.isDraw) {
    return game.result.winner === undefined && playerIds.size > 0 ? 'server' : 'unverified'
  }

  const winnerId = normalizeId(game.result.winner)
  if (mode === 'multiplayer') {
    return playerIds.size >= 2 && winnerId !== undefined && playerIds.has(winnerId) ? 'server' : 'unverified'
  }

  // Tic-Tac-Toe is the only single-player game whose complete simulation runs
  // on the backend. A missing winner represents a computer victory.
  if (mode === 'singlePlayer' && gameType === 'ticTacToe' && playerIds.size === 1) {
    return winnerId === undefined || playerIds.has(winnerId) ? 'server' : 'unverified'
  }

  return 'unverified'
}
