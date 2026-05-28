import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'
import { TicTacToeDifficulty } from '../types/game'

interface SinglePlayerLeaderboardEntry {
  rank: number
  username: string
  difficulty: TicTacToeDifficulty
  wins: number
  losses: number
  draws: number
  gamesPlayed: number
  winRate: number
}

function getDifficultyClass(difficulty: TicTacToeDifficulty): string {
  switch (difficulty) {
    case 'hard': return 'bg-danger-subtle text-danger-text'
    case 'medium': return 'bg-warning-subtle text-warning-text'
    case 'easy': return 'bg-success-subtle text-success-text'
  }
}

export default function SinglePlayerLeaderboard() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<SinglePlayerLeaderboardEntry[]>([])

  const fetchLeaderboard = useCallback(() => {
    void api.get('/api/leaderboards/single-player/ticTacToe').then((res) => {
      setEntries(res.data.leaderboard || [])
    })
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  return (
    <div className="rounded-2xl border border-border/90 bg-surface/92 p-4 shadow-sm backdrop-blur-xl">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text-primary">Solo High Scores</h3>
        <p className="text-xs text-text-muted">Wins by difficulty</p>
      </div>

      <div className="space-y-1">
        {entries.map((entry) => (
          <div
            key={`${entry.rank}-${entry.username}-${entry.difficulty}`}
            className={`flex items-center gap-2 rounded-lg px-2 py-2 transition-colors duration-150 ${entry.username === user?.username ? 'bg-accent-subtle' : 'hover:bg-elevated'}`}
          >
            <span className="w-7 text-center text-sm text-text-muted">#{entry.rank}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{entry.username}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getDifficultyClass(entry.difficulty)}`}>{entry.difficulty}</span>
            <span className="text-sm font-medium text-success">{entry.wins}W</span>
            <span className="font-mono text-xs text-text-muted">{(entry.winRate * 100).toFixed(0)}%</span>
          </div>
        ))}
        {entries.length === 0 && <p className="rounded-lg bg-page px-3 py-6 text-center text-sm text-text-muted">No solo scores yet</p>}
      </div>
    </div>
  )
}
