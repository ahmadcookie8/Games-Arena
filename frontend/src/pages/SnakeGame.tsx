import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import {
  REPLAY_SEED_PATTERN,
  stepSnakeState,
  type Direction,
  type SnakeBoardSize,
  type SnakeState,
} from '@games-arena/game-engine'
import { GameRouteLoading, GameRouteUnavailable } from '../components/GameRouteState'
import GameShell, { GameShellLayout } from '../components/GameShell'
import Modal, { type ModalAction, type ModalVariant } from '../components/Modal'
import MoveHistory from '../components/MoveHistory'
import PlayerCard from '../components/PlayerCard'
import { useGameState } from '../hooks/useGameState'
import api from '../lib/api'
import { getGameMode } from '../lib/gameCatalog'
import {
  buildReplayPayload,
  createReplayRecorder,
  getCompletedReplayStatus,
  getInitialReplayEligibility,
  getReplayRunPresentation,
  invalidateReplayRecorder,
  isExplicitReplayRejection,
  recordReplayTick,
  type ReplayRunStatus,
  type ReplayUnrankedReason,
} from '../lib/singlePlayerReplay'
import type { Game } from '../types/game'

interface ModalState {
  title: string
  message: string
  variant: ModalVariant
  primaryAction?: ModalAction
  secondaryAction?: ModalAction
}

interface ReplayCompletionResponse {
  game: Game
  gameState: SnakeState
  moveHistory: Game['moveHistory']
}

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

const SNAKE_BOARD_SIZES: SnakeBoardSize[] = ['small', 'medium', 'large']
const LEGACY_FALLBACK_SEED = '0'.repeat(64)

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || 'Something went wrong'
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}

function cellsMatch(left: SnakeState['snake'][number], right: SnakeState['snake'][number]): boolean {
  return left.x === right.x && left.y === right.y
}

function getCellKey(cell: SnakeState['snake'][number]): string {
  return `${cell.x}:${cell.y}`
}

function normalizeLegacySnakeState(state: SnakeState): SnakeState {
  if (Number.isSafeInteger(state.tick) && state.tick >= 0 && typeof state.hasStarted === 'boolean') return state
  return {
    ...state,
    hasStarted: Boolean(state.hasStarted),
    tick: 0,
  }
}

