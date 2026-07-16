import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import BrandMascot from '../components/BrandMascot'
import GameChat from '../components/GameChat'
import { GameRouteLoading, GameRouteUnavailable } from '../components/GameRouteState'
import GameShell from '../components/GameShell'
import GameInvite from '../components/GameInvite'
import Modal, { type ModalAction, type ModalVariant } from '../components/Modal'
import MoveHistory from '../components/MoveHistory'
import PlayerCard from '../components/PlayerCard'
import { Button, RouteState } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useGameState } from '../hooks/useGameState'
import { useSocket } from '../hooks/useSocket'
import api from '../lib/api'
import { canHostCloseGame, getCloseGamePrompt } from '../lib/gameClose'
import { getGameLabel } from '../lib/gameRules'
import { getGameMode } from '../lib/gameCatalog'
import { ChatMessage, Game } from '../types/game'

const PropertyManagementBoard = lazy(() => import('../components/PropertyManagementBoard'))
const ScrabbleBoard = lazy(() => import('../components/ScrabbleBoard'))
const TicTacToeExperience = lazy(() => import('../components/TicTacToeExperience'))
const WisecrackerBoard = lazy(() => import('../components/WisecrackerBoard'))

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
  primaryAction?: ModalAction
  secondaryAction?: ModalAction
}

