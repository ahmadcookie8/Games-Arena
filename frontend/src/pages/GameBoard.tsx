import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import BrandMascot from '../components/BrandMascot'
import { GameRouteLoading, GameRouteUnavailable } from '../components/GameRouteState'
import GameShell from '../components/GameShell'
import GameInvite from '../components/GameInvite'
import Modal, { type ModalAction, type ModalVariant } from '../components/Modal'
import MoveHistory from '../components/MoveHistory'
import PlayerCard from '../components/PlayerCard'
import { Button, RouteState } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useGameState } from '../hooks/useGameState'
import { useSocket, type SocketAcknowledgementError } from '../hooks/useSocket'
import api from '../lib/api'
import { canHostCloseGame, getCloseGamePrompt } from '../lib/gameClose'
import { getGameLabel } from '../lib/gameRules'
import { getGameMode } from '../lib/gameCatalog'
import { parseGameStateEnvelope } from '../lib/gameStateEvents'
import { ChatMessage, Game } from '../types/game'

const PropertyManagementBoard = lazy(() => import('../components/PropertyManagementBoard'))
const ScrabbleBoard = lazy(() => import('../components/ScrabbleBoard'))
const TicTacToeExperience = lazy(() => import('../components/TicTacToeExperience'))
const WisecrackerBoard = lazy(() => import('../components/WisecrackerBoard'))

interface MoveResponse {
  success: boolean
  game?: Game
  errorCode?: string
  error?: string
  handledGlobally?: boolean
}

interface ChatResponse {
  success: boolean
  message?: ChatMessage
  error?: string
  handledGlobally?: boolean
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

function isFatalGameError(code: string): boolean {
  return ['FORBIDDEN', 'GAME_NOT_FOUND', 'GAME_TYPE_UNAVAILABLE', 'INVALID_ACK', 'UNAUTHORIZED'].includes(code)
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<ChatMessage>
  return typeof message.messageId === 'string'
    && typeof message.userId === 'string'
    && typeof message.username === 'string'
    && typeof message.text === 'string'
    && typeof message.timestamp === 'string'
}

export default function GameBoard() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { game, loading, error, refetch, applySnapshot, appendChatMessage, updatePlayerPresence } = useGameState(gameId)
  const { emitWithAck, on, connected, connectionError } = useSocket()
  const [modal, setModal] = useState<ModalState | null>(null)
  const [actionError, setActionError] = useState<SocketAcknowledgementError | null>(null)
  const [roomJoined, setRoomJoined] = useState(false)
  const [isReplaying, setIsReplaying] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const interactionRootRef = useRef<HTMLDivElement | null>(null)
  const closingRef = useRef(false)
  const replayingRef = useRef(false)
  const moveInFlightRef = useRef(false)
  const chatInFlightRef = useRef(false)
  const roomJoinedRef = useRef(false)
  const roomReady = connected && roomJoined

  useEffect(() => {
    moveInFlightRef.current = false
    chatInFlightRef.current = false
    roomJoinedRef.current = false
    setRoomJoined(false)
    setActionError(null)
  }, [gameId])

  useEffect(() => {
    interactionRootRef.current?.toggleAttribute('inert', !roomReady)
  }, [roomReady, game])

  const showFatalGameError = useCallback((error: SocketAcknowledgementError) => {
    const titleByCode: Record<string, string> = {
      FORBIDDEN: 'Game access denied',
      GAME_NOT_FOUND: 'Game unavailable',
      GAME_TYPE_UNAVAILABLE: 'Game unavailable',
      INVALID_ACK: 'Invalid server response',
      SOCKET_CONNECTION_LIMIT: 'Connection limit reached',
      SOCKET_ORIGIN_REJECTED: 'Live connection blocked',
      SOCKET_SESSION_ENDED: 'Live session ended',
      UNAUTHORIZED: 'Session expired',
    }
    setModal({
      title: titleByCode[error.code] ?? 'Game unavailable',
      message: error.message,
      variant: 'danger',
    })
  }, [])

  useEffect(() => {
    if (!connectionError || !['SOCKET_CONNECTION_LIMIT', 'SOCKET_ORIGIN_REJECTED', 'SOCKET_SESSION_ENDED', 'UNAUTHORIZED'].includes(connectionError.code)) return
    showFatalGameError(connectionError)
  }, [connectionError, showFatalGameError])

