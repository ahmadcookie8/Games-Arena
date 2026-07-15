export type GameType = 'chess' | 'checkers' | 'ticTacToe' | 'uno' | 'president' | 'wisecracker' | 'scrabble' | 'snake' | 'mazeChase' | 'propertyManagement'
export type GameStatus = 'active' | 'paused' | 'completed' | 'abandoned'
export type WinType = 'checkmate' | 'resignation' | 'timeout' | 'draw'
export type GameMode = 'multiplayer' | 'singlePlayer'
export type TicTacToeDifficulty = 'easy' | 'medium' | 'hard'
export type SnakeBoardSize = 'small' | 'medium' | 'large'

export interface Player {
  userId: string
  username: string
  index: number
  color?: string
  rank?: string
  isConnected?: boolean
  connectedAt?: Date
  disconnectCount?: number
}

export interface MoveRecord {
  moveNumber: number
  playerId: string
  playerName: string
  move: string
  timestamp: Date
  elo_impact?: number
}

export interface GameResult {
  winner?: string
  winnerName?: string
  loser?: string
  loserName?: string
  isDraw: boolean
  winType: WinType
}

export interface ValidationResult {
  isValid: boolean
  reason?: string
}

export interface GameOverResult {
  isGameOver: boolean
  winner?: number
  isDraw?: boolean
  reason?: string
}
