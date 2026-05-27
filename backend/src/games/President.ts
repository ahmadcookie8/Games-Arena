import { GameBase } from './GameBase'
import { Player, ValidationResult, GameOverResult } from '../types/game'

export class President extends GameBase {
  protected gameType = 'president'

  constructor(players: Player[]) {
    super(players, President.createInitialState(players.length))
  }

  static createInitialState(playerCount: number): Record<string, unknown> {
    // TODO: implement President card game state
    // Deal all 52 cards, player with 3 of clubs goes first
    return { hands: [], currentTrick: [], rankings: [] }
  }

  validateMove(gameState: unknown, move: string): ValidationResult {
    // TODO: implement President move validation (must beat current trick)
    return { isValid: true }
  }

  applyMove(gameState: unknown, move: string): unknown {
    // TODO: implement trick-taking logic and rank assignment
    const newState = JSON.parse(JSON.stringify(gameState))
    return newState
  }

  isGameOver(gameState: unknown): GameOverResult {
    // TODO: game ends when all players except last have finished their hands
    return { isGameOver: false }
  }

  getPossibleMoves(gameState: unknown, playerIndex: number): string[] {
    // TODO: return cards that can legally be played
    return []
  }

  serializeState(): string {
    return JSON.stringify(this.gameState)
  }

  deserializeState(state: string): void {
    this.gameState = JSON.parse(state)
  }
}
