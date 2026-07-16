import type { Game } from '../types/game'

export interface GameStateEnvelope {
  gameId: string
  revision?: number
  game: Game
}

/**
 * Accepts the current event/ack shape and the temporary legacy shapes used by
 * older servers. Every accepted payload is internally normalized before the
 * route and revision gates see it.
 */
export function parseGameStateEnvelope(value: unknown): GameStateEnvelope | null {
  if (!isRecord(value)) return null

  const gameValue = isGame(value.game)
    ? value.game
    : isGame(value)
      ? value
      : null
  if (!gameValue) return null

  const gameId = typeof value.gameId === 'string' ? value.gameId : gameValue._id
  if (gameId !== gameValue._id) return null

  const envelopeRevision = readRevision(value.revision)
  const gameRevision = readRevision(gameValue.revision)
  if (envelopeRevision !== undefined && gameRevision !== undefined && envelopeRevision !== gameRevision) return null

  const revision = envelopeRevision ?? gameRevision
  return {
    gameId,
    ...(revision !== undefined ? { revision } : {}),
    game: revision !== undefined && gameValue.revision === undefined
      ? { ...gameValue, revision }
      : gameValue,
  }
}

export function shouldApplyGameSnapshot(
  current: Game | null,
  incoming: GameStateEnvelope,
  expectedGameId: string,
  allowEqualRevision = false,
): boolean {
  if (incoming.gameId !== expectedGameId || incoming.game._id !== expectedGameId) return false
  if (!current || current._id !== expectedGameId) return true

  const currentRevision = readRevision(current.revision)
  const incomingRevision = readRevision(incoming.revision ?? incoming.game.revision)

  // Legacy snapshots remain usable until the first revision-aware response.
  // Once versioning is available, an unversioned event can no longer replace it.
  if (currentRevision !== undefined && incomingRevision === undefined) return false
  if (currentRevision === undefined || incomingRevision === undefined) return true
  return allowEqualRevision ? incomingRevision >= currentRevision : incomingRevision > currentRevision
}

function isGame(value: unknown): value is Game {
  return isRecord(value) && typeof value._id === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readRevision(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}
