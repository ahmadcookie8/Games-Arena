import mongoose, { Schema, Document } from 'mongoose'

export interface IMoveDocument extends Document {
  gameId: mongoose.Types.ObjectId
  moveNumber: number
  playerId: mongoose.Types.ObjectId
  playerName: string
  move: string
  timestamp: Date
  index: number
}

const MoveSchema = new Schema<IMoveDocument>({
  gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
  moveNumber: { type: Number, required: true },
  playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  playerName: { type: String, required: true },
  move: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  index: { type: Number, required: true },
})

MoveSchema.index({ gameId: 1, moveNumber: 1 })
MoveSchema.index({ gameId: 1, index: 1 })

export const Move = mongoose.model<IMoveDocument>('Move', MoveSchema)
