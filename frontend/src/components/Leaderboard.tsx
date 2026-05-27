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
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Leaderboard</h3>
        <span className="text-sm text-gray-400">Tic Tac Toe</span>
      </div>

      <div className="space-y-1">
        {entries.map((entry) => (
          <div
            key={entry.rank}
            className={`flex items-center gap-3 py-2 px-2 rounded-lg ${entry.username === user?.username ? 'bg-blue-900' : ''}`}
          >
            <span className="w-6 text-center text-gray-400 text-sm">#{entry.rank}</span>
            <span className="flex-1 font-medium">{entry.username}</span>
            <span className="text-green-400 text-sm">{entry.wins}W</span>
            <span className="text-gray-400 text-xs">{(entry.winRate * 100).toFixed(0)}%</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No data yet</p>}
      </div>
    </div>
  )
}
