export type GameType = 'chess' | 'checkers' | 'ticTacToe' | 'uno' | 'president' | 'wisecracker' | 'scrabble' | 'snake' | 'mazeChase' | 'propertyManagement'
export type GameStatus = 'active' | 'paused' | 'completed' | 'abandoned'
export type GameMode = 'multiplayer' | 'singlePlayer'
export type TicTacToeDifficulty = 'easy' | 'medium' | 'hard'
export type SnakeBoardSize = 'small' | 'medium' | 'large'

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

export interface ChatMessage {
  messageId: string
  userId: string
  username: string
  text: string
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
  chatMessages?: ChatMessage[]
  createdAt: string
  lastMoveAt: string
  result?: {
    winner?: string
    winnerName?: string
    isDraw: boolean
    winType: string
  }
  metadata?: {
    ratedGame?: boolean
    mode?: GameMode
    difficulty?: TicTacToeDifficulty
    boardSize?: SnakeBoardSize
    wallLooping?: boolean
    infiniteLetters?: boolean
  }
}

export type ScrabblePremium = 'DL' | 'TL' | 'DW' | 'TW'

export interface ScrabbleTile {
  id: string
  letter: string
  value: number
  isBlank: boolean
}

export interface ScrabbleCell {
  tile: ScrabbleTile
  placedBy: string
}

export interface ScrabbleWordScore {
  word: string
  cells: Array<{
    row: number
    col: number
    letter: string
    baseValue: number
    letterMultiplier: number
    afterLetterMultiplier: number
    isNewTile: boolean
  }>
  wordMultiplier: number
  subtotal: number
  total: number
}

export interface ScrabbleScoreEvent {
  moveNumber: number
  playerId: string
  playerName: string
  words: ScrabbleWordScore[]
  total: number
}

export interface ScrabblePendingTrade {
  offerId: string
  fromUserId: string
  targetUserId: string
  offeredTiles: ScrabbleTile[]
}

export interface ScrabbleState {
  board: (ScrabbleCell | null)[][]
  racks: Record<string, ScrabbleTile[]>
  scores: Record<string, number>
  bag: ScrabbleTile[]
  infiniteLetters: boolean
  usedPremiumSquares: string[]
  pendingTrade: ScrabblePendingTrade | null
  consecutivePasses: number
  givenUpUserIds: string[]
  lastScoreEvent: ScrabbleScoreEvent | null
}

// Property Management (Monopoly) types
export type PMPhase = 'lobby' | 'playing' | 'completed'
export type PMTurnPhase = 'preRoll' | 'postRoll' | 'buyOrAuction' | 'auction' | 'card'
export type PMColorGroup = 'brown' | 'lightBlue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'darkBlue' | 'railroad' | 'utility' | null

export interface PMPlayerState {
  userId: string
  username: string
  position: number
  money: number
  inJail: boolean
  jailRollCount: number
  getOutOfJailFreeCards: number
  isBankrupt: boolean
}

export interface PMPropertyOwnership {
  ownerId: string | null
  mortgaged: boolean
  houses: number
}

export interface PMAuctionState {
  squareIndex: number
  currentBid: number
  highBidderUserId: string | null
  passedUserIds: string[]
  activeUserIds: string[]
  currentBidderIndex: number
}

export type PMPendingAction =
  | { type: 'buyOrAuction'; squareIndex: number }
  | { type: 'auction'; auction: PMAuctionState }
  | { type: 'card'; cardText: string; cardEffect: { type: string; [key: string]: unknown } }

export interface PropertyManagementState {
  phase: PMPhase
  hostUserId: string
  currentPlayerUserId: string
  turnPhase: PMTurnPhase
  dice: [number, number] | null
  doublesCount: number
  playerOrder: string[]
  playerStates: Record<string, PMPlayerState>
  properties: Record<string, PMPropertyOwnership>
  chanceCardIndex: number
  communityChestCardIndex: number
  chanceCardOrder: number[]
  communityChestCardOrder: number[]
  chanceFreeCardReturned: boolean
  communityChestFreeCardReturned: boolean
  pendingAction: PMPendingAction | null
  lastEventMessage: string | null
  bankruptPlayerIds: string[]
  winnerId: string | null
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
