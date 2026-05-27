import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Game, GameType } from '../types/game'
import api from '../lib/api'
import { getGameLabel } from '../lib/gameRules'

export default function GameHistory() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [games, setGames] = useState<Game[]>([])
  const [filter, setFilter] = useState<GameType | 'all'>('all')

  useEffect(() => {
    api.get('/api/games').then((res) => {
      setGames([...res.data.completed, ...res.data.active])
    })
  }, [])

  const filtered = filter === 'all' ? games : games.filter((g) => g.gameType === filter)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Game History</h1>
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white">← Dashboard</button>
      </header>

      <div className="flex gap-2 mb-6">
        {(['all', 'chess', 'ticTacToe', 'wisecracker', 'checkers', 'uno', 'president'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1 rounded-full text-sm ${filter === type ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            {type === 'all' ? 'All' : getGameLabel(type)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((game) => (
          <div
            key={game._id}
            className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3"
          >
            <div>
              <span className="font-medium">{getGameLabel(game.gameType)}</span>
              <span className="ml-3 text-sm text-gray-400">{game.players.map((p) => p.username).join(' vs ')}</span>
            </div>
            <div className="flex items-center gap-4">
              {game.status === 'completed' && (
                <span className={`text-sm ${game.result?.winnerName === user?.username ? 'text-green-400' : game.result?.isDraw ? 'text-yellow-400' : 'text-red-400'}`}>
                  {game.result?.isDraw ? 'Draw' : game.result?.winnerName === user?.username ? 'Win' : 'Loss'}
                </span>
              )}
              {game.status === 'active' && (
                <button
                  onClick={() => navigate(`/game/${game._id}`)}
                  className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Resume
                </button>
              )}
              <span className="text-xs text-gray-500">{new Date(game.lastMoveAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-gray-400 text-center py-8">No games found.</p>}
      </div>
    </div>
  )
}
