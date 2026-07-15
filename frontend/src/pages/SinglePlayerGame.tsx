import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'
import Modal, { ModalVariant } from '../components/Modal'
import PageBackdrop from '../components/PageBackdrop'
import { TabletopRouteMasthead } from '../components/TabletopShell'
import TicTacToeExperience from '../components/TicTacToeExperience'
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
  const [isReplaying, setIsReplaying] = useState(false)

  const closeModal = useCallback(() => setModal(null), [])

  async function updateDifficulty(difficulty: TicTacToeDifficulty) {
    if (!game || game.moveHistory.length > 0 || game.status !== 'active') return

    try {
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

  async function playAgain() {
    if (!game || isReplaying) return

    try {
      setIsReplaying(true)
      const res = await api.post('/api/games/single-player/create', {
        gameType: 'ticTacToe',
        difficulty,
      })
      navigate(`/single-player/tic-tac-toe/${res.data.gameId || res.data.game?._id}`, { replace: true })
    } catch (err: unknown) {
      setModal({
        title: 'Could not start replay',
        message: getErrorMessage(err),
        variant: 'danger',
      })
    } finally {
      setIsReplaying(false)
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
  const difficulty = game.metadata?.difficulty || 'easy'
  const resultText = game.result?.isDraw
    ? 'Draw'
    : game.result?.winnerName
      ? game.result.winnerName === user?.username
        ? 'You won'
        : `${game.result.winnerName} won`
      : null
  const statusLabel = isCompleted ? resultText ?? 'Complete' : isActive ? 'Your turn' : 'Game closed'

  return (
    <div className="relative min-h-screen overflow-hidden bg-page text-text-primary">
      <PageBackdrop intensity="quiet" />
      <Header />
      <main className="relative z-10 mx-auto max-w-[92rem] px-4 py-4 sm:px-6">
        <TabletopRouteMasthead
          eyebrow={`${difficulty} difficulty`}
          title="Solo Tic Tac Toe"
          statusLabel={statusLabel}
          statusTone={isCompleted ? 'success' : isActive ? 'default' : 'warning'}
          onBack={() => navigate('/?tab=singlePlayer')}
          onClose={isActive ? promptCloseGame : undefined}
        />

        <TicTacToeExperience
          game={game}
          currentUserId={user?._id}
          isMoving={isMoving}
          isReplaying={isReplaying}
          onMove={handleMove}
          onPlayAgain={playAgain}
          onDifficultyChange={updateDifficulty}
        />
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
