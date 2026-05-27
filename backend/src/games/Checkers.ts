import { GameBase } from './GameBase'
import { Player, ValidationResult, GameOverResult } from '../types/game'

export class Checkers extends GameBase {
  protected gameType = 'checkers'

  constructor(players: Player[]) {
    super(players, Checkers.createInitialState())
  }

  static createInitialState(): Record<string, unknown> {
    // TODO: implement 8x8 checkers board initialization
    return { board: {}, mustJump: false }
  }

  validateMove(gameState: unknown, move: string): ValidationResult {
    // move format: "3-7" (cell indices) or "3-12" (jump)
    // TODO: implement checkers move validation (jumps, kings)
    return { isValid: true }
  }

  applyMove(gameState: unknown, move: string): unknown {
    // TODO: implement move application with king promotion and multi-jumps
    const newState = JSON.parse(JSON.stringify(gameState))
    return newState
  }

  isGameOver(gameState: unknown): GameOverResult {
    // TODO: implement win condition (no pieces or no moves left)
    return { isGameOver: false }
  }

  getPossibleMoves(gameState: unknown, playerIndex: number): string[] {
    // TODO: implement legal move generation (mandatory jumps)
    return []
  }

  serializeState(): string {
    return JSON.stringify(this.gameState)
  }

  deserializeState(state: string): void {
    this.gameState = JSON.parse(state)
  }
}
