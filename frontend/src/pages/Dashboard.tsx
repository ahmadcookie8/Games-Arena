import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Game, GameType } from '../types/game'
import api from '../lib/api'
import Leaderboard from '../components/Leaderboard'
import { useSocket } from '../hooks/useSocket'

const GAME_TYPES: GameType[] = ['ticTacToe']

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { on } = useSocket()
  const [games, setGames] = useState<{ active: Game[]; waiting: Game[]; completed: Game[] }>({ active: [], waiting: [], completed: [] })
  const [joinCode, setJoinCode] = useState('')

  async function fetchGames() {
    const res = await api.get('/api/games')
    setGames(res.data)
  }

  useEffect(() => {
    fetchGames()
  }, [])

  useEffect(() => {
    return on('gamesChanged', () => {
      fetchGames()
    })
  }, [])

  async function handleCreate(gameType: GameType) {
    const res = await api.post('/api/games/create', { gameType })
    navigate(`/game/${res.data.gameId}`)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const res = await api.post('/api/games/join', { gameCode: joinCode.toUpperCase() })
    navigate(`/game/${res.data.game._id}`)
  }

  async function handleLogout() {
    await logout()
    navigate('/auth')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Games Arena</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">@{user?.username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white">Logout</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">New Game</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {GAME_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => handleCreate(type)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg capitalize"
                >
                  {type}
                </button>
              ))}
            </div>
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Game code (e.g. ABC123)"
                maxLength={6}
                className="flex-1 px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg">
                Join
              </button>
            </form>
          </section>

          <section className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Active Games ({games.active.length})</h2>
            {games.active.length === 0 ? (
              <p className="text-gray-400">No active games. Create one above!</p>
            ) : (
              <div className="space-y-2">
                {games.active.map((game) => (
                  <button
                    key={game._id}
                    onClick={() => navigate(`/game/${game._id}`)}
                    className="w-full flex justify-between items-center px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
                  >
                    <span className="font-medium">Tic Tac Toe</span>
                    <span className="text-gray-400 text-sm">{game.gameCode}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Completed Games</h2>
            {games.completed.slice(0, 5).map((game) => (
              <div key={game._id} className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="capitalize">{game.gameType}</span>
                <span className={`text-sm ${game.result?.winnerName === user?.username ? 'text-green-400' : 'text-red-400'}`}>
                  {game.result?.isDraw ? 'Draw' : game.result?.winnerName === user?.username ? 'Win' : 'Loss'}
                </span>
              </div>
            ))}
          </section>
        </div>

        <aside>
          <Leaderboard />
        </aside>
      </div>
    </div>
  )
}
