export type GameType = 'chess' | 'checkers' | 'ticTacToe' | 'uno' | 'president'
export type GameStatus = 'active' | 'paused' | 'completed' | 'abandoned'

export interface Player {
  userId: string
  username: string
  index: number
  color?: string
  isConnected?: boolean
}

export interface MoveRecord {
  moveNumber: number
  playerId: string
  playerName: string
  move: string
  timestamp: string
}

export interface Game {
  _id: string
  gameType: GameType
  status: GameStatus
  gameCode: string
  players: Player[]
  currentTurnIndex: number
  gameState: Record<string, unknown>
  moveHistory: MoveRecord[]
  createdAt: string
  lastMoveAt: string
  result?: {
    winner?: string
    winnerName?: string
    isDraw: boolean
    winType: string
  }
}
