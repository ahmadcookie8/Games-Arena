import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'
import Modal, { ModalVariant } from '../components/Modal'
import MoveHistory from '../components/MoveHistory'
import PageBackdrop from '../components/PageBackdrop'
import PlayerCard from '../components/PlayerCard'
import { useGameState } from '../hooks/useGameState'
import api from '../lib/api'
import { SnakeBoardSize } from '../types/game'

type Direction = 'up' | 'down' | 'left' | 'right'

interface SnakeCell {
  x: number
  y: number
}

interface SnakeState {
  width: number
  height: number
  snake: SnakeCell[]
  direction: Direction
  pendingDirection: Direction
  food: SnakeCell
  score: number
  isGameOver: boolean
  hasStarted?: boolean
  tickMs: number
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

const DIRECTION_DELTA: Record<Direction, SnakeCell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

const SNAKE_BOARD_SIZES: SnakeBoardSize[] = ['small', 'medium', 'large']

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || 'Something went wrong'
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}

function cellsMatch(left: SnakeCell, right: SnakeCell): boolean {
  return left.x === right.x && left.y === right.y
}

function getCellKey(cell: SnakeCell): string {
  return `${cell.x}:${cell.y}`
}

function findFood(width: number, height: number, snake: SnakeCell[]): SnakeCell {
  const occupied = new Set(snake.map(getCellKey))
  const openCells: SnakeCell[] = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = { x, y }
      if (!occupied.has(getCellKey(cell))) {
        openCells.push(cell)
      }
    }
  }

  return openCells[Math.floor(Math.random() * openCells.length)] || snake[0]
}

function nextSnakeState(state: SnakeState, wallLooping: boolean): SnakeState {
  if (state.isGameOver) return state

  const direction = state.pendingDirection
  const delta = DIRECTION_DELTA[direction]
  const head = state.snake[0]
  let nextHead = { x: head.x + delta.x, y: head.y + delta.y }

  if (wallLooping) {
    nextHead = {
      x: (nextHead.x + state.width) % state.width,
      y: (nextHead.y + state.height) % state.height,
    }
  } else if (nextHead.x < 0 || nextHead.x >= state.width || nextHead.y < 0 || nextHead.y >= state.height) {
    return { ...state, direction, pendingDirection: direction, isGameOver: true }
  }

  const ateFood = cellsMatch(nextHead, state.food)
  const nextSnake = ateFood ? [nextHead, ...state.snake] : [nextHead, ...state.snake.slice(0, -1)]

  if (nextSnake.slice(1).some((cell) => cellsMatch(cell, nextHead))) {
    return { ...state, direction, pendingDirection: direction, isGameOver: true }
  }

  return {
    ...state,
    hasStarted: true,
    snake: nextSnake,
    direction,
    pendingDirection: direction,
    food: ateFood ? findFood(state.width, state.height, nextSnake) : state.food,
    score: nextSnake.length,
  }
}

