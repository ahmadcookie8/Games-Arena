import { GameBase } from './GameBase'
import { Player, ValidationResult, GameOverResult } from '../types/game'

interface TicTacToeState {
  board: (string | null)[]  // 9 cells: null | 'X' | 'O'
  currentSymbol: 'X' | 'O'
}

export class TicTacToe extends GameBase {
  protected gameType = 'ticTacToe'

  constructor(players: Player[]) {
    const initialState: TicTacToeState = {
      board: Array(9).fill(null),
      currentSymbol: 'X',
    }
    super(players, initialState)
  }

  static createInitialState(): TicTacToeState {
    return { board: Array(9).fill(null), currentSymbol: 'X' }
  }

  validateMove(gameState: unknown, move: string): ValidationResult {
    const state = gameState as TicTacToeState
    const index = parseInt(move, 10)

    if (isNaN(index) || index < 0 || index > 8) {
      return { isValid: false, reason: 'Invalid cell index (must be 0-8)' }
    }
    if (state.board[index] !== null) {
      return { isValid: false, reason: 'Cell already occupied' }
    }

    return { isValid: true }
  }

  applyMove(gameState: unknown, move: string): TicTacToeState {
    const state = gameState as TicTacToeState
    const newState: TicTacToeState = JSON.parse(JSON.stringify(state))
    const index = parseInt(move, 10)

    newState.board[index] = newState.currentSymbol
    newState.currentSymbol = newState.currentSymbol === 'X' ? 'O' : 'X'

    return newState
  }

  isGameOver(gameState: unknown): GameOverResult {
    const state = gameState as TicTacToeState
    const wins = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ]

    for (const [a, b, c] of wins) {
      if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
        const winnerSymbol = state.board[a]
        const winnerIndex = winnerSymbol === 'X' ? 0 : 1
        return { isGameOver: true, winner: winnerIndex, reason: 'three_in_a_row' }
      }
    }

    if (state.board.every((cell) => cell !== null)) {
      return { isGameOver: true, isDraw: true, reason: 'board_full' }
    }

    return { isGameOver: false }
  }

  getPossibleMoves(gameState: unknown, _playerIndex: number): string[] {
    const state = gameState as TicTacToeState
    return state.board
      .map((cell, i) => (cell === null ? String(i) : null))
      .filter((m): m is string => m !== null)
  }

  serializeState(): string {
    return JSON.stringify(this.gameState)
  }

  deserializeState(state: string): void {
    this.gameState = JSON.parse(state)
  }
}
