import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import PageBackdrop from '../components/PageBackdrop'
import { useAuth } from '../hooks/useAuth'
import { useReveal } from '../hooks/useReveal'
import api from '../lib/api'
import { getGameLabel } from '../lib/gameRules'
import { Game, GameType } from '../types/game'

export default function GameHistory() {
  useReveal()
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
    <div className="relative min-h-screen overflow-hidden bg-page text-text-primary">
      <PageBackdrop intensity="quiet" />
      <Header />
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="reveal mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-gradient text-3xl font-extrabold">Game History</h1>
            <p className="mt-1 text-sm text-text-secondary">Review completed games and resume active matches.</p>
          </div>
          <button onClick={() => navigate('/')} className="w-fit cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-overlay hover:text-text-primary">
            Dashboard
          </button>
        </div>

        <div className="reveal mb-6 flex flex-wrap gap-2">
          {(['all', 'chess', 'ticTacToe', 'wisecracker', 'checkers', 'uno', 'president'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`min-h-11 cursor-pointer rounded-full px-3 py-1 text-sm font-medium transition-colors duration-150 md:min-h-0 ${
                filter === type ? 'bg-accent text-text-on-accent' : 'bg-elevated text-text-secondary hover:bg-overlay hover:text-text-primary'
              }`}
            >
              {type === 'all' ? 'All' : getGameLabel(type)}
            </button>
          ))}
        </div>

        <div className="reveal space-y-2">
          {filtered.map((game) => (
            <div
              key={game._id}
              className="card-glow flex flex-col gap-3 rounded-xl border border-border bg-surface/94 px-4 py-3 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <span className="block font-medium text-text-primary">{getGameLabel(game.gameType)}</span>
                <span className="block truncate text-sm text-text-muted">{game.players.map((p) => p.username).join(' vs ')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {game.status === 'completed' && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    game.result?.winnerName === user?.username
                      ? 'bg-success-subtle text-success-text'
                      : game.result?.isDraw
                        ? 'bg-warning-subtle text-warning-text'
                        : 'bg-danger-subtle text-danger-text'
                  }`}
                  >
                    {game.result?.isDraw ? 'Draw' : game.result?.winnerName === user?.username ? 'Win' : 'Loss'}
                  </span>
                )}
                {game.status === 'active' && (
                  <button
                    onClick={() => navigate(`/game/${game._id}`)}
                    className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-text-on-accent shadow-accent transition-colors duration-150 hover:bg-accent-hover"
                  >
                    Resume
                  </button>
                )}
                <span className="text-xs text-text-muted">{new Date(game.lastMoveAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="rounded-2xl border border-border bg-surface px-4 py-10 text-center text-sm text-text-muted shadow-sm">No games found.</p>}
        </div>
      </main>
    </div>
  )
}
