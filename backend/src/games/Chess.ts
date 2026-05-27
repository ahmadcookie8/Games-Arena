import { GameBase } from './GameBase'
import { Player, ValidationResult, GameOverResult } from '../types/game'

export class Chess extends GameBase {
  protected gameType = 'chess'

  constructor(players: Player[]) {
    super(players, Chess.createInitialState())
  }

  static createInitialState(): Record<string, unknown> {
    // Full chess board in object notation { e2: { type: 'pawn', color: 'white' }, ... }
    // TODO: implement full board initialization
    return { board: {}, enPassantTarget: null, castlingRights: { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } } }
  }

  validateMove(gameState: unknown, move: string): ValidationResult {
    // move format: "e2-e4"
    // TODO: implement full chess move validation
    const [src, dest] = move.split('-')
    if (!src || !dest || !this.isValidSquare(src) || !this.isValidSquare(dest)) {
      return { isValid: false, reason: 'Invalid square notation' }
    }
    return { isValid: true }
  }

  applyMove(gameState: unknown, move: string): unknown {
    // TODO: implement move application with special moves (castling, en passant, promotion)
    const newState = JSON.parse(JSON.stringify(gameState))
    return newState
  }

  isGameOver(gameState: unknown): GameOverResult {
    // TODO: implement checkmate, stalemate, insufficient material detection
    return { isGameOver: false }
  }

  getPossibleMoves(gameState: unknown, playerIndex: number): string[] {
    // TODO: implement legal move generation
    return []
  }

  serializeState(): string {
    return JSON.stringify(this.gameState)
  }

  deserializeState(state: string): void {
    this.gameState = JSON.parse(state)
  }

  private isValidSquare(square: string): boolean {
    return /^[a-h][1-8]$/.test(square)
  }
}
