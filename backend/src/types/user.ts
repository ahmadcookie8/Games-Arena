export interface UserStats {
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  gamesDraw: number
  winRate: number
}

export interface UserPreferences {
  theme: 'light' | 'dark'
  notifications: boolean
  autoRematch: boolean
}

export interface IUser {
  _id: string
  username: string
  email?: string
  createdAt: Date
  updatedAt: Date
  stats: UserStats
  lastSeenAt: Date
  isActive: boolean
  preferences?: UserPreferences
}
