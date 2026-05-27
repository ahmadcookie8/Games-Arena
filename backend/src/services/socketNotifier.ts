import { Server } from 'socket.io'
import { IGameDocument } from '../models/Game'

let io: Server | null = null

export function setSocketServer(server: Server): void {
  io = server
}

export function emitGameUpdated(game: IGameDocument): void {
  io?.to(String(game._id)).emit('gameUpdated', { game })
}

export function emitMoveMade(game: IGameDocument, move: string): void {
  io?.to(String(game._id)).emit('moveMade', { game, move })
}

export function emitGameOver(game: IGameDocument): void {
  io?.to(String(game._id)).emit('gameOver', { game, result: game.result })
}

export function emitGamesChanged(game: IGameDocument): void {
  for (const player of game.players) {
    io?.to(`user:${player.userId.toString()}`).emit('gamesChanged')
  }
}
