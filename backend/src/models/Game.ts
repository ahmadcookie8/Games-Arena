import mongoose, { Schema, Document } from 'mongoose'

export interface IGameDocument extends Document {
  gameType: 'chess' | 'checkers' | 'ticTacToe' | 'uno' | 'president' | 'wisecracker'
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
  createdAt: Date
  startedAt?: Date
  lastMoveAt: Date
  completedAt?: Date
  result?: {
    winner?: mongoose.Types.ObjectId
    winnerName?: string
    loser?: mongoose.Types.ObjectId
    loserName?: string
    isDraw: boolean
    winType: string
  }
  metadata: {
    ratedGame: boolean
    tournament?: string
  }
}

const GameSchema = new Schema<IGameDocument>(
  {
    gameType: { type: String, enum: ['chess', 'checkers', 'ticTacToe', 'uno', 'president', 'wisecracker'], required: true },
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
    startedAt: Date,
    lastMoveAt: { type: Date, default: Date.now },
    completedAt: Date,
    result: {
      winner: { type: Schema.Types.ObjectId, ref: 'User' },
      winnerName: String,
      loser: { type: Schema.Types.ObjectId, ref: 'User' },
      loserName: String,
      isDraw: { type: Boolean, default: false },
      winType: String,
    },
    metadata: {
      ratedGame: { type: Boolean, default: false },
      tournament: String,
    },
  },
  { timestamps: true }
)

GameSchema.index({ createdAt: -1 })
GameSchema.index({ 'players.userId': 1 })
GameSchema.index({ status: 1 })
GameSchema.index({ gameCode: 1 }, { unique: true })

export const Game = mongoose.model<IGameDocument>('Game', GameSchema)
