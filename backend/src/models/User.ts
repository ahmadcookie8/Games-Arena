import mongoose, { Schema, Document } from 'mongoose'

export interface IUserDocument extends Document {
  username: string
  email?: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
  stats: {
    gamesPlayed: number
    gamesWon: number
    gamesLost: number
    gamesDraw: number
    winRate: number
  }
  lastSeenAt: Date
  isActive: boolean
  preferences?: {
    theme: 'light' | 'dark'
    notifications: boolean
    autoRematch: boolean
  }
}

const UserSchema = new Schema<IUserDocument>(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, lowercase: true, trim: true, sparse: true },
    passwordHash: { type: String, required: true, select: false },
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      gamesLost: { type: Number, default: 0 },
      gamesDraw: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
    },
    lastSeenAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    preferences: {
      theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
      notifications: { type: Boolean, default: true },
      autoRematch: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
)

UserSchema.index({ username: 1 }, { unique: true })
UserSchema.index({ email: 1 }, { unique: true, sparse: true })

export const User = mongoose.model<IUserDocument>('User', UserSchema)
