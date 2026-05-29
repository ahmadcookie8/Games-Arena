import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import GameChat from '../components/GameChat'
import GameInvite from '../components/GameInvite'
import Header from '../components/Header'
import Modal, { ModalVariant } from '../components/Modal'
import MoveHistory from '../components/MoveHistory'
import PageBackdrop from '../components/PageBackdrop'
import PlayerCard from '../components/PlayerCard'
import ScrabbleBoard from '../components/ScrabbleBoard'
import TicTacToeBoard from '../components/TicTacToeBoard'
import WisecrackerBoard from '../components/WisecrackerBoard'
import { useAuth } from '../hooks/useAuth'
import { useGameState } from '../hooks/useGameState'
import { useSocket } from '../hooks/useSocket'
import api from '../lib/api'
import { getGameLabel } from '../lib/gameRules'
import { ChatMessage, Game } from '../types/game'

interface MoveResponse {
  success: boolean
  game?: Game
  error?: string
}

interface ChatResponse {
  success: boolean
  message?: ChatMessage
  error?: string
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

function getCloseGameModal(game: Game, onConfirm: () => void, onCancel: () => void): ModalState {
  return {
    title: 'Close this game?',
    message: `This will close the ${getGameLabel(game.gameType)} room and remove it from your active games list. Other players will no longer be able to join or continue it.`,
    variant: 'warning',
    primaryAction: {
      label: 'Close game',
      onClick: onConfirm,
    },
    secondaryAction: {
      label: 'Cancel',
      onClick: onCancel,
    },
  }
}

export default function GameBoard() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { game, loading, setGame } = useGameState(gameId)
  const { emit, on, connected } = useSocket()
  const [modal, setModal] = useState<ModalState | null>(null)
  const [isReplaying, setIsReplaying] = useState(false)
  const latestGameRef = useRef<Game | null>(null)

  useEffect(() => {
    latestGameRef.current = game
  }, [game])

  const showGameErrorModal = useCallback((error: string) => {
    const modalByError: Record<string, ModalState> = {
      'Waiting for another player': {
        title: 'Waiting for another player',
        message: 'This game needs another player before moves can be made. Share the invite code and try again once they join.',
        variant: 'warning',
      },
      'It is not your turn': {
        title: 'Not your turn',
        message: 'Hold up for the other player to make their move before playing again.',
        variant: 'info',
      },
      'You are not in this game': {
        title: 'You are not in this game',
        message: 'Only players who joined this game can make moves here.',
        variant: 'danger',
      },
      'Game is not active': {
        title: 'Game is not active',
        message: 'This game is completed, paused, or unavailable, so moves cannot be made right now.',
        variant: 'warning',
      },
      'Invalid move': {
        title: 'Invalid move',
        message: 'That move is not valid for the current board. Choose another option and try again.',
        variant: 'danger',
      },
    }

    setModal(modalByError[error] ?? {
      title: 'Action blocked',
      message: error,
      variant: 'danger',
    })
  }, [])

  useEffect(() => {
    if (!gameId || !connected) return
    emit('joinRoom', { gameId }, (res: { game?: Game; error?: string }) => {
      if (res.game) setGame(res.game)
      if (res.error) showGameErrorModal(res.error)
    })

    const offGameUpdated = on('gameUpdated', (data: unknown) => {
      const { game: updatedGame } = data as { game: Game }
      setGame(updatedGame)
    })

    const offMoveMade = on('moveMade', (data: unknown) => {
      const { game: updatedGame } = data as { game: Game }
      setGame(updatedGame)
    })

    const offGameOver = on('gameOver', (data: unknown) => {
      const { game: updatedGame } = data as { game: Game }
      setGame(updatedGame)
    })

    const offChatMessage = on('chatMessage', (data: unknown) => {
      const { gameId: messageGameId, message } = data as { gameId: string; message: ChatMessage }
      const currentGame = latestGameRef.current
      if (messageGameId !== gameId || !message || !currentGame) return
      const existing = currentGame.chatMessages || []
      if (existing.some((item) => item.messageId === message.messageId)) return
      setGame({ ...currentGame, chatMessages: [...existing, message].slice(-100) })
    })

    const offReplayCreated = on('gameReplayCreated', (data: unknown) => {
      const { oldGameId, gameId: replayGameId } = data as { oldGameId?: string; gameId?: string }
      if (oldGameId !== gameId || !replayGameId) return
      navigate(`/game/${replayGameId}`, { replace: true })
    })

    return () => {
      offGameUpdated()
      offMoveMade()
      offGameOver()
      offChatMessage()
      offReplayCreated()
    }
  }, [gameId, connected, emit, on, navigate, setGame, showGameErrorModal])

  function handleMove(move: unknown): Promise<MoveResponse> {
    return new Promise((resolve) => {
      emit('makeMove', { gameId, move }, (res: MoveResponse) => {
        if (res.game) setGame(res.game)
        if (!res.success) showGameErrorModal(res.error || 'Move failed')
        resolve(res)
      })
    })
  }

  function handleTicTacToeMove(move: string) {
    void handleMove(move)
  }

  function handleSendChat(text: string): Promise<ChatResponse> {
    return new Promise((resolve) => {
      emit('sendChatMessage', { gameId, text }, (res: ChatResponse) => {
        resolve(res)
      })
    })
  }

  function closeModal() {
    setModal(null)
  }

  async function confirmCloseGame() {
    if (!game) return

    try {
      await api.post(`/api/games/${game._id}/close`)
      closeModal()
      navigate('/?tab=multiplayer', { replace: true })
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message || 'Could not close game'
        : err instanceof Error
          ? err.message
          : 'Could not close game'
      setModal({
        title: 'Could not close game',
        message,
        variant: 'danger',
      })
    }
  }

