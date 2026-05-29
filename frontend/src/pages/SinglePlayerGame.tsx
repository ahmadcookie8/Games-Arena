import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'
import Modal, { ModalVariant } from '../components/Modal'
import MoveHistory from '../components/MoveHistory'
import PageBackdrop from '../components/PageBackdrop'
import PlayerCard from '../components/PlayerCard'
import TicTacToeBoard from '../components/TicTacToeBoard'
import { useAuth } from '../hooks/useAuth'
import { useGameState } from '../hooks/useGameState'
import api from '../lib/api'
import { TicTacToeDifficulty } from '../types/game'

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

const DIFFICULTIES: TicTacToeDifficulty[] = ['easy', 'medium', 'hard']

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || 'Something went wrong'
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}

export default function SinglePlayerGame() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { game, loading, setGame } = useGameState(gameId)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const [selectedDifficulty, setSelectedDifficulty] = useState<TicTacToeDifficulty>('easy')

  const closeModal = useCallback(() => setModal(null), [])

  useEffect(() => {
    if (!game) return
    setSelectedDifficulty(game.metadata?.difficulty || 'easy')
  }, [game])

  async function updateDifficulty(difficulty: TicTacToeDifficulty) {
    if (!game || game.moveHistory.length > 0 || game.status !== 'active') return

    try {
      setSelectedDifficulty(difficulty)
      const res = await api.patch(`/api/games/${game._id}/single-player/settings`, { difficulty })
      setGame(res.data.game)
    } catch (err: unknown) {
      setModal({
        title: 'Could not update difficulty',
        message: getErrorMessage(err),
        variant: 'danger',
      })
    }
  }

  async function handleMove(move: string) {
    if (!game) return

    try {
      setIsMoving(true)
      const res = await api.post(`/api/games/${game._id}/single-player/move`, { move })
      setGame(res.data.game)
    } catch (err: unknown) {
      setModal({
        title: 'Move blocked',
        message: getErrorMessage(err),
        variant: 'danger',
      })
    } finally {
      setIsMoving(false)
    }
  }

  async function confirmCloseGame() {
    if (!game) return

    try {
      await api.post(`/api/games/${game._id}/close`)
      closeModal()
      navigate('/?tab=singlePlayer', { replace: true })
    } catch (err: unknown) {
      setModal({
        title: 'Could not close game',
        message: getErrorMessage(err),
        variant: 'danger',
      })
    }
  }

  function promptCloseGame() {
    if (!game || game.status !== 'active') return
    setModal({
      title: 'Close this solo game?',
      message: 'This will close the active solo match and remove it from your Single Player active games list.',
      variant: 'warning',
      primaryAction: {
        label: 'Close game',
        onClick: () => {
          void confirmCloseGame()
        },
      },
      secondaryAction: {
        label: 'Cancel',
        onClick: closeModal,
      },
    })
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-page text-text-primary">Loading game...</div>
  if (!game) return <div className="flex min-h-screen items-center justify-center bg-page text-text-primary">Game not found</div>

  const isCompleted = game.status === 'completed'
  const isActive = game.status === 'active'
  const isMyTurn = isActive && !isCompleted && !isMoving
  const difficulty = game.metadata?.difficulty || 'easy'
  const settingsLocked = game.moveHistory.length > 0 || !isActive
  const resultText = game.result?.isDraw
    ? 'Draw'
    : game.result?.winnerName
      ? game.result.winnerName === user?.username
        ? 'You won'
        : `${game.result.winnerName} won`
      : null

  return (
    <div className="relative min-h-screen overflow-hidden bg-page text-text-primary">
      <PageBackdrop intensity="quiet" />
      <Header />
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border/90 bg-surface/92 p-4 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <button
            onClick={() => navigate('/?tab=singlePlayer')}
            className="w-fit cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-overlay hover:text-text-primary"
          >
            Back
          </button>
          <div className="min-w-0 sm:text-center">
            <h1 className="text-gradient truncate text-xl font-semibold">Solo Tic Tac Toe</h1>
            <p className="text-sm capitalize text-text-muted">{difficulty} difficulty</p>
          </div>
          <div className="flex items-center gap-3">
            {isActive && (
              <button
                type="button"
                onClick={promptCloseGame}
                className="cursor-pointer rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-sm font-medium text-danger-text transition-colors duration-150 hover:opacity-90"
              >
                Close game
              </button>
            )}
            <div
              aria-live="polite"
              className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${
                isCompleted ? 'bg-success-subtle text-success-text' : isActive ? 'bg-accent-subtle text-accent' : 'bg-warning-subtle text-warning-text'
              }`}
            >
              {isCompleted ? resultText : isActive ? 'Your turn' : 'Game closed'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            {isCompleted && resultText && (
              <div className="mb-4 rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-center text-sm font-medium text-success-text">
                Game over: {resultText}
              </div>
            )}
            <section className="rounded-2xl border border-border/90 bg-surface/94 p-4 shadow-sm backdrop-blur-xl sm:p-5">
              <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-page p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Difficulty</h2>
                  <p className="text-xs text-text-muted">{settingsLocked ? 'Locked after the first move' : 'Choose before your first move'}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTIES.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => void updateDifficulty(level)}
                      disabled={settingsLocked}
                      className={`min-h-10 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-70 ${
                        selectedDifficulty === level ? 'bg-accent text-text-on-accent shadow-accent' : 'bg-elevated text-text-secondary hover:bg-overlay hover:text-text-primary'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              <TicTacToeBoard gameState={game.gameState} isMyTurn={isMyTurn} onMove={(move) => void handleMove(move)} />
            </section>
          </div>
          <aside className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-border/90 bg-surface/94 p-4 shadow-sm backdrop-blur-xl">
              <h3 className="mb-3 text-base font-semibold text-text-primary">Player</h3>
              <div className="space-y-2">
                {game.players.map((p) => (
                  <PlayerCard key={p.userId} player={p} isCurrentTurn={isActive} />
                ))}
              </div>
            </div>
            <MoveHistory moves={game.moveHistory} />
          </aside>
        </div>
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
