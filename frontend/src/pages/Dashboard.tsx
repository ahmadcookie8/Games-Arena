import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { Game, GameType } from '../types/game'
import api from '../lib/api'
import Leaderboard from '../components/Leaderboard'
import Header from '../components/Header'
import Modal, { ModalVariant } from '../components/Modal'
import { useSocket } from '../hooks/useSocket'
import { getGameLabel } from '../lib/gameRules'
import ticTacToeThumb from '../assets/game-tic-tac-toe.png'
import wisecrackerThumb from '../assets/game-wisecracker.png'

const GAME_TYPES: GameType[] = ['ticTacToe', 'wisecracker']
const THUMBNAILS: Partial<Record<GameType, string>> = {
  ticTacToe: ticTacToeThumb,
  wisecracker: wisecrackerThumb,
}

interface ModalState {
  title: string
  message: string
  variant: ModalVariant
  primaryAction?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { on } = useSocket()
  const [games, setGames] = useState<{ active: Game[]; waiting: Game[]; completed: Game[] }>({ active: [], waiting: [], completed: [] })
  const [joinCode, setJoinCode] = useState('')
  const [modal, setModal] = useState<ModalState | null>(null)

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
    try {
      const res = await api.post('/api/games/create', { gameType })
      navigate(`/game/${res.data.gameId}`)
    } catch (err: unknown) {
      showGenericErrorModal(err, `Could not create ${getGameLabel(gameType)}`)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const normalizedCode = joinCode.trim().toUpperCase()
    try {
      const res = await api.post('/api/games/join', { gameCode: normalizedCode })
      navigate(`/game/${res.data.game._id}`)
    } catch (err: unknown) {
      showJoinErrorModal(err, normalizedCode)
    }
  }

  function closeModal() {
    setModal(null)
  }

  function getErrorMessage(err: unknown): string {
    if (axios.isAxiosError(err)) {
      return err.response?.data?.error || err.message || 'Something went wrong'
    }
    return err instanceof Error ? err.message : 'Something went wrong'
  }

  function showGenericErrorModal(err: unknown, title: string) {
    setModal({
      title,
      message: getErrorMessage(err),
      variant: 'danger',
    })
  }

  function showJoinErrorModal(err: unknown, normalizedCode: string) {
    const message = getErrorMessage(err)
    const matchingGame = [...games.active, ...games.waiting, ...games.completed].find((game) => game.gameCode === normalizedCode)

    if (message === 'Already in this game') {
      setModal({
        title: 'You are already in this game',
        message: 'This game appears to already be open for your account in another tab, browser, or device. You can resume it here instead.',
        variant: 'info',
        primaryAction: matchingGame
          ? {
              label: 'Resume here',
              onClick: () => {
                closeModal()
                navigate(`/game/${matchingGame._id}`)
              },
            }
          : undefined,
        secondaryAction: matchingGame ? { label: 'Close', onClick: closeModal } : undefined,
      })
      return
    }

    if (message === 'Game is full') {
      setModal({
        title: 'Game is full',
        message: 'This Tic Tac Toe room already has two players. Choose another active game or create a new room.',
        variant: 'warning',
      })
      return
    }

    if (message === 'Game is not active') {
      setModal({
        title: 'Game is not active',
        message: 'This room can no longer be joined because it is completed, paused, or unavailable.',
        variant: 'warning',
      })
      return
    }

    if (message === 'Game not found') {
      setModal({
        title: 'Game not found',
        message: 'Check the game code and try again. Codes are six characters long and are not case-sensitive.',
        variant: 'danger',
      })
      return
    }

    setModal({
      title: 'Could not join game',
      message,
      variant: 'danger',
    })
  }

  return (
    <div className="min-h-screen bg-page text-text-primary">
      <Header />

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="animate-fade-in rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-accent">Welcome back, @{user?.username}</p>
                <h1 className="text-3xl font-bold text-text-primary">Games Arena</h1>
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-medium text-accent">Live lobby</span>
            </div>

            <h2 className="mb-3 text-lg font-semibold text-text-primary">Play Now</h2>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {GAME_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => handleCreate(type)}
                  className="group overflow-hidden rounded-xl border border-border bg-elevated text-left shadow-sm transition-all duration-150 hover:border-border-strong hover:bg-overlay"
                >
                  <img src={THUMBNAILS[type]} alt="" className="h-28 w-full object-cover transition-transform duration-100 group-hover:scale-[1.02]" />
                  <div className="flex items-center justify-between gap-3 p-3">
                    <span>
                      <span className="block text-base font-semibold text-text-primary">{getGameLabel(type)}</span>
                      <span className="block text-xs text-text-muted">Create a multiplayer room</span>
                    </span>
                    <span className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-text-on-accent">Create</span>
                  </div>
                </button>
              ))}
            </div>
            <form onSubmit={handleJoin} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Game code (e.g. ABC123)"
                maxLength={6}
                className="min-h-11 flex-1 rounded-lg border border-border bg-overlay px-3 py-2 font-mono text-text-primary placeholder:font-sans placeholder:text-text-muted transition-colors duration-150 focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/20"
              />
              <button type="submit" className="min-h-11 rounded-lg bg-success px-4 py-2 text-sm font-medium text-text-on-accent transition-colors duration-150 hover:opacity-90">
                Join
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Active Games ({games.active.length})</h2>
            {games.active.length === 0 ? (
              <p className="rounded-lg border border-border bg-page px-4 py-6 text-center text-sm text-text-muted">No active games. Create one above.</p>
            ) : (
              <div className="space-y-2">
                {games.active.map((game) => (
                  <button
                    key={game._id}
                    onClick={() => navigate(`/game/${game._id}`)}
                    className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-elevated px-4 py-3 text-left transition-all duration-150 hover:border-border-strong hover:bg-overlay"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-text-primary">{getGameLabel(game.gameType)}</span>
                      <span className="block text-xs text-text-muted">{game.players.length} player{game.players.length === 1 ? '' : 's'}</span>
                    </span>
                    <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 font-mono text-xs font-medium text-accent">{game.gameCode}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-text-primary">Completed Games</h2>
              <button onClick={() => navigate('/history')} className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-overlay hover:text-text-primary">
                View all
              </button>
            </div>
            <div className="space-y-2">
              {games.completed.slice(0, 5).map((game) => {
                const label = game.result?.isDraw ? 'Draw' : game.result?.winnerName === user?.username ? 'Win' : 'Loss'
                const labelClass = game.result?.isDraw ? 'bg-warning-subtle text-warning-text' : label === 'Win' ? 'bg-success-subtle text-success-text' : 'bg-danger-subtle text-danger-text'
                return (
                  <div key={game._id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-page px-3 py-2">
                    <span className="min-w-0 truncate text-sm font-medium text-text-primary">{getGameLabel(game.gameType)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${labelClass}`}>{label}</span>
                  </div>
                )
              })}
              {games.completed.length === 0 && <p className="rounded-lg border border-border bg-page px-4 py-6 text-center text-sm text-text-muted">No completed games yet.</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <Leaderboard />
        </aside>
      </main>

      <Modal
        isOpen={Boolean(modal)}
        title={modal?.title || ''}
        variant={modal?.variant}
        primaryAction={modal?.primaryAction}
        secondaryAction={modal?.secondaryAction}
        onClose={closeModal}
      >
        {modal?.message}
      </Modal>
    </div>
  )
}
