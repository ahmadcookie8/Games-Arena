import mongoose, { Schema, Document } from 'mongoose'

export interface IGameSnapshotDocument extends Document {
  gameId: mongoose.Types.ObjectId
  snapshotNumber: number
  gameState: Record<string, unknown>
  moveNumber: number
  createdAt: Date
}

const GameSnapshotSchema = new Schema<IGameSnapshotDocument>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    snapshotNumber: { type: Number, required: true },
    gameState: { type: Schema.Types.Mixed, required: true },
    moveNumber: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

GameSnapshotSchema.index({ gameId: 1, snapshotNumber: -1 })

export const GameSnapshot = mongoose.model<IGameSnapshotDocument>('GameSnapshot', GameSnapshotSchema)