  async function playAgain() {
    if (!game || isReplaying) return

    try {
      setIsReplaying(true)
      const res = await api.post(`/api/games/${game._id}/replay`)
      navigate(`/game/${res.data.game._id}`, { replace: true })
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message || 'Could not start replay'
        : err instanceof Error
          ? err.message
          : 'Could not start replay'
      setModal({
        title: 'Could not start replay',
        message,
        variant: 'danger',
      })
    } finally {
      setIsReplaying(false)
    }
  }

  function promptCloseGame() {
    if (!game || game.status !== 'active') return
    setModal(getCloseGameModal(game, () => {
      void confirmCloseGame()
    }, closeModal))
  }

  useEffect(() => {
    if (!game || game.status !== 'abandoned') return
    setModal({
      title: 'Game closed',
      message: 'This game was closed and is no longer available. Return to the dashboard to start or join another game.',
      variant: 'info',
      primaryAction: {
        label: 'Return to dashboard',
        onClick: () => navigate('/?tab=multiplayer', { replace: true }),
      },
    })
  }, [game, navigate])

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-page text-text-primary">Loading game...</div>
  if (!game) return <div className="flex min-h-screen items-center justify-center bg-page text-text-primary">Game not found</div>

  const myIndex = game.players.findIndex((p) => p.userId === user?._id)
  const minPlayers = game.gameType === 'wisecracker' ? 3 : 2
  const isActive = game.status === 'active'
  const isWaitingForPlayer = isActive && game.players.length < minPlayers && game.gameType !== 'wisecracker'
  const isCompleted = game.status === 'completed'
  const isMyTurn = isActive && !isWaitingForPlayer && !isCompleted && game.currentTurnIndex === myIndex
  const currentPlayer = game.players[game.currentTurnIndex]
  const resultText = game.result?.isDraw
    ? 'Draw'
    : game.result?.winnerName
      ? `${game.result.winnerName} won`
      : null
  const canPlayAgain = isCompleted && (game.gameType === 'ticTacToe' || game.gameType === 'scrabble')

  return (
    <div className="relative min-h-screen overflow-hidden bg-page text-text-primary">
      <PageBackdrop intensity="quiet" />
      <Header />
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border/90 bg-surface/92 p-4 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <button
            onClick={() => navigate('/?tab=multiplayer')}
            className="w-fit cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-overlay hover:text-text-primary"
          >
            Back
          </button>
          <div className="min-w-0 sm:text-center">
            <h1 className="text-gradient truncate text-xl font-semibold">{getGameLabel(game.gameType)}</h1>
            <p className="text-sm text-text-muted">
              Code: <span className="font-mono font-medium text-accent">{game.gameCode}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canPlayAgain && (
              <button
                type="button"
                onClick={() => void playAgain()}
                disabled={isReplaying}
                className="cursor-pointer rounded-lg bg-accent px-3 py-2 text-sm font-medium text-text-on-accent shadow-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isReplaying ? 'Starting...' : 'Play Again'}
              </button>
            )}
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
                isMyTurn
                  ? 'bg-accent-subtle text-accent'
                  : isCompleted
                    ? 'bg-success-subtle text-success-text'
                    : game.status === 'abandoned'
                      ? 'bg-warning-subtle text-warning-text'
                    : isWaitingForPlayer
                      ? 'bg-warning-subtle text-warning-text'
                      : 'bg-overlay text-text-secondary'
              }`}
            >
              {game.gameType === 'wisecracker'
                ? game.status
                : isCompleted
                  ? resultText
                  : game.status === 'abandoned'
                    ? 'Game closed'
                  : isWaitingForPlayer
                    ? 'Waiting for player'
                    : isMyTurn
                      ? 'Your turn'
                      : `${currentPlayer?.username}'s turn`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            {isWaitingForPlayer && (
              <div className="mb-4">
                <GameInvite gameCode={game.gameCode} />
              </div>
            )}
            {isCompleted && resultText && (
              <div className="mb-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-center text-sm font-medium text-success-text sm:flex-row">
                Game over: {resultText}
                {canPlayAgain && (
                  <button
                    type="button"
                    onClick={() => void playAgain()}
                    disabled={isReplaying}
                    className="min-h-10 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent shadow-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isReplaying ? 'Starting...' : 'Play Again'}
                  </button>
                )}
              </div>
            )}
            <section className="rounded-2xl border border-border/90 bg-surface/94 p-4 shadow-sm backdrop-blur-xl sm:p-5">
              {game.gameType === 'ticTacToe' && <TicTacToeBoard gameState={game.gameState} isMyTurn={isMyTurn} onMove={handleTicTacToeMove} />}
              {game.gameType === 'wisecracker' && <WisecrackerBoard game={game} user={user} onMove={handleMove} />}
              {game.gameType === 'scrabble' && <ScrabbleBoard game={game} user={user} isMyTurn={isMyTurn} onMove={handleMove} />}
            </section>
          </div>
          <aside className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-border/90 bg-surface/94 p-4 shadow-sm backdrop-blur-xl">
              <h3 className="mb-3 text-base font-semibold text-text-primary">Players</h3>
              <div className="space-y-2">
                {game.players.map((p, i) => (
                  <PlayerCard key={p.userId} player={p} isCurrentTurn={!isCompleted && i === game.currentTurnIndex} />
                ))}
              </div>
            </div>
            <MoveHistory moves={game.moveHistory} />
            {game.metadata?.mode !== 'singlePlayer' && <GameChat messages={game.chatMessages || []} currentUserId={user?._id} onSend={handleSendChat} />}
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