function getCloseGameModal(game: Game, onConfirm: () => void, onCancel: () => void): ModalState {
  const prompt = getCloseGamePrompt(game)
  return {
    ...prompt,
    variant: 'warning',
    primaryAction: {
      label: 'Close game',
      onClick: onConfirm,
      variant: 'danger',
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
  const { game, loading, error, refetch, setGame } = useGameState(gameId)
  const { emitWithAck, on, connected } = useSocket()
  const [modal, setModal] = useState<ModalState | null>(null)
  const [isReplaying, setIsReplaying] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const latestGameRef = useRef<Game | null>(null)
  const interactionRootRef = useRef<HTMLDivElement | null>(null)
  const closingRef = useRef(false)

  useEffect(() => {
    latestGameRef.current = game
  }, [game])

  useEffect(() => {
    interactionRootRef.current?.toggleAttribute('inert', !connected)
  }, [connected, game])

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
    let cancelled = false

    void emitWithAck<{ game: Game }>('joinRoom', { gameId }).then((acknowledgement) => {
      if (cancelled) return
      if (acknowledgement.ok) setGame(acknowledgement.data.game)
      else showGameErrorModal(acknowledgement.error.message)
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
      cancelled = true
      offGameUpdated()
      offMoveMade()
      offGameOver()
      offChatMessage()
      offReplayCreated()
    }
  }, [gameId, connected, emitWithAck, on, navigate, setGame, showGameErrorModal])

  async function handleMove(move: unknown): Promise<MoveResponse> {
    if (!connected) return { success: false, error: 'Reconnecting to the game server.' }
    const acknowledgement = await emitWithAck<{ game: Game }>('makeMove', { gameId, move })
    if (acknowledgement.ok) {
      setGame(acknowledgement.data.game)
      return { success: true, game: acknowledgement.data.game }
    }

    showGameErrorModal(acknowledgement.error.message)
    return { success: false, error: acknowledgement.error.message }
  }

  async function handleSendChat(text: string): Promise<ChatResponse> {
    if (!connected) return { success: false, error: 'Chat will be available after the room reconnects.' }
    const acknowledgement = await emitWithAck<{ message: ChatMessage }>('sendChatMessage', { gameId, text })
    return acknowledgement.ok
      ? { success: true, message: acknowledgement.data.message }
      : { success: false, error: acknowledgement.error.message }
  }

  function closeModal() {
    setModal(null)
  }

  async function confirmCloseGame() {
    if (!game || closingRef.current) return

    closingRef.current = true
    setIsClosing(true)
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
    } finally {
      closingRef.current = false
      setIsClosing(false)
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
    if (!game || !canHostCloseGame(game, user?._id)) return
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

  if (loading) return <GameRouteLoading label="Loading multiplayer arena" />
  if (!game) {
    return (
      <GameRouteUnavailable
        title={error === 'Game not found' ? 'Game not found' : 'This multiplayer arena is unavailable'}
        description={error}
        onRetry={refetch}
        onBack={() => navigate('/?tab=multiplayer')}
      />
    )
  }
  if (getGameMode(game) !== 'multiplayer') {
    return (
      <GameRouteUnavailable
        title="This game belongs in the solo arcade"
        description="Open it from Single Player so its controls and run verification load correctly."
        onBack={() => navigate('/?tab=singlePlayer')}
      />
    )
  }

  const myIndex = game.players.findIndex((p) => p.userId === user?._id)
  const minPlayers = game.gameType === 'wisecracker' ? 3 : 2
  const isActive = game.status === 'active'
  const isWaitingForPlayer = isActive && game.players.length < minPlayers && game.gameType !== 'wisecracker' && game.gameType !== 'propertyManagement'
  const isCompleted = game.status === 'completed'
  const canCurrentUserClose = canHostCloseGame(game, user?._id)
  const isMyTurn = connected && isActive && !isWaitingForPlayer && !isCompleted && game.currentTurnIndex === myIndex
  const currentPlayer = game.players[game.currentTurnIndex]
  const resultText = game.result?.isDraw
    ? 'Draw'
    : game.result?.winnerName
      ? `${game.result.winnerName} won`
      : null
  const canPlayAgain = isCompleted && (game.gameType === 'ticTacToe' || game.gameType === 'scrabble')
  const isTabletopGame = ['propertyManagement', 'scrabble', 'ticTacToe', 'wisecracker'].includes(game.gameType)
  const gamePhase = (game.gameState as { phase?: string }).phase
  const tabletopEyebrow = game.gameType === 'wisecracker'
    ? 'Comedy table'
    : game.gameType === 'scrabble'
      ? 'Word table'
      : game.gameType === 'ticTacToe'
        ? 'Classic table'
        : 'Private table'
  const tabletopStatus = !connected
    ? 'Reconnecting...'
    : game.gameType === 'wisecracker' && gamePhase
    ? gamePhase.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
    : isCompleted
      ? resultText ?? 'Complete'
      : game.status === 'abandoned'
        ? 'Game closed'
        : isWaitingForPlayer
          ? 'Waiting for player'
          : isMyTurn
            ? 'Your turn'
            : currentPlayer
              ? `${currentPlayer.username}'s turn`
              : game.status

  return (
    <>
      <GameShell
        eyebrow={`${isTabletopGame ? tabletopEyebrow : 'Legacy table'} · ${game.status}`}
        title={getGameLabel(game.gameType)}
        gameCode={game.gameCode}
        statusLabel={tabletopStatus}
        announceStatus
        statusTone={!connected || isWaitingForPlayer ? 'warning' : isCompleted ? 'success' : 'default'}
        onBack={() => navigate('/?tab=multiplayer')}
        onClose={canCurrentUserClose ? promptCloseGame : undefined}
        width={isTabletopGame ? 'wide' : 'standard'}
        primaryAction={canPlayAgain ? {
          label: isReplaying ? 'Starting…' : 'Play Again',
          onClick: () => void playAgain(),
          disabled: isReplaying,
        } : undefined}
      >
        <div
          ref={interactionRootRef}
          aria-disabled={!connected || undefined}
          className={`transition-opacity duration-180 ${connected ? '' : 'opacity-70'}`}
        >
        <Suspense fallback={<div className="grid min-h-72 place-items-center rounded-2xl border border-border bg-surface/80 text-sm text-text-secondary" role="status">Preparing game table…</div>}>
          {game.gameType === 'propertyManagement' ? (
            <PropertyManagementBoard game={game} user={user} onMove={handleMove} onSendChat={handleSendChat} />
          ) : game.gameType === 'scrabble' ? (
            <ScrabbleBoard
              game={game}
              user={user}
              isMyTurn={isMyTurn}
              onMove={handleMove}
              onSendChat={handleSendChat}
            />
          ) : game.gameType === 'ticTacToe' ? (
            <TicTacToeExperience
              game={game}
              currentUserId={user?._id}
              connected={connected}
              isReplaying={isReplaying}
              onMove={handleMove}
              onPlayAgain={playAgain}
              onSendChat={handleSendChat}
            />
          ) : game.gameType === 'wisecracker' ? (
            <WisecrackerBoard
              game={game}
              user={user}
              onMove={handleMove}
              onSendChat={handleSendChat}
            />
          ) : (
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
                    className="ui-action-primary interactive-lift min-h-11 cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold shadow-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isReplaying ? 'Starting...' : 'Play Again'}
                  </button>
                )}
              </div>
            )}
            <RouteState
              tone="warning"
              icon={<BrandMascot sizes="48px" className="h-12 w-12 object-contain" />}
              title={`${getGameLabel(game.gameType)} is not currently available`}
              description="This legacy game record is safe, but its arena is staying closed while the active arcade lineup is being supported."
              action={<Button onClick={() => navigate('/?tab=multiplayer')}>Choose another arena</Button>}
              className="rounded-2xl border border-border/90 bg-surface/94 p-4 shadow-sm backdrop-blur-xl sm:p-5"
            />
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
          )}
        </Suspense>
        </div>
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
