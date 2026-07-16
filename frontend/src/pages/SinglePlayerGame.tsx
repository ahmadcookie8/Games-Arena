import { useCallback, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { GameRouteLoading, GameRouteUnavailable } from '../components/GameRouteState'
import GameShell from '../components/GameShell'
import Modal, { type ModalAction, type ModalVariant } from '../components/Modal'
import TicTacToeExperience from '../components/TicTacToeExperience'
import { useAuth } from '../hooks/useAuth'
import { useGameState } from '../hooks/useGameState'
import api from '../lib/api'
import { getGameMode } from '../lib/gameCatalog'
import { TicTacToeDifficulty } from '../types/game'

interface ModalState {
  title: string
  message: string
  variant: ModalVariant
  primaryAction?: ModalAction
  secondaryAction?: ModalAction
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
  const { game, loading, error, refetch, setGame } = useGameState(gameId)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const [isReplaying, setIsReplaying] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const closingRef = useRef(false)

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
    if (!game || closingRef.current) return

    closingRef.current = true
    setIsClosing(true)
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
    } finally {
      closingRef.current = false
      setIsClosing(false)
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
        variant: 'danger',
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

  if (loading) return <GameRouteLoading label="Loading solo arena" />
  if (!game) {
    return (
      <GameRouteUnavailable
        title={error === 'Game not found' ? 'Game not found' : 'This solo arena is unavailable'}
        description={error}
        onRetry={refetch}
        onBack={() => navigate('/?tab=singlePlayer')}
      />
    )
  }
  if (game.gameType !== 'ticTacToe' || getGameMode(game) !== 'singlePlayer') {
    return (
      <GameRouteUnavailable
        title="This is not a solo Tic Tac Toe game"
        description="Return to Single Player and open the matching arena from your active games."
        onBack={() => navigate('/?tab=singlePlayer')}
      />
    )
  }

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
    <>
      <GameShell
        eyebrow={`${difficulty} difficulty`}
        title="Solo Tic Tac Toe"
        statusLabel={statusLabel}
        announceStatus
        statusTone={isCompleted ? 'success' : isActive ? 'default' : 'warning'}
        onBack={() => navigate('/?tab=singlePlayer')}
        onClose={isActive ? promptCloseGame : undefined}
      >
        <TicTacToeExperience
          game={game}
          currentUserId={user?._id}
          isMoving={isMoving}
          isReplaying={isReplaying}
          onMove={handleMove}
          onPlayAgain={playAgain}
          onDifficultyChange={updateDifficulty}
        />
      </GameShell>

      <Modal
        isOpen={Boolean(modal)}
        title={modal?.title || ''}
        variant={modal?.variant}
        primaryAction={modal?.primaryAction ? {
          ...modal.primaryAction,
          loading: isClosing && modal.primaryAction.variant === 'danger',
          loadingText: 'Closing game…',
        } : undefined}
        secondaryAction={modal?.secondaryAction}
        onClose={() => { if (!isClosing) closeModal() }}
      >
        {modal?.message}
      </Modal>
    </>
  )
}
