import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

interface LeaderboardEntry {
  rank: number
  username: string
  wins: number
  losses: number
  winRate: number
}

export default function Leaderboard() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const gameType = 'ticTacToe'

  useEffect(() => {
    api.get(`/api/leaderboards/${gameType}`).then((res) => setEntries(res.data.leaderboard || []))
  }, [gameType])

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text-primary">Leaderboard</h3>
        <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-medium text-accent">Tic Tac Toe</span>
      </div>

      <div className="space-y-1">
        {entries.map((entry) => (
          <div
            key={entry.rank}
            className={`flex items-center gap-3 rounded-lg px-2 py-2 ${entry.username === user?.username ? 'bg-accent-subtle' : 'hover:bg-elevated'}`}
          >
            <span className="w-7 text-center text-sm text-text-muted">#{entry.rank}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{entry.username}</span>
            <span className="text-sm font-medium text-success">{entry.wins}W</span>
            <span className="font-mono text-xs text-text-muted">{(entry.winRate * 100).toFixed(0)}%</span>
          </div>
        ))}
        {entries.length === 0 && <p className="rounded-lg bg-page px-3 py-6 text-center text-sm text-text-muted">No data yet</p>}
      </div>
    </div>
  )
}