export default function SnakeGame() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { game, loading, error, refetch, setGame } = useGameState(gameId)
  const [snakeState, setSnakeState] = useState<SnakeState | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [selectedBoardSize, setSelectedBoardSize] = useState<SnakeBoardSize>('medium')
  const [selectedWallLooping, setSelectedWallLooping] = useState(false)
  const latestStateRef = useRef<SnakeState | null>(null)
  const pendingDirectionRef = useRef<Direction>('right')
  const lastCheckpointAtRef = useRef(0)
  const completedRef = useRef(false)
  const sessionGameIdRef = useRef<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)
  const startCheckpointConfirmedRef = useRef(false)
  const startPromiseRef = useRef<Promise<boolean> | null>(null)
  const replayRecorderRef = useRef(createReplayRecorder('right'))
  const replayEligibleRef = useRef(false)
  const [replayStatus, setReplayStatus] = useState<ReplayRunStatus>('unranked')
  const [unrankedReason, setUnrankedReason] = useState<ReplayUnrankedReason>('legacy')

  useEffect(() => {
    setSnakeState(null)
  }, [gameId])

  const wallLooping = Boolean(game?.metadata?.wallLooping)
  const boardSize = game?.metadata?.boardSize || 'medium'
  const snakeTickMs = snakeState?.tickMs ?? 120
  const engineSeed = game?.replay && REPLAY_SEED_PATTERN.test(game.replay.seed)
    ? game.replay.seed
    : LEGACY_FALLBACK_SEED

  useEffect(() => {
    if (!game || game.gameType !== 'snake' || getGameMode(game) !== 'singlePlayer') return
    const rawState = game.gameState as unknown as SnakeState
    const state = normalizeLegacySnakeState(rawState)
    setSnakeState(state)
    latestStateRef.current = state
    pendingDirectionRef.current = state.pendingDirection
    setSelectedBoardSize(game.metadata?.boardSize || 'medium')
    setSelectedWallLooping(Boolean(game.metadata?.wallLooping))
    setIsPlaying(Boolean(state.hasStarted && game.status === 'active' && !state.isGameOver))

    if (sessionGameIdRef.current !== game._id) {
      sessionGameIdRef.current = game._id
      completedRef.current = game.status === 'completed'
      startCheckpointConfirmedRef.current = Boolean(state.hasStarted)
      startPromiseRef.current = null
      replayRecorderRef.current = createReplayRecorder(state.pendingDirection)
      const eligibility = getInitialReplayEligibility(game.replay, rawState)
      replayEligibleRef.current = eligibility.eligible
      setUnrankedReason(eligibility.reason || 'legacy')
      setReplayStatus(game.status === 'completed'
        ? getCompletedReplayStatus(game.result?.verification)
        : eligibility.eligible ? 'eligible' : 'unranked')
    } else if (game.status === 'completed') {
      replayEligibleRef.current = false
      setReplayStatus(getCompletedReplayStatus(game.result?.verification))
      if (game.result?.verification !== 'replay') setUnrankedReason('verification')
    }
  }, [game])

  useEffect(() => {
    latestStateRef.current = snakeState
  }, [snakeState])

  const saveState = useCallback(async (state: SnakeState, completed = false, syncGame = completed) => {
    if (!game || game.status !== 'active') return
    const res = await api.post(`/api/games/${game._id}/single-player/snake/state`, { gameState: state, completed })
    if (syncGame) {
      setGame(res.data.game)
    }
  }, [game, setGame])

  const markReplayUnranked = useCallback((reason: ReplayUnrankedReason) => {
    replayEligibleRef.current = false
    invalidateReplayRecorder(replayRecorderRef.current, reason)
    setUnrankedReason(reason)
    setReplayStatus('unranked')
  }, [])

  const ensureRunStarted = useCallback(async (state: SnakeState): Promise<boolean> => {
    if (startCheckpointConfirmedRef.current) return true
    if (startPromiseRef.current) return startPromiseRef.current

    const startedState = { ...state, hasStarted: true }
    latestStateRef.current = startedState
    setSnakeState(startedState)
    setIsStarting(true)

    const startPromise = (async () => {
      try {
        await saveState(startedState)
        startCheckpointConfirmedRef.current = true
        setIsPlaying(true)
        return true
      } catch (error: unknown) {
        const latest = latestStateRef.current
        if (latest && latest.tick === startedState.tick) {
          const stoppedState = { ...latest, hasStarted: false }
          latestStateRef.current = stoppedState
          setSnakeState(stoppedState)
        }
        setModal({ title: 'Could not start run', message: getErrorMessage(error), variant: 'danger' })
        return false
      } finally {
        setIsStarting(false)
        startPromiseRef.current = null
      }
    })()

    startPromiseRef.current = startPromise
    return startPromise
  }, [saveState])

  const completeRun = useCallback(async (state: SnakeState) => {
    if (!game || game.status !== 'active') return

    const recorder = replayRecorderRef.current
    const replay = buildReplayPayload(recorder)
    const canVerify = replayEligibleRef.current
      && replay !== null
      && recorder.tickCount === state.tick

    if (canVerify) {
      setReplayStatus('verifying')
      try {
        const response = await api.post<ReplayCompletionResponse>(
          `/api/games/${game._id}/single-player/replay`,
          replay,
        )
        const verified = response.data
        setGame({
          ...verified.game,
          gameState: verified.gameState as unknown as Record<string, unknown>,
          moveHistory: verified.moveHistory,
        })
        replayEligibleRef.current = false
        setReplayStatus('verified')
        return
      } catch (error: unknown) {
        const rejectionStatus = axios.isAxiosError(error) ? error.response?.status : undefined
        const rejectionCode = axios.isAxiosError(error) ? error.response?.data?.code : undefined
        if (!isExplicitReplayRejection(rejectionStatus, rejectionCode)) {
          setReplayStatus('retry')
          setModal({
            title: 'Replay verification is pending',
            message: 'The replay is still available in this tab. Keep this page open and retry verification when the connection is available.',
            variant: 'warning',
          })
          return
        }

        markReplayUnranked('verification')
        try {
          await saveState(state, true, true)
          setModal({
            title: 'Score saved without ranking',
            message: 'The server could not reproduce this replay. Your run remains in history, but it was not added to the leaderboard.',
            variant: 'warning',
          })
          return
        } catch (error: unknown) {
          completedRef.current = false
          setModal({ title: 'Could not save score', message: getErrorMessage(error), variant: 'danger' })
          return
        }
      }
    }

    if (replayEligibleRef.current) markReplayUnranked(recorder.reason || 'interrupted')
    try {
      await saveState(state, true, true)
    } catch (error: unknown) {
      completedRef.current = false
      setModal({ title: 'Could not save score', message: getErrorMessage(error), variant: 'danger' })
    }
  }, [game, markReplayUnranked, saveState, setGame])

  async function updateSettings(boardSize: SnakeBoardSize, wallLooping: boolean) {
    if (!game || game.status !== 'active' || snakeState?.hasStarted) return

    try {
      setSelectedBoardSize(boardSize)
      setSelectedWallLooping(wallLooping)
      const res = await api.patch(`/api/games/${game._id}/single-player/settings`, { boardSize, wallLooping })
      setGame(res.data.game)
    } catch (err: unknown) {
      setModal({
        title: 'Could not update settings',
        message: getErrorMessage(err),
        variant: 'danger',
      })
    }
  }

  async function startGame() {
    if (!snakeState || snakeState.isGameOver || game?.status !== 'active') return
    pendingDirectionRef.current = snakeState.pendingDirection
    await ensureRunStarted(snakeState)
  }

  const setPendingDirection = useCallback((direction: Direction) => {
    const current = latestStateRef.current
    if (game?.status !== 'active' || !current || current.isGameOver) return
    if (OPPOSITE_DIRECTION[current.direction] === direction) return

    pendingDirectionRef.current = direction
    const next = { ...current, pendingDirection: direction, hasStarted: true }
    latestStateRef.current = next
    setSnakeState(next)
    if (startCheckpointConfirmedRef.current) setIsPlaying(true)
    else void ensureRunStarted(next)
  }, [ensureRunStarted, game?.status])

  const handleDirectionPress = useCallback((event: React.PointerEvent<HTMLButtonElement>, direction: Direction) => {
    event.preventDefault()
    setPendingDirection(direction)
    boardRef.current?.focus({ preventScroll: true })
  }, [setPendingDirection])

  const handleDirectionClick = useCallback((event: React.MouseEvent<HTMLButtonElement>, direction: Direction) => {
    if (event.detail !== 0) return
    setPendingDirection(direction)
    boardRef.current?.focus({ preventScroll: true })
  }, [setPendingDirection])

  const preventTouchContextMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
  }, [])

  function handleBoardKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const current = latestStateRef.current
      if (!current || current.isGameOver || game?.status !== 'active') return
      if (!current.hasStarted) void startGame()
      else setIsPlaying((value) => !value)
      return
    }

    const keyToDirection: Partial<Record<string, Direction>> = {
      ArrowUp: 'up',
      w: 'up',
      W: 'up',
      ArrowDown: 'down',
      s: 'down',
      S: 'down',
      ArrowLeft: 'left',
      a: 'left',
      A: 'left',
      ArrowRight: 'right',
      d: 'right',
      D: 'right',
    }
    const direction = keyToDirection[event.key]
    if (!direction) return

    event.preventDefault()
    setPendingDirection(direction)
  }

  useEffect(() => {
    if (!latestStateRef.current || !isPlaying || game?.status !== 'active') return

    const interval = window.setInterval(() => {
      const current = latestStateRef.current
      if (!current) return

      const direction = pendingDirectionRef.current
      if (replayEligibleRef.current) {
        const recorder = replayRecorderRef.current
        if (current.tick !== recorder.tickCount) {
          markReplayUnranked('interrupted')
        } else if (!recordReplayTick(recorder, direction)) {
          markReplayUnranked(recorder.reason || 'limit')
        }
      }

      const next = stepSnakeState(current, { seed: engineSeed, wallLooping, direction })
      pendingDirectionRef.current = next.pendingDirection
      latestStateRef.current = next
      setSnakeState(next)

      const ateFood = next.score > current.score
      const now = Date.now()

      if (next.isGameOver && !completedRef.current) {
        completedRef.current = true
        setIsPlaying(false)
        void completeRun(next)
      } else if (ateFood || now - lastCheckpointAtRef.current > 3000) {
        lastCheckpointAtRef.current = now
        void saveState(next).catch(() => undefined)
      }
    }, snakeTickMs)

    return () => window.clearInterval(interval)
  }, [completeRun, engineSeed, game?.status, isPlaying, markReplayUnranked, saveState, snakeTickMs, wallLooping])

  useEffect(() => {
    function handleBeforeUnload() {
      const state = latestStateRef.current
      if (!game || game.status !== 'active' || !state) return
      if (state.isGameOver && replayEligibleRef.current) return
      const url = `/api/games/${game._id}/single-player/snake/state`
      const payload = JSON.stringify({
        gameState: state,
        completed: state.isGameOver && !replayEligibleRef.current,
      })
      navigator.sendBeacon?.(url, new Blob([payload], { type: 'application/json' }))
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [game])

  async function confirmCloseGame() {
    if (!game || closingRef.current) return

    closingRef.current = true
    setIsClosing(true)
    try {
      const state = latestStateRef.current
      if (state && game.status === 'active') {
        await saveState(state)
      }
      await api.post(`/api/games/${game._id}/close`)
      setModal(null)
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

  async function retryGame() {
    if (isRetrying) return

    try {
      setIsRetrying(true)
      const res = await api.post('/api/games/single-player/create', {
        gameType: 'snake',
        boardSize,
        wallLooping,
      })
      navigate(`/single-player/snake/${res.data.game._id}`, { replace: true })
    } catch (err: unknown) {
      setModal({
        title: 'Could not start retry',
        message: getErrorMessage(err),
        variant: 'danger',
      })
    } finally {
      setIsRetrying(false)
    }
  }

  function promptCloseGame() {
    if (!game || game.status !== 'active') return
    setModal({
      title: 'Close this Snake game?',
      message: 'This will close the active Snake run and remove it from your Single Player active games list.',
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
        onClick: () => setModal(null),
      },
    })
  }

  const snakeCells = useMemo(() => new Set((snakeState?.snake || []).map(getCellKey)), [snakeState])

  if (loading) return <GameRouteLoading label="Loading Snake arena" />
  if (!game) {
    return (
      <GameRouteUnavailable
        title={error === 'Game not found' ? 'Snake run not found' : 'This Snake run is unavailable'}
        description={error}
        onRetry={refetch}
        onBack={() => navigate('/?tab=singlePlayer')}
      />
    )
  }
  if (game.gameType !== 'snake' || getGameMode(game) !== 'singlePlayer') {
    return (
      <GameRouteUnavailable
        title="This is not a Snake run"
        description="Return to Single Player and open the matching arena from your active games."
        onBack={() => navigate('/?tab=singlePlayer')}
      />
    )
  }
  if (!snakeState) return <GameRouteLoading label="Preparing Snake board" />

  const isActive = game.status === 'active'
  const isCompleted = game.status === 'completed'
  const canRetry = snakeState.isGameOver || !isActive
  const canStartNewRun = canRetry && replayStatus !== 'verifying' && replayStatus !== 'retry'
  const settingsLocked = Boolean(snakeState.hasStarted || !isActive)
  const replayPresentation = getReplayRunPresentation(replayStatus, unrankedReason)
  const replayPresentationClass = replayPresentation.tone === 'success'
    ? 'border-success/30 bg-success-subtle text-success-text'
    : replayPresentation.tone === 'warning'
      ? 'border-warning/30 bg-warning-subtle text-warning-text'
      : 'border-accent/30 bg-accent-subtle text-accent'

  const routeStatus = snakeState.isGameOver || isCompleted
    ? `Run complete · Length ${snakeState.score}`
    : !snakeState.hasStarted
      ? 'Ready to start'
      : isPlaying
        ? `Running · Length ${snakeState.score}`
        : `Paused · Length ${snakeState.score}`

  return (
    <>
      <GameShell
        eyebrow={`${boardSize} grid · ${wallLooping ? 'Looping walls' : 'Solid walls'}`}
        title="Snake"
        statusLabel={routeStatus}
        statusTone={snakeState.isGameOver || isCompleted ? 'success' : !isPlaying && snakeState.hasStarted ? 'warning' : 'default'}
        onBack={() => navigate('/?tab=singlePlayer')}
        onClose={isActive ? promptCloseGame : undefined}
        primaryAction={canStartNewRun ? {
          label: isRetrying ? 'Starting…' : 'Retry',
          onClick: () => void retryGame(),
          disabled: isRetrying,
        } : undefined}
        width="standard"
      >
        <GameShellLayout
          inspectorTitle="Snake details"
          inspectorDescription="Review the player and this run's move history."
          playfield={(
          <section className="rounded-2xl border border-border/90 bg-surface/94 p-4 shadow-sm backdrop-blur-xl sm:p-5">
            <div className="mb-5 rounded-xl border border-border bg-page p-3">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Snake Settings</h2>
                  <p className="text-xs text-text-muted">{settingsLocked ? 'Locked after the run starts' : 'Choose before pressing Start'}</p>
                </div>
                <span className="text-xs font-medium text-text-muted">Length {snakeState.score}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="grid grid-cols-3 gap-2">
                  {SNAKE_BOARD_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => void updateSettings(size, selectedWallLooping)}
                      disabled={settingsLocked}
                      className={`min-h-10 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-70 ${
                        selectedBoardSize === size ? 'ui-action-primary shadow-accent' : 'border border-border-control bg-elevated text-text-secondary hover:bg-overlay hover:text-text-primary'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg bg-elevated px-3 py-2 text-sm font-medium text-text-secondary">
                  <input
                    type="checkbox"
                    checked={selectedWallLooping}
                    disabled={settingsLocked}
                    onChange={(event) => void updateSettings(selectedBoardSize, event.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)] disabled:cursor-not-allowed"
                  />
                  Loop through walls
                </label>
              </div>
            </div>
            <div className={`mb-4 rounded-xl border px-4 py-3 ${replayPresentationClass}`} aria-live="polite">
              <p className="text-sm font-semibold">{replayPresentation.label}</p>
              <p className="mt-1 text-xs opacity-90">{replayPresentation.detail}</p>
            </div>
            {snakeState.isGameOver && (
              <div className="mb-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-center text-sm font-medium text-success-text sm:flex-row">
                <span>Game over: final length {snakeState.score}</span>
                {replayStatus === 'retry' && (
                  <button
                    type="button"
                    onClick={() => void completeRun(snakeState)}
                    className="min-h-10 cursor-pointer rounded-lg border border-warning/40 bg-warning-subtle px-4 py-2 text-sm font-medium text-warning-text"
                  >
                    Retry verification
                  </button>
                )}
                {canStartNewRun && <button
                  type="button"
                  onClick={() => void retryGame()}
                  disabled={isRetrying}
                  className="ui-action-primary interactive-lift min-h-11 cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold shadow-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRetrying ? 'Starting...' : 'Retry'}
                </button>}
              </div>
            )}
            <div className="mx-auto w-full max-w-[min(86vw,70vh,38rem)]">
              <div
                ref={boardRef}
                className="grid aspect-square gap-px rounded-xl border border-border bg-border p-1 shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-border-focus focus-visible:ring-offset-4 focus-visible:ring-offset-page"
                style={{ gridTemplateColumns: `repeat(${snakeState.width}, minmax(0, 1fr))` }}
                tabIndex={0}
                role="button"
                aria-pressed={isPlaying}
                aria-disabled={!isActive || snakeState.isGameOver || undefined}
                onKeyDown={handleBoardKeyDown}
                aria-label={`Snake board. Head at row ${snakeState.snake[0].y + 1}, column ${snakeState.snake[0].x + 1}. Food at row ${snakeState.food.y + 1}, column ${snakeState.food.x + 1}. Use WASD or arrow keys to steer.`}
                aria-describedby="snake-board-legend"
              >
                {Array.from({ length: snakeState.width * snakeState.height }).map((_, index) => {
                  const x = index % snakeState.width
                  const y = Math.floor(index / snakeState.width)
                  const key = `${x}:${y}`
                  const isHead = cellsMatch(snakeState.snake[0], { x, y })
                  const isSnake = snakeCells.has(key)
                  const isFood = cellsMatch(snakeState.food, { x, y })
                  return (
                    <div
                      key={key}
                      aria-hidden="true"
                      className={`aspect-square ${
                        isHead
                          ? 'rounded-[3px] bg-accent ring-2 ring-inset ring-white/70'
                          : isSnake
                            ? 'rounded-[3px] bg-success'
                            : isFood
                              ? 'scale-[0.72] rounded-full bg-danger shadow-[0_0_0_2px_var(--bg-page)]'
                              : 'rounded-[3px] bg-page'
                      }`}
                    />
                  )
                })}
              </div>
              <div id="snake-board-legend" className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-accent ring-1 ring-current" aria-hidden="true" /> Head</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-success" aria-hidden="true" /> Body</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-danger" aria-hidden="true" /> Food</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!snakeState.hasStarted) {
                      void startGame()
                      window.requestAnimationFrame(() => boardRef.current?.focus({ preventScroll: true }))
                      return
                    }
                    setIsPlaying((value) => !value)
                    window.requestAnimationFrame(() => boardRef.current?.focus({ preventScroll: true }))
                  }}
                  disabled={!isActive || snakeState.isGameOver || isStarting}
                  className="ui-action-primary interactive-lift min-h-11 cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold shadow-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStarting ? 'Starting...' : !snakeState.hasStarted ? 'Start' : isPlaying ? 'Pause' : 'Play'}
                </button>
                <span className="rounded-lg bg-overlay px-3 py-2 text-sm text-text-secondary">Use WASD or arrow keys</span>
              </div>
              <div className="mx-auto mt-4 grid w-44 select-none grid-cols-3 gap-2 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent] sm:hidden" aria-label="Touch controls">
                <span />
                <button
                  type="button"
                  onPointerDown={(event) => handleDirectionPress(event, 'up')}
                  onClick={(event) => handleDirectionClick(event, 'up')}
                  onContextMenu={preventTouchContextMenu}
                  className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
                >
                  Up
                </button>
                <span />
                <button
                  type="button"
                  onPointerDown={(event) => handleDirectionPress(event, 'left')}
                  onClick={(event) => handleDirectionClick(event, 'left')}
                  onContextMenu={preventTouchContextMenu}
                  className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
                >
                  Left
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!snakeState.hasStarted) {
                      void startGame()
                      window.requestAnimationFrame(() => boardRef.current?.focus({ preventScroll: true }))
                      return
                    }
                    setIsPlaying((value) => !value)
                    window.requestAnimationFrame(() => boardRef.current?.focus({ preventScroll: true }))
                  }}
                  disabled={!isActive || snakeState.isGameOver || isStarting}
                  className="ui-action-primary min-h-12 rounded-xl text-xs font-bold shadow-accent disabled:opacity-60"
                >
                  {isStarting ? 'Starting' : !snakeState.hasStarted ? 'Start' : isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => handleDirectionPress(event, 'right')}
                  onClick={(event) => handleDirectionClick(event, 'right')}
                  onContextMenu={preventTouchContextMenu}
                  className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
                >
                  Right
                </button>
                <span />
                <button
                  type="button"
                  onPointerDown={(event) => handleDirectionPress(event, 'down')}
                  onClick={(event) => handleDirectionClick(event, 'down')}
                  onContextMenu={preventTouchContextMenu}
                  className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
                >
                  Down
                </button>
                <span />
              </div>
            </div>
          </section>
          )}
          desktopInspector={(
          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-border/90 bg-surface/94 p-4 shadow-sm backdrop-blur-xl">
              <h3 className="mb-3 text-base font-semibold text-text-primary">Player</h3>
              <div className="space-y-2">
                {game.players.map((p) => (
                  <PlayerCard key={p.userId} player={p} isCurrentTurn={isActive && isPlaying} />
                ))}
              </div>
            </div>
            <MoveHistory moves={game.moveHistory} />
          </div>
          )}
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
        onClose={() => { if (!isClosing) setModal(null) }}
      >
        {modal?.message}
      </Modal>
    </>
  )
}
