export interface UserStats {
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  gamesDraw: number
  winRate: number
}

export interface User {
  _id: string
  username: string
  email?: string
  createdAt: string
  stats: UserStats
}
