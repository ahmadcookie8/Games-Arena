import { IGameDocument } from '../models/Game'

export function presentGameForUser(game: IGameDocument | Record<string, unknown>, userId: string): Record<string, unknown> {
  const plain = typeof (game as IGameDocument).toObject === 'function'
    ? (game as IGameDocument).toObject()
    : JSON.parse(JSON.stringify(game))

  if (plain.gameType !== 'scrabble' || !plain.gameState || typeof plain.gameState !== 'object') {
    return plain
  }

  const gameState = plain.gameState as Record<string, unknown>
  const racks = gameState.racks as Record<string, unknown[]> | undefined
  if (racks) {
    gameState.racks = Object.fromEntries(Object.entries(racks).map(([rackUserId, tiles]) => [
      rackUserId,
      rackUserId === userId ? tiles : [],
    ]))
  }

  const pendingTrade = gameState.pendingTrade as { fromUserId?: string; targetUserId?: string; offeredTiles?: unknown[] } | null | undefined
  if (pendingTrade && pendingTrade.fromUserId !== userId && pendingTrade.targetUserId !== userId) {
    pendingTrade.offeredTiles = []
  }

  return plain
}