  useEffect(() => {
    roomJoinedRef.current = false
    setRoomJoined(false)
    if (!gameId || !connected) return
    let cancelled = false

    void emitWithAck<unknown>('joinRoom', { gameId }).then((acknowledgement) => {
      if (cancelled) return
      if (acknowledgement.ok) {
        const parsed = parseGameStateEnvelope(acknowledgement.data)
        if (!parsed || parsed.gameId !== gameId) {
          showFatalGameError({ code: 'INVALID_ACK', message: 'The server returned a game for a different room. Refresh and try again.' })
          return
        }
        applySnapshot(acknowledgement.data, true)
        roomJoinedRef.current = true
        setRoomJoined(true)
      } else {
        showFatalGameError(acknowledgement.error)
      }
    })

    const applyLiveSnapshot = (data: unknown) => {
      if (applySnapshot(data, false, true)) setActionError(null)
    }
    const offGameUpdated = on('gameUpdated', applyLiveSnapshot)
    // One-release compatibility for servers that still use these as full-state events.
    const offMoveMade = on('moveMade', applyLiveSnapshot)
    const offGameOver = on('gameOver', applyLiveSnapshot)

    const offChatMessage = on('chatMessage', (data: unknown) => {
      if (!data || typeof data !== 'object') return
      const { gameId: messageGameId, message } = data as { gameId?: unknown; message?: unknown }
      if (messageGameId !== gameId || !isChatMessage(message)) return
      appendChatMessage(gameId, message)
    })

    const offPlayerPresence = on('playerPresenceChanged', (data: unknown) => {
      if (!data || typeof data !== 'object') return
      const { gameId: presenceGameId, userId, isConnected } = data as Record<string, unknown>
      if (presenceGameId !== gameId || typeof userId !== 'string' || typeof isConnected !== 'boolean') return
      updatePlayerPresence(gameId, userId, isConnected)
    })

    const offReplayCreated = on('gameReplayCreated', (data: unknown) => {
      const { oldGameId, gameId: replayGameId } = data as { oldGameId?: string; gameId?: string }
      if (oldGameId !== gameId || !replayGameId) return
      navigate(`/game/${replayGameId}`, { replace: true })
    })

    return () => {
      cancelled = true
      roomJoinedRef.current = false
      offGameUpdated()
      offMoveMade()
      offGameOver()
      offChatMessage()
      offPlayerPresence()
      offReplayCreated()
    }
  }, [gameId, connected, emitWithAck, on, navigate, applySnapshot, appendChatMessage, updatePlayerPresence, showFatalGameError])

  async function handleMove(move: unknown): Promise<MoveResponse> {
    if (!connected || !gameId || !roomJoinedRef.current) {
      const reconnectError = connectionError ?? (connected
        ? { code: 'JOINING_ROOM', message: 'Waiting for the server to authorize this game room.' }
        : { code: 'SOCKET_DISCONNECTED', message: 'Reconnecting to the game server.' })
      setActionError(reconnectError)
      return { success: false, errorCode: reconnectError.code, error: reconnectError.message }
    }
    if (moveInFlightRef.current) {
      return { success: false, errorCode: 'ACTION_IN_FLIGHT', error: '' }
    }

    moveInFlightRef.current = true
    setActionError(null)
    try {
      const acknowledgement = await emitWithAck<unknown>('makeMove', { gameId, move })
      if (acknowledgement.ok) {
        const snapshot = parseGameStateEnvelope(acknowledgement.data)
        if (!snapshot || snapshot.gameId !== gameId) {
          const invalidAck = { code: 'INVALID_ACK', message: 'The server returned an invalid game response. Refresh and try again.' }
          showFatalGameError(invalidAck)
          return { success: false, errorCode: invalidAck.code, error: invalidAck.message }
        }
        applySnapshot(acknowledgement.data, true, true)
        return { success: true, game: snapshot.game }
      }

      if (acknowledgement.error.code === 'GAME_STATE_CONFLICT' || acknowledgement.error.code === 'ACK_TIMEOUT') refetch()
      const handledGlobally = isFatalGameError(acknowledgement.error.code)
      if (handledGlobally) showFatalGameError(acknowledgement.error)
      else setActionError(acknowledgement.error)
      return {
        success: false,
        errorCode: acknowledgement.error.code,
        error: acknowledgement.error.message,
        handledGlobally,
      }
    } finally {
      moveInFlightRef.current = false
    }
  }

  async function handleSendChat(text: string): Promise<ChatResponse> {
    if (!connected || !gameId || !roomJoinedRef.current) {
      return { success: false, error: connectionError?.message ?? 'Chat will be available after the room is authorized.' }
    }
    if (chatInFlightRef.current) return { success: false, error: 'Your previous message is still being sent.' }
    chatInFlightRef.current = true
    try {
      const acknowledgement = await emitWithAck<{ message: ChatMessage }>('sendChatMessage', { gameId, text })
      if (acknowledgement.ok) return { success: true, message: acknowledgement.data.message }
      const handledGlobally = isFatalGameError(acknowledgement.error.code)
      if (handledGlobally) showFatalGameError(acknowledgement.error)
      return { success: false, error: acknowledgement.error.message, handledGlobally }
    } finally {
      chatInFlightRef.current = false
    }
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
    if (!game || replayingRef.current) return

    try {
      replayingRef.current = true
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
      replayingRef.current = false
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
  const isMyTurn = roomReady && isActive && !isWaitingForPlayer && !isCompleted && game.currentTurnIndex === myIndex
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
    ? connectionError?.code === 'SOCKET_CONNECTION_LIMIT' ? 'Connection limit reached' : 'Reconnecting...'
    : !roomJoined
      ? 'Joining game...'
    : game.gameType === 'propertyManagement' && gamePhase === 'lobby'
      ? 'Waiting room'
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
        statusTone={!roomReady || isWaitingForPlayer ? 'warning' : isCompleted ? 'success' : 'default'}
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
          aria-disabled={!roomReady || undefined}
          className={`transition-opacity duration-180 ${roomReady ? '' : 'opacity-70'}`}
        >
        {connectionError && (
          <div className="mb-4 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm font-medium text-warning-text" role="alert">
            {connectionError.message}
          </div>
        )}
        {actionError && game.gameType === 'ticTacToe' && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger-text" role="alert">
            {actionError.message}
          </div>
        )}
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
              connected={roomReady}
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
