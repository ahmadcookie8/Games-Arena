export type GameType = 'chess' | 'checkers' | 'ticTacToe' | 'uno' | 'president' | 'wisecracker'
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

export type WisecrackerPhase = 'lobby' | 'prompt' | 'answering' | 'revealing' | 'roundResult' | 'completed'

export interface WisecrackerState {
  phase: WisecrackerPhase
  hostUserId: string
  maxScore: number
  chooserUserId: string | null
  chooserIndex: number
  activePlayerIds: string[]
  waitingPlayerIds: string[]
  prompt: string
  answerSlots: number
  submittedAnswers: Record<string, string[]>
  answerOrder: string[]
  revealedCount: number
  scores: Record<string, number>
  roundWinnerUserId: string | null
  matchWinnerUserId: string | null
}
