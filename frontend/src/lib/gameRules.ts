import { GameType } from '../types/game'

// Client-side move validation for UI feedback only.
// Server always performs the authoritative validation.

export function validateMoveTicTacToe(board: (string | null)[], index: number): boolean {
  return index >= 0 && index <= 8 && board[index] === null
}

export function validateMoveChess(from: string, to: string): boolean {
  return /^[a-h][1-8]$/.test(from) && /^[a-h][1-8]$/.test(to) && from !== to
}

export function formatMove(gameType: GameType, rawMove: unknown): string {
  void gameType
  return JSON.stringify(rawMove)
}

export function getGameLabel(gameType: GameType): string {
  switch (gameType) {
    case 'ticTacToe': return 'Tic Tac Toe'
    case 'wisecracker': return 'Wisecracker'
    case 'chess': return 'Chess'
    case 'checkers': return 'Checkers'
    case 'uno': return 'Uno'
    case 'president': return 'President'
    case 'snake': return 'Snake'
  }
}
