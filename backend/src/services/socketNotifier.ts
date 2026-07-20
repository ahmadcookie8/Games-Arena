import { Server } from 'socket.io'
import { IGameDocument } from '../models/Game'
import { presentGameForUser } from '../utils/gamePresenter'
import { gameUserRoom, userRoom } from '../utils/socketRooms'
import { logSecurityEvent } from '../utils/securityLogger'
import { activeGameConnectionLeases } from './activeGameConnectionLeases'

let io: Server | null = null

export function setSocketServer(server: Server): void {
  io = server
}

/** Revokes every live transport for a user after logout/auth-version changes. */
export function disconnectUserSockets(userId: string): void {
  io?.in(userRoom(userId)).disconnectSockets(true)
}

export function emitGameUpdated(game: IGameDocument): void {
  releaseLeasesForTerminalGame(game)
  emitPersonalizedGameEvent(game, 'gameUpdated')
}

export function emitMoveMade(game: IGameDocument, move: string): void {
  emitGameMetadataEvent(game, 'moveMade', { move })
}

export function emitGameOver(game: IGameDocument): void {
  releaseLeasesForTerminalGame(game)
  forEachPlayer(game, (userId) => {
    const presented = presentGameForUser(game, userId)
    io?.to(gameUserRoom(String(game._id), userId)).emit('gameOver', {
      gameId: String(game._id),
      revision: getGameRevision(game),
      result: presented.result,
    })
  })
}

export function emitGamesChanged(game: IGameDocument): void {
  forEachPlayer(game, (userId) => {
    io?.to(userRoom(userId)).emit('gamesChanged')
  })
}

export function emitChatMessage(game: IGameDocument, message: unknown): void {
  forEachPlayer(game, (userId) => {
    io?.to(gameUserRoom(String(game._id), userId)).emit('chatMessage', { gameId: String(game._id), message })
  })
}

export function emitPlayerPresenceChanged(game: IGameDocument, userId: string, isConnected: boolean): void {
  forEachPlayer(game, (recipientUserId) => {
    io?.to(gameUserRoom(String(game._id), recipientUserId)).emit('playerPresenceChanged', {
      gameId: String(game._id),
      userId,
      isConnected,
    })
  })
}

export function emitGameReplayCreated(sourceGame: IGameDocument, replayGame: IGameDocument): void {
  forEachPlayer(sourceGame, (userId) => {
    io?.to(userRoom(userId)).emit('gameReplayCreated', {
      oldGameId: String(sourceGame._id),
      gameId: String(replayGame._id),
      gameCode: replayGame.gameCode,
      gameType: replayGame.gameType,
    })
  })
}

/**
 * Releases local sockets' Redis-backed active-game slots without making a
 * durable game transition fail when Redis is temporarily unavailable.
 */
export async function releaseActiveGameConnectionLeases(gameId: string): Promise<void> {
  try {
    await activeGameConnectionLeases.releaseGame(gameId)
  } catch {
    logSecurityEvent('socket.active_game_connection_release_failed', { gameId }, 'error')
  }
}

function emitPersonalizedGameEvent(
  game: IGameDocument,
  event: 'gameUpdated'
): void {
  forEachPlayer(game, (userId) => {
    io?.to(gameUserRoom(String(game._id), userId)).emit(event, createGameStateEnvelope(game, userId))
  })
}

function emitGameMetadataEvent(
  game: IGameDocument,
  event: 'moveMade',
  extra: Record<string, unknown>
): void {
  forEachPlayer(game, (userId) => {
    io?.to(gameUserRoom(String(game._id), userId)).emit(event, {
      gameId: String(game._id),
      revision: getGameRevision(game),
      ...extra,
    })
  })
}

export function createGameStateEnvelope(game: IGameDocument, userId: string): {
  gameId: string
  revision: number
  game: Record<string, unknown>
} {
  const presented = presentGameForUser(game, userId)
  const revision = typeof presented.revision === 'number' ? presented.revision : getGameRevision(game)
  return { gameId: String(game._id), revision, game: presented }
}

function getGameRevision(game: IGameDocument): number {
  const revision = game.__v
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0
}

function forEachPlayer(game: IGameDocument, callback: (userId: string) => void): void {
  const userIds = new Set(game.players.map((player) => player.userId.toString()))
  for (const userId of userIds) callback(userId)
}

function releaseLeasesForTerminalGame(game: IGameDocument): void {
  if (game.status === 'active') return
  // Start cleanup before the final event is broadcast. Callers that require a
  // strict durability boundary (for example closeGame) await the exported
  // helper before invoking the notifier.
  void releaseActiveGameConnectionLeases(String(game._id))
}
