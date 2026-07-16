import { Server } from 'socket.io'
import { IGameDocument } from '../models/Game'
import { presentGameForUser } from '../utils/gamePresenter'

let io: Server | null = null

export function setSocketServer(server: Server): void {
  io = server
}

/** Revokes every live transport for a user after logout/auth-version changes. */
export function disconnectUserSockets(userId: string): void {
  io?.in(`user:${userId}`).disconnectSockets(true)
}

export function emitGameUpdated(game: IGameDocument): void {
  emitPersonalizedGameEvent(game, 'gameUpdated')
}

export function emitMoveMade(game: IGameDocument, move: string): void {
  emitPersonalizedGameEvent(game, 'moveMade', { move })
}

export function emitGameOver(game: IGameDocument): void {
  forEachPlayer(game, (userId) => {
    const presented = presentGameForUser(game, userId)
    io?.to(`user:${userId}`).emit('gameOver', { game: presented, result: presented.result })
  })
}

export function emitGamesChanged(game: IGameDocument): void {
  forEachPlayer(game, (userId) => {
    io?.to(`user:${userId}`).emit('gamesChanged')
  })
}

export function emitChatMessage(game: IGameDocument, message: unknown): void {
  forEachPlayer(game, (userId) => {
    io?.to(`user:${userId}`).emit('chatMessage', { gameId: String(game._id), message })
  })
}

export function emitGameReplayCreated(sourceGame: IGameDocument, replayGame: IGameDocument, requestedByUserId: string): void {
  io?.to(`user:${requestedByUserId}`).emit('gameReplayCreated', {
    oldGameId: String(sourceGame._id),
    gameId: String(replayGame._id),
    gameCode: replayGame.gameCode,
    gameType: replayGame.gameType,
  })
}

function emitPersonalizedGameEvent(
  game: IGameDocument,
  event: 'gameUpdated' | 'moveMade',
  extra: Record<string, unknown> = {}
): void {
  forEachPlayer(game, (userId) => {
    io?.to(`user:${userId}`).emit(event, { game: presentGameForUser(game, userId), ...extra })
  })
}

function forEachPlayer(game: IGameDocument, callback: (userId: string) => void): void {
  const userIds = new Set(game.players.map((player) => player.userId.toString()))
  for (const userId of userIds) callback(userId)
}