export default function SnakeGame() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { game, loading, setGame } = useGameState(gameId)
  const [snakeState, setSnakeState] = useState<SnakeState | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [selectedBoardSize, setSelectedBoardSize] = useState<SnakeBoardSize>('medium')
  const [selectedWallLooping, setSelectedWallLooping] = useState(false)
  const latestStateRef = useRef<SnakeState | null>(null)
  const pendingDirectionRef = useRef<Direction>('right')
  const lastCheckpointAtRef = useRef(0)
  const completedRef = useRef(false)

  const wallLooping = Boolean(game?.metadata?.wallLooping)
  const boardSize = game?.metadata?.boardSize || 'medium'
  const snakeTickMs = snakeState?.tickMs ?? 120

  useEffect(() => {
    if (!game) return
    const state = game.gameState as unknown as SnakeState
    setSnakeState(state)
    latestStateRef.current = state
    pendingDirectionRef.current = state.pendingDirection
    setSelectedBoardSize(game.metadata?.boardSize || 'medium')
    setSelectedWallLooping(Boolean(game.metadata?.wallLooping))
    setIsPlaying(Boolean(state.hasStarted && game.status === 'active' && !state.isGameOver))
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

  function startGame() {
    if (!snakeState || snakeState.isGameOver || game?.status !== 'active') return
    const next = { ...snakeState, hasStarted: true }
    setSnakeState(next)
    latestStateRef.current = next
    pendingDirectionRef.current = next.pendingDirection
    setIsPlaying(true)
    void saveState(next).catch(() => undefined)
  }

  const setPendingDirection = useCallback((direction: Direction) => {
    const current = latestStateRef.current
    if (game?.status !== 'active' || !current || current.isGameOver) return
    if (OPPOSITE_DIRECTION[current.direction] === direction || OPPOSITE_DIRECTION[pendingDirectionRef.current] === direction) return

    pendingDirectionRef.current = direction
    setSnakeState((current) => {
      if (!current || current.isGameOver) return current
      const next = { ...current, pendingDirection: direction, hasStarted: true }
      latestStateRef.current = next
      return next
    })
    setIsPlaying(true)
  }, [game?.status])

  const handleDirectionPress = useCallback((event: React.PointerEvent<HTMLButtonElement>, direction: Direction) => {
    event.preventDefault()
    setPendingDirection(direction)
  }, [setPendingDirection])

  const preventTouchContextMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
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

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setPendingDirection])

  useEffect(() => {
    if (!latestStateRef.current || !isPlaying || game?.status !== 'active') return

    const interval = window.setInterval(() => {
      const current = latestStateRef.current
      if (!current) return

      const queuedState = { ...current, pendingDirection: pendingDirectionRef.current }
      const next = nextSnakeState(queuedState, wallLooping)
      pendingDirectionRef.current = next.pendingDirection
      latestStateRef.current = next
      setSnakeState(next)

      const ateFood = next.score > current.score
      const now = Date.now()

      if (next.isGameOver && !completedRef.current) {
        completedRef.current = true
        setIsPlaying(false)
        void saveState(next, true, true).catch((err: unknown) => {
          setModal({ title: 'Could not save score', message: getErrorMessage(err), variant: 'danger' })
        })
      } else if (ateFood || now - lastCheckpointAtRef.current > 3000) {
        lastCheckpointAtRef.current = now
        void saveState(next).catch(() => undefined)
      }
    }, snakeTickMs)

    return () => window.clearInterval(interval)
  }, [game?.status, isPlaying, saveState, snakeTickMs, wallLooping])

  useEffect(() => {
    function handleBeforeUnload() {
      const state = latestStateRef.current
      if (!game || game.status !== 'active' || !state) return
      const url = `/api/games/${game._id}/single-player/snake/state`
      const payload = JSON.stringify({ gameState: state, completed: state.isGameOver })
      navigator.sendBeacon?.(url, new Blob([payload], { type: 'application/json' }))
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [game])

  async function confirmCloseGame() {
    if (!game) return

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

  if (loading || !snakeState) return <div className="flex min-h-screen items-center justify-center bg-page text-text-primary">Loading game...</div>
  if (!game) return <div className="flex min-h-screen items-center justify-center bg-page text-text-primary">Game not found</div>

  const isActive = game.status === 'active'
  const isCompleted = game.status === 'completed'
  const canRetry = snakeState.isGameOver || !isActive
  const settingsLocked = Boolean(snakeState.hasStarted || !isActive)

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
            <h1 className="text-gradient truncate text-xl font-semibold">Snake</h1>
            <p className="text-sm capitalize text-text-muted">{boardSize} grid - {wallLooping ? 'Looping walls' : 'Solid walls'}</p>
          </div>
          <div className="flex items-center gap-3">
            {canRetry && (
              <button
                type="button"
                onClick={() => void retryGame()}
                disabled={isRetrying}
                className="cursor-pointer rounded-lg bg-accent px-3 py-2 text-sm font-medium text-text-on-accent shadow-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRetrying ? 'Starting...' : 'Retry'}
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
            <div className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${isCompleted || snakeState.isGameOver ? 'bg-success-subtle text-success-text' : 'bg-accent-subtle text-accent'}`}>
              Length {snakeState.score}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
                        selectedBoardSize === size ? 'bg-accent text-text-on-accent shadow-accent' : 'bg-elevated text-text-secondary hover:bg-overlay hover:text-text-primary'
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
            {snakeState.isGameOver && (
              <div className="mb-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-center text-sm font-medium text-success-text sm:flex-row">
                <span>Game over: final length {snakeState.score}</span>
                <button
                  type="button"
                  onClick={() => void retryGame()}
                  disabled={isRetrying}
                  className="min-h-10 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent shadow-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRetrying ? 'Starting...' : 'Retry'}
                </button>
              </div>
            )}
            <div className="mx-auto w-full max-w-[min(86vw,70vh,38rem)]">
              <div
                className="grid aspect-square gap-px rounded-xl border border-border bg-border p-1 shadow-sm outline-none"
                style={{ gridTemplateColumns: `repeat(${snakeState.width}, minmax(0, 1fr))` }}
                tabIndex={0}
                aria-label="Snake board"
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
                      className={`aspect-square rounded-[3px] ${
                        isHead
                          ? 'bg-accent'
                          : isSnake
                            ? 'bg-success'
                            : isFood
                              ? 'bg-danger'
                              : 'bg-page'
                      }`}
                    />
                  )
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!snakeState.hasStarted) {
                      startGame()
                      return
                    }
                    setIsPlaying((value) => !value)
                  }}
                  disabled={!isActive || snakeState.isGameOver}
                  className="min-h-10 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent shadow-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {!snakeState.hasStarted ? 'Start' : isPlaying ? 'Pause' : 'Play'}
                </button>
                <span className="rounded-lg bg-overlay px-3 py-2 text-sm text-text-secondary">Use WASD or arrow keys</span>
              </div>
              <div className="mx-auto mt-4 grid w-44 select-none grid-cols-3 gap-2 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent] sm:hidden" aria-label="Touch controls">
                <span />
                <button
                  type="button"
                  onPointerDown={(event) => handleDirectionPress(event, 'up')}
                  onContextMenu={preventTouchContextMenu}
                  className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
                >
                  Up
                </button>
                <span />
                <button
                  type="button"
                  onPointerDown={(event) => handleDirectionPress(event, 'left')}
                  onContextMenu={preventTouchContextMenu}
                  className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
                >
                  Left
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!snakeState.hasStarted) {
                      startGame()
                      return
                    }
                    setIsPlaying((value) => !value)
                  }}
                  disabled={!isActive || snakeState.isGameOver}
                  className="min-h-12 rounded-lg bg-accent text-xs font-bold text-text-on-accent disabled:opacity-60"
                >
                  {!snakeState.hasStarted ? 'Start' : isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => handleDirectionPress(event, 'right')}
                  onContextMenu={preventTouchContextMenu}
                  className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
                >
                  Right
                </button>
                <span />
                <button
                  type="button"
                  onPointerDown={(event) => handleDirectionPress(event, 'down')}
                  onContextMenu={preventTouchContextMenu}
                  className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
                >
                  Down
                </button>
                <span />
              </div>
            </div>
          </section>

          <aside className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-border/90 bg-surface/94 p-4 shadow-sm backdrop-blur-xl">
              <h3 className="mb-3 text-base font-semibold text-text-primary">Player</h3>
              <div className="space-y-2">
                {game.players.map((p) => (
                  <PlayerCard key={p.userId} player={p} isCurrentTurn={isActive && isPlaying} />
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
        onClose={() => setModal(null)}
      >
        {modal?.message}
      </Modal>
    </div>
  )
}
