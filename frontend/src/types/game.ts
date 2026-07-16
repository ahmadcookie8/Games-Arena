export type GameType = 'chess' | 'checkers' | 'ticTacToe' | 'uno' | 'president' | 'wisecracker' | 'scrabble' | 'snake' | 'mazeChase' | 'propertyManagement'
export type GameStatus = 'active' | 'paused' | 'completed' | 'abandoned'
export type GameMode = 'multiplayer' | 'singlePlayer'
export type ResultVerification = 'server' | 'replay' | 'unverified'
export type TicTacToeDifficulty = 'easy' | 'medium' | 'hard'
export type SnakeBoardSize = 'small' | 'medium' | 'large'

export interface GameReplayDescriptor {
  version: 1
  seed: string
  startedAt?: string
}

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
  /** Monotonic MongoDB document revision used to reject stale live snapshots. */
  revision?: number
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
    verification?: ResultVerification
  }
  replay?: GameReplayDescriptor
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
  offerId?: string
  fromUserId: string
  targetUserId: string
  offeredTileCount: number
  offeredTiles?: ScrabbleTile[]
}

export interface ScrabbleState {
  board: (ScrabbleCell | null)[][]
  racks: Record<string, ScrabbleTile[]>
  rackCounts: Record<string, number>
  scores: Record<string, number>
  bagCount: number
  infiniteLetters: boolean
  usedPremiumSquares: string[]
  pendingTrade: ScrabblePendingTrade | null
  consecutivePasses: number
  givenUpUserIds: string[]
  lastScoreEvent: ScrabbleScoreEvent | null
}

export interface UnoCard {
  color: 'red' | 'green' | 'blue' | 'yellow' | 'wild'
  value: string
  type: 'NUMBER' | 'SKIP' | 'REVERSE' | 'DRAW2' | 'WILD' | 'WILD_DRAW4'
}

export interface UnoState {
  hand: UnoCard[]
  handCounts: number[]
  deckCount: number
  discardPile: UnoCard[]
  currentTurnIndex: number
  direction: 1 | -1
  currentColor: string
  unoStatus: boolean[]
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
  getOutOfJailFreeCardDecks?: Array<'chance' | 'communityChest' | 'legacy'>
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
  extraRollPending?: boolean
  playerOrder: string[]
  playerStates: Record<string, PMPlayerState>
  properties: Record<string, PMPropertyOwnership>
  chanceCardIndex: number
  communityChestCardIndex: number
  chanceCardOrder?: number[]
  communityChestCardOrder?: number[]
  chanceFreeCardReturned: boolean
  communityChestFreeCardReturned: boolean
  pendingAction: PMPendingAction | null
  lastEventMessage: string | null
  bankruptPlayerIds: string[]
  winnerId: string | null
}

export type WisecrackerPhase = 'lobby' | 'prompt' | 'answering' | 'revealing' | 'roundResult' | 'completed'

export interface WisecrackerRevealedResponse {
  responseId: string
  answers: string[]
}

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
  submissionStatus: Record<string, boolean>
  myAnswers?: string[]
  revealedResponses: WisecrackerRevealedResponse[]
  scores: Record<string, number>
  roundWinnerResponseId: string | null
  matchWinnerUserId: string | null
}
