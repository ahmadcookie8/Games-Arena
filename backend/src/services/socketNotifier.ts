import { Server } from 'socket.io'
import { IGameDocument } from '../models/Game'
import { presentGameForUser } from '../utils/gamePresenter'

let io: Server | null = null

export function setSocketServer(server: Server): void {
  io = server
}

export function emitGameUpdated(game: IGameDocument): void {
  if (game.gameType === 'scrabble') {
    emitScrabblePersonalized(game, 'gameUpdated')
    return
  }
  io?.to(String(game._id)).emit('gameUpdated', { game })
}

export function emitMoveMade(game: IGameDocument, move: string): void {
  if (game.gameType === 'scrabble') {
    emitScrabblePersonalized(game, 'moveMade', { move })
    return
  }
  io?.to(String(game._id)).emit('moveMade', { game, move })
}

export function emitGameOver(game: IGameDocument): void {
  if (game.gameType === 'scrabble') {
    emitScrabblePersonalized(game, 'gameOver', { result: game.result })
    return
  }
  io?.to(String(game._id)).emit('gameOver', { game, result: game.result })
}

export function emitGamesChanged(game: IGameDocument): void {
  for (const player of game.players) {
    io?.to(`user:${player.userId.toString()}`).emit('gamesChanged')
  }
}

export function emitChatMessage(game: IGameDocument, message: unknown): void {
  io?.to(String(game._id)).emit('chatMessage', { gameId: String(game._id), message })
}

export function emitGameReplayCreated(sourceGame: IGameDocument, replayGame: IGameDocument): void {
  io?.to(String(sourceGame._id)).emit('gameReplayCreated', {
    oldGameId: String(sourceGame._id),
    gameId: String(replayGame._id),
    gameCode: replayGame.gameCode,
    gameType: replayGame.gameType,
  })
}

function emitScrabblePersonalized(game: IGameDocument, event: 'gameUpdated' | 'moveMade' | 'gameOver', extra: Record<string, unknown> = {}): void {
  for (const player of game.players) {
    const userId = player.userId.toString()
    io?.to(`user:${userId}`).emit(event, { game: presentGameForUser(game, userId), ...extra })
  }
}
