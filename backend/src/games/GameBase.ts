import { Player, MoveRecord, ValidationResult, GameOverResult } from '../types/game'

export abstract class GameBase {
  protected gameType: string = ''
  protected players: Player[]
  protected currentTurnIndex: number
  protected gameState: unknown
  protected moveHistory: MoveRecord[]

  constructor(players: Player[], initialGameState: unknown) {
    this.players = players
    this.gameState = initialGameState
    this.currentTurnIndex = 0
    this.moveHistory = []
  }

  abstract validateMove(gameState: unknown, move: string): ValidationResult
  abstract applyMove(gameState: unknown, move: string): unknown
  abstract isGameOver(gameState: unknown): GameOverResult
  abstract getPossibleMoves(gameState: unknown, playerIndex: number): string[]
  abstract serializeState(): string
  abstract deserializeState(state: string): void

  getCurrentPlayer(): Player {
    return this.players[this.currentTurnIndex]
  }

  getCurrentTurnIndex(): number {
    return this.currentTurnIndex
  }

  advanceTurn(): void {
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length
  }

  recordMove(move: string, playerIndex: number): void {
    this.moveHistory.push({
      moveNumber: this.moveHistory.length + 1,
      playerId: this.players[playerIndex].userId,
      playerName: this.players[playerIndex].username,
      move,
      timestamp: new Date(),
    })
  }

  getGameState(): unknown {
    return this.gameState
  }

  getMoveHistory(): MoveRecord[] {
    return this.moveHistory
  }
}
