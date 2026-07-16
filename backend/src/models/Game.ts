import mongoose, { Schema, Document } from 'mongoose'

export interface IGameDocument extends Document {
  gameType: 'chess' | 'checkers' | 'ticTacToe' | 'uno' | 'president' | 'wisecracker' | 'scrabble' | 'snake' | 'mazeChase' | 'propertyManagement'
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  gameCode: string
  players: Array<{
    userId: mongoose.Types.ObjectId
    username: string
    index: number
    color?: string
    rank?: string
    isConnected?: boolean
    connectedAt?: Date
    disconnectCount?: number
  }>
  currentTurnIndex: number
  currentTurn: mongoose.Types.ObjectId
  gameState: Record<string, unknown>
  moveHistory: Array<{
    moveNumber: number
    playerId: mongoose.Types.ObjectId
    playerName: string
    move: string
    timestamp: Date
  }>
  chatMessages: Array<{
    messageId: string
    userId: mongoose.Types.ObjectId
    username: string
    text: string
    timestamp: Date
  }>
  createdAt: Date
  startedAt?: Date
  lastMoveAt: Date
  completedAt?: Date
  inviteExpiresAt?: Date
  statsProcessedAt?: Date
  replay?: {
    version: 1
    seed: string
    startedAt?: Date
  }
  result?: {
    winner?: mongoose.Types.ObjectId
    winnerName?: string
    loser?: mongoose.Types.ObjectId
    loserName?: string
    isDraw: boolean
    winType: string
    verification: 'server' | 'replay' | 'unverified'
  }
  metadata: {
    ratedGame: boolean
    mode?: 'multiplayer' | 'singlePlayer'
    difficulty?: 'easy' | 'medium' | 'hard'
    boardSize?: 'small' | 'medium' | 'large'
    wallLooping?: boolean
    infiniteLetters?: boolean
    tournament?: string
  }
}

const ReplaySchema = new Schema(
  {
    version: { type: Number, enum: [1], required: true },
    seed: { type: String, match: /^[a-f0-9]{64}$/, required: true },
    startedAt: Date,
  },
  { _id: false }
)

const ResultSchema = new Schema(
  {
    winner: { type: Schema.Types.ObjectId, ref: 'User' },
    winnerName: String,
    loser: { type: Schema.Types.ObjectId, ref: 'User' },
    loserName: String,
    isDraw: { type: Boolean, default: false },
    winType: String,
    verification: { type: String, enum: ['server', 'replay', 'unverified'], default: 'unverified' },
  },
  { _id: false }
)

const GameSchema = new Schema<IGameDocument>(
  {
    gameType: { type: String, enum: ['chess', 'checkers', 'ticTacToe', 'uno', 'president', 'wisecracker', 'scrabble', 'snake', 'mazeChase', 'propertyManagement'], required: true },
    status: { type: String, enum: ['active', 'paused', 'completed', 'abandoned'], default: 'active' },
    gameCode: { type: String, required: true, unique: true },
    players: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        username: { type: String, required: true },
        index: { type: Number, required: true },
        color: String,
        rank: String,
        isConnected: { type: Boolean, default: false },
        connectedAt: Date,
        disconnectCount: { type: Number, default: 0 },
      },
    ],
    currentTurnIndex: { type: Number, default: 0 },
    currentTurn: { type: Schema.Types.ObjectId, ref: 'User' },
    gameState: { type: Schema.Types.Mixed, default: {} },
    moveHistory: [
      {
        moveNumber: Number,
        playerId: { type: Schema.Types.ObjectId, ref: 'User' },
        playerName: String,
        move: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    chatMessages: [
      {
        messageId: String,
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        username: String,
        text: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    startedAt: Date,
    lastMoveAt: { type: Date, default: Date.now },
    completedAt: Date,
    inviteExpiresAt: Date,
    statsProcessedAt: Date,
    replay: { type: ReplaySchema, default: undefined },
    result: { type: ResultSchema, default: undefined },
    metadata: {
      ratedGame: { type: Boolean, default: false },
      mode: { type: String, enum: ['multiplayer', 'singlePlayer'], default: 'multiplayer' },
      difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
      boardSize: { type: String, enum: ['small', 'medium', 'large'] },
      wallLooping: Boolean,
      infiniteLetters: Boolean,
      tournament: String,
    },
  },
  { timestamps: true, optimisticConcurrency: true }
)

GameSchema.index({ createdAt: -1 })
GameSchema.index({ 'players.userId': 1 })
GameSchema.index({ status: 1 })
GameSchema.index({ gameCode: 1 }, { unique: true })
GameSchema.index({ inviteExpiresAt: 1 })

export const Game = mongoose.model<IGameDocument>('Game', GameSchema)
