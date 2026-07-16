import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import {
  REPLAY_SEED_PATTERN,
  stepMazeChaseState,
  type Direction,
  type MazeChaseDirection,
  type MazeChaseState,
  type Point as MazePoint,
} from '@games-arena/game-engine'
import Header from '../components/Header'
import Modal, { ModalVariant } from '../components/Modal'
import MoveHistory from '../components/MoveHistory'
import PageBackdrop from '../components/PageBackdrop'
import PlayerCard from '../components/PlayerCard'
import { useGameState } from '../hooks/useGameState'
import api from '../lib/api'
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
import fruitSprite from '../assets/maze-chase/fruit.png'
import ghostCyanSprite from '../assets/maze-chase/ghost-cyan.png'
import ghostFrightenedSprite from '../assets/maze-chase/ghost-frightened.png'
import ghostGreenSprite from '../assets/maze-chase/ghost-green.png'
import ghostOrangeSprite from '../assets/maze-chase/ghost-orange.png'
import ghostPinkSprite from '../assets/maze-chase/ghost-pink.png'
import pelletSprite from '../assets/maze-chase/pellet.png'
import playerClosedSprite from '../assets/maze-chase/player-closed.png'
import playerRightSprite from '../assets/maze-chase/player-right.png'
import powerPelletSprite from '../assets/maze-chase/power-pellet.png'
import wallBlockSprite from '../assets/maze-chase/walls/block.png'
import wallCornerNeSprite from '../assets/maze-chase/walls/corner-ne.png'
import wallCornerNwSprite from '../assets/maze-chase/walls/corner-nw.png'
import wallCornerSeSprite from '../assets/maze-chase/walls/corner-se.png'
import wallCornerSwSprite from '../assets/maze-chase/walls/corner-sw.png'
import wallCrossSprite from '../assets/maze-chase/walls/cross.png'
import wallEndDownSprite from '../assets/maze-chase/walls/end-down.png'
import wallEndLeftSprite from '../assets/maze-chase/walls/end-left.png'
import wallEndRightSprite from '../assets/maze-chase/walls/end-right.png'
import wallEndUpSprite from '../assets/maze-chase/walls/end-up.png'
import wallHorizontalSprite from '../assets/maze-chase/walls/horizontal.png'
import wallTeeDownSprite from '../assets/maze-chase/walls/tee-down.png'
import wallTeeLeftSprite from '../assets/maze-chase/walls/tee-left.png'
import wallTeeRightSprite from '../assets/maze-chase/walls/tee-right.png'
import wallTeeUpSprite from '../assets/maze-chase/walls/tee-up.png'
import wallVerticalSprite from '../assets/maze-chase/walls/vertical.png'

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

interface ReplayCompletionResponse {
  game: Game
  gameState: MazeChaseState
  moveHistory: Game['moveHistory']
}

const DIRECTION_DELTA: Record<Direction, MazePoint> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const LEGACY_FALLBACK_SEED = '0'.repeat(64)
const GHOST_SPRITES: Record<string, string> = {
  spark: ghostCyanSprite,
  rose: ghostPinkSprite,
  lime: ghostGreenSprite,
  ember: ghostOrangeSprite,
}

const WALL_TILES = {
  block: wallBlockSprite,
  'corner-ne': wallCornerNeSprite,
  'corner-nw': wallCornerNwSprite,
  'corner-se': wallCornerSeSprite,
  'corner-sw': wallCornerSwSprite,
  cross: wallCrossSprite,
  'end-down': wallEndDownSprite,
  'end-left': wallEndLeftSprite,
  'end-right': wallEndRightSprite,
  'end-up': wallEndUpSprite,
  horizontal: wallHorizontalSprite,
  'tee-down': wallTeeDownSprite,
  'tee-left': wallTeeLeftSprite,
  'tee-right': wallTeeRightSprite,
  'tee-up': wallTeeUpSprite,
  vertical: wallVerticalSprite,
} as const

type WallTileKey = keyof typeof WALL_TILES

interface WallConnections {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || 'Something went wrong'
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}

function cellsMatch(left: MazePoint, right: MazePoint): boolean {
  return left.x === right.x && left.y === right.y
}

function getCellKey(cell: MazePoint): string {
  return `${cell.x}:${cell.y}`
}

function isDirection(direction: MazeChaseDirection): direction is Direction {
  return direction !== 'none'
}

function getRawNextPoint(point: MazePoint, direction: MazeChaseDirection): MazePoint {
  if (!isDirection(direction)) return point
  const delta = DIRECTION_DELTA[direction]
  return { x: point.x + delta.x, y: point.y + delta.y }
}

export function getNextPoint(state: MazeChaseState, point: MazePoint, direction: MazeChaseDirection): MazePoint {
  const next = getRawNextPoint(point, direction)
  if (direction === 'left' && next.x < 0) return { ...next, x: state.width - 1 }
  if (direction === 'right' && next.x >= state.width) return { ...next, x: 0 }
  return next
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(query.matches)
    const handleChange = () => setPrefersReducedMotion(query.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

function getActorStyle(state: MazeChaseState, position: MazePoint, durationMs: number, disableTransition = false): React.CSSProperties {
  return {
    left: `${(position.x / state.width) * 100}%`,
    top: `${(position.y / state.height) * 100}%`,
    width: `${100 / state.width}%`,
    height: `${100 / state.height}%`,
    transition: durationMs > 0 && !disableTransition ? `left ${durationMs}ms linear, top ${durationMs}ms linear` : 'none',
  }
}

export function getPlayerSprite(direction: MazeChaseDirection, mouthClosed = false): { src: string; transform?: string } {
  const src = mouthClosed ? playerClosedSprite : playerRightSprite
  switch (direction) {
    case 'left': return { src, transform: 'scaleX(-1)' }
    case 'up': return { src, transform: 'rotate(-90deg)' }
    case 'down': return { src, transform: 'rotate(90deg)' }
    default: return { src }
  }
}

function isWall(state: MazeChaseState, point: MazePoint): boolean {
  return point.x < 0 || point.x >= state.width || point.y < 0 || point.y >= state.height || state.maze[point.y]?.[point.x] === '#'
}

export function canMove(state: MazeChaseState, point: MazePoint, direction: MazeChaseDirection): boolean {
  return isDirection(direction) && !isWall(state, getNextPoint(state, point, direction))
}

export function isWrapMove(state: MazeChaseState, from: MazePoint, to: MazePoint): boolean {
  return from.y === to.y && Math.abs(from.x - to.x) > 1 && Math.abs(from.x - to.x) === state.width - 1
}

export function getWallConnections(maze: string[], x: number, y: number): WallConnections {
  const isWallCell = (cellX: number, cellY: number) => maze[cellY]?.[cellX] === '#'
  return {
    up: isWallCell(x, y - 1),
    down: isWallCell(x, y + 1),
    left: isWallCell(x - 1, y),
    right: isWallCell(x + 1, y),
  }
}

export function getWallTileKey(maze: string[], x: number, y: number): WallTileKey {
  const connections = getWallConnections(maze, x, y)
  const count = Object.values(connections).filter(Boolean).length
  if (count === 4) return 'cross'
  if (count === 3) {
    if (!connections.up) return 'tee-down'
    if (!connections.down) return 'tee-up'
    if (!connections.left) return 'tee-right'
    return 'tee-left'
  }
  if (count === 2) {
    if (connections.left && connections.right) return 'horizontal'
    if (connections.up && connections.down) return 'vertical'
    if (connections.up && connections.right) return 'corner-ne'
    if (connections.up && connections.left) return 'corner-nw'
    if (connections.down && connections.right) return 'corner-se'
    return 'corner-sw'
  }
  if (count === 1) {
    if (connections.up) return 'end-up'
    if (connections.down) return 'end-down'
    if (connections.left) return 'end-left'
    return 'end-right'
  }
  return 'block'
}

export function getGhostTickMs(tickMs: number): number {
  return Math.round(tickMs * 1.2)
}

/** Adapts pre-replay wall-clock checkpoints for continued, explicitly unranked play. */
export function normalizeLegacyMazeState(state: MazeChaseState, now = Date.now()): MazeChaseState {
  if (Number.isSafeInteger(state.tick) && state.tick >= 0 && Number.isSafeInteger(state.elapsedMs) && state.elapsedMs >= 0) {
    return state
  }

  const relativeDeadline = (deadline: number | undefined): number | undefined => {
    if (!Number.isFinite(deadline)) return undefined
    return Math.max(0, (deadline || 0) - now)
  }

  return {
    ...state,
    hasStarted: Boolean(state.hasStarted),
    tick: 0,
    elapsedMs: 0,
    ghostStepCounter: Number.isSafeInteger(state.ghostStepCounter) && state.ghostStepCounter >= 0
      ? state.ghostStepCounter
      : 0,
    frightenedUntil: relativeDeadline(state.frightenedUntil) || 0,
    ghosts: state.ghosts.map((ghost) => ({
      ...ghost,
      respawnAt: relativeDeadline(ghost.respawnAt),
    })),
  }
}

export default function MazeChaseGame() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { game, loading, setGame } = useGameState(gameId)
  const [mazeState, setMazeState] = useState<MazeChaseState | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [lastFacingDirection, setLastFacingDirection] = useState<Direction>('right')
  const [chompClosed, setChompClosed] = useState(false)
  const [wrapActorIds, setWrapActorIds] = useState<Set<string>>(new Set())
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null)
  const [snapResetActive, setSnapResetActive] = useState(false)
  const latestStateRef = useRef<MazeChaseState | null>(null)
  const pendingDirectionRef = useRef<Direction | undefined>(undefined)
  const lastCheckpointAtRef = useRef(0)
  const completedRef = useRef(false)
  const sessionGameIdRef = useRef<string | null>(null)
  const startCheckpointConfirmedRef = useRef(false)
  const startPromiseRef = useRef<Promise<boolean> | null>(null)
  const replayRecorderRef = useRef(createReplayRecorder())
  const replayEligibleRef = useRef(false)
  const [replayStatus, setReplayStatus] = useState<ReplayRunStatus>('unranked')
  const [unrankedReason, setUnrankedReason] = useState<ReplayUnrankedReason>('legacy')
  const prefersReducedMotion = usePrefersReducedMotion()
  const mazeDirection = mazeState?.player.direction
  const mazeTickMs = mazeState?.tickMs
  const engineSeed = game?.replay && REPLAY_SEED_PATTERN.test(game.replay.seed)
    ? game.replay.seed
    : LEGACY_FALLBACK_SEED

  useEffect(() => {
    if (!game) return
    const rawState = game.gameState as unknown as MazeChaseState
    const state = normalizeLegacyMazeState(rawState)
    setMazeState(state)
    latestStateRef.current = state
    pendingDirectionRef.current = isDirection(state.player.pendingDirection) ? state.player.pendingDirection : undefined
    setWrapActorIds(new Set())
    setChompClosed(false)
    setCountdownRemaining(null)
    setSnapResetActive(false)
    if (isDirection(state.player.direction)) {
      setLastFacingDirection(state.player.direction)
    }
    setIsPlaying(Boolean(state.hasStarted && game.status === 'active' && !state.isGameOver))

    if (sessionGameIdRef.current !== game._id) {
      sessionGameIdRef.current = game._id
      completedRef.current = game.status === 'completed'
      startCheckpointConfirmedRef.current = Boolean(state.hasStarted)
      startPromiseRef.current = null
      replayRecorderRef.current = createReplayRecorder(
        isDirection(state.player.pendingDirection) ? state.player.pendingDirection : undefined,
      )
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
    latestStateRef.current = mazeState
    if (mazeState && isDirection(mazeState.player.direction)) {
      setLastFacingDirection(mazeState.player.direction)
    }
  }, [mazeState])

  useEffect(() => {
    if (!isPlaying || !mazeDirection || !isDirection(mazeDirection)) {
      setChompClosed(false)
      return
    }

    const interval = window.setInterval(() => {
      setChompClosed((value) => !value)
    }, Math.max(70, Math.floor((mazeTickMs ?? 140) / 2)))

    return () => window.clearInterval(interval)
  }, [isPlaying, mazeDirection, mazeTickMs])

  useEffect(() => {
    if (countdownRemaining === null) return
    const timeout = window.setTimeout(() => {
      if (countdownRemaining <= 1) {
        setCountdownRemaining(null)
        const state = latestStateRef.current
        if (game?.status === 'active' && state && !state.isGameOver) {
          setIsPlaying(true)
        }
        return
      }
      setCountdownRemaining(countdownRemaining - 1)
    }, 1000)

    return () => window.clearTimeout(timeout)
  }, [countdownRemaining, game?.status])

  const saveState = useCallback(async (state: MazeChaseState, completed = false, syncGame = completed) => {
    if (!game || game.status !== 'active') return
    const res = await api.post(`/api/games/${game._id}/single-player/maze-chase/state`, { gameState: state, completed })
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

  const ensureRunStarted = useCallback(async (state: MazeChaseState): Promise<boolean> => {
    if (startCheckpointConfirmedRef.current) return true
    if (startPromiseRef.current) return startPromiseRef.current

    const startedState = { ...state, hasStarted: true }
    latestStateRef.current = startedState
    setMazeState(startedState)
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
          setMazeState(stoppedState)
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

  const completeRun = useCallback(async (state: MazeChaseState) => {
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

  const beginLifeResetCountdown = useCallback((state: MazeChaseState) => {
    pendingDirectionRef.current = undefined
    setIsPlaying(false)
    setChompClosed(false)
    setSnapResetActive(true)
    setWrapActorIds(new Set(['player', ...state.ghosts.map((ghost) => ghost.id)]))
    setCountdownRemaining(3)
    window.setTimeout(() => setSnapResetActive(false), 120)
  }, [])

  async function startGame() {
    if (!mazeState || mazeState.isGameOver || game?.status !== 'active' || countdownRemaining !== null) return
    await ensureRunStarted(mazeState)
  }

  const setPendingDirection = useCallback((direction: Direction) => {
    const current = latestStateRef.current
    if (game?.status !== 'active' || !current || current.isGameOver || countdownRemaining !== null) return

    pendingDirectionRef.current = direction
    const next = {
      ...current,
      hasStarted: true,
      player: { ...current.player, pendingDirection: direction },
    }
    latestStateRef.current = next
    setMazeState(next)
    if (startCheckpointConfirmedRef.current) setIsPlaying(true)
    else void ensureRunStarted(next)
  }, [countdownRemaining, ensureRunStarted, game?.status])

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

      const direction = pendingDirectionRef.current
      if (replayEligibleRef.current) {
        const recorder = replayRecorderRef.current
        if (current.tick !== recorder.tickCount) {
          markReplayUnranked('interrupted')
        } else if (!recordReplayTick(recorder, direction)) {
          markReplayUnranked(recorder.reason || 'limit')
        }
      }

      const next = stepMazeChaseState(current, { seed: engineSeed, direction })
      const wrappedActors = new Set<string>()
      if (isWrapMove(next, current.player.position, next.player.position)) {
        wrappedActors.add('player')
      }
      for (const ghost of next.ghosts) {
        const previousGhost = current.ghosts.find((item) => item.id === ghost.id)
        if (previousGhost && isWrapMove(next, previousGhost.position, ghost.position)) {
          wrappedActors.add(ghost.id)
        }
      }
      pendingDirectionRef.current = isDirection(next.player.pendingDirection)
        ? next.player.pendingDirection
        : undefined
      if (replayEligibleRef.current) replayRecorderRef.current.lastDirection = pendingDirectionRef.current
      latestStateRef.current = next
      setWrapActorIds(wrappedActors)
      setMazeState(next)

      const scored = next.score > current.score
      const levelChanged = next.level > current.level
      const lostLife = next.lives < current.lives && !next.isGameOver
      const now = Date.now()

      if (next.isGameOver && !completedRef.current) {
        completedRef.current = true
        setIsPlaying(false)
        void completeRun(next)
      } else if (lostLife) {
        beginLifeResetCountdown(next)
        lastCheckpointAtRef.current = now
        void saveState(next).catch(() => undefined)
      } else if (scored || levelChanged || now - lastCheckpointAtRef.current > 3000) {
        lastCheckpointAtRef.current = now
        void saveState(next).catch(() => undefined)
      }
    }, mazeState?.tickMs ?? 150)

    return () => window.clearInterval(interval)
  }, [beginLifeResetCountdown, completeRun, engineSeed, game?.status, isPlaying, markReplayUnranked, mazeState?.tickMs, saveState])

  useEffect(() => {
    function handleBeforeUnload() {
      const state = latestStateRef.current
      if (!game || game.status !== 'active' || !state) return
      if (state.isGameOver && replayEligibleRef.current) return
      const url = `/api/games/${game._id}/single-player/maze-chase/state`
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
      const res = await api.post('/api/games/single-player/create', { gameType: 'mazeChase' })
      navigate(`/single-player/maze-chase/${res.data.game._id}`, { replace: true })
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
      title: 'Close this Maze Chase run?',
      message: 'This will close the active Maze Chase run and remove it from your Single Player active games list.',
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

  const pelletCells = useMemo(() => new Set((mazeState?.pellets || []).map(getCellKey)), [mazeState])
  const powerPelletCells = useMemo(() => new Set((mazeState?.powerPellets || []).map(getCellKey)), [mazeState])

  if (loading || !mazeState) return <div className="flex min-h-screen items-center justify-center bg-page text-text-primary">Loading game...</div>
  if (!game) return <div className="flex min-h-screen items-center justify-center bg-page text-text-primary">Game not found</div>

  const isActive = game.status === 'active'
  const isCompleted = game.status === 'completed'
  const canRetry = mazeState.isGameOver || !isActive
  const canStartNewRun = canRetry && replayStatus !== 'verifying' && replayStatus !== 'retry'
  const isCountingDown = countdownRemaining !== null
  const playerTransitionMs = prefersReducedMotion || snapResetActive ? 0 : mazeState.tickMs
  const ghostTransitionMs = prefersReducedMotion || snapResetActive ? 0 : getGhostTickMs(mazeState.tickMs)
  const isPlayerMoving = isDirection(mazeState.player.direction)
  const playerSprite = getPlayerSprite(lastFacingDirection, isPlayerMoving && chompClosed)
  const replayPresentation = getReplayRunPresentation(replayStatus, unrankedReason)
  const replayPresentationClass = replayPresentation.tone === 'success'
    ? 'border-success/30 bg-success-subtle text-success-text'
    : replayPresentation.tone === 'warning'
      ? 'border-warning/30 bg-warning-subtle text-warning-text'
      : 'border-accent/30 bg-accent-subtle text-accent'

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
            <h1 className="text-gradient truncate text-xl font-semibold">Maze Chase</h1>
            <p className="text-sm text-text-muted">Level {mazeState.level} - {mazeState.lives} lives</p>
          </div>
          <div className="flex items-center gap-3">
            {canStartNewRun && (
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
            <div className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${isCompleted || mazeState.isGameOver ? 'bg-success-subtle text-success-text' : 'bg-accent-subtle text-accent'}`}>
              Score {mazeState.score}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="rounded-2xl border border-border/90 bg-surface/94 p-4 shadow-sm backdrop-blur-xl sm:p-5">
            <div className="mb-5 rounded-xl border border-border bg-page p-3">
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <span className="block text-xs font-medium text-text-muted">Score</span>
                  <span className="font-mono font-semibold text-text-primary">{mazeState.score}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-text-muted">Lives</span>
                  <span className="font-mono font-semibold text-danger">{mazeState.lives}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-text-muted">Pellets</span>
                  <span className="font-mono font-semibold text-text-primary">{mazeState.pellets.length + mazeState.powerPellets.length}</span>
                </div>
              </div>
            </div>
            <div className={`mb-4 rounded-xl border px-4 py-3 ${replayPresentationClass}`} aria-live="polite">
              <p className="text-sm font-semibold">{replayPresentation.label}</p>
              <p className="mt-1 text-xs opacity-90">{replayPresentation.detail}</p>
            </div>
            {mazeState.isGameOver && (
              <div className="mb-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-center text-sm font-medium text-success-text sm:flex-row">
                <span>Game over: final score {mazeState.score}</span>
                {replayStatus === 'retry' && (
                  <button
                    type="button"
                    onClick={() => void completeRun(mazeState)}
                    className="min-h-10 cursor-pointer rounded-lg border border-warning/40 bg-warning-subtle px-4 py-2 text-sm font-medium text-warning-text"
                  >
                    Retry verification
                  </button>
                )}
                {canStartNewRun && <button
                  type="button"
                  onClick={() => void retryGame()}
                  disabled={isRetrying}
                  className="min-h-10 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent shadow-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRetrying ? 'Starting...' : 'Retry'}
                </button>}
              </div>
            )}
            <div className="mx-auto w-full max-w-[min(92vw,72vh,42rem)]">
              <div
                className="relative aspect-square overflow-hidden rounded-xl border border-border bg-sunken shadow-sm outline-none"
                tabIndex={0}
                aria-label="Maze Chase board"
              >
                <div
                  className="absolute inset-1 grid overflow-hidden rounded-lg"
                  style={{
                    gridTemplateColumns: `repeat(${mazeState.width}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${mazeState.height}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: mazeState.width * mazeState.height }).map((_, index) => {
                    const x = index % mazeState.width
                    const y = Math.floor(index / mazeState.width)
                    const cell = { x, y }
                    const key = getCellKey(cell)
                    const isWallCell = mazeState.maze[y]?.[x] === '#'
                    const isPellet = pelletCells.has(key)
                    const isPowerPellet = powerPelletCells.has(key)
                    const isFruit = Boolean(mazeState.fruit?.active && !mazeState.fruit.collected && cellsMatch(mazeState.fruit.position, cell))
                    return (
                      <div
                        key={key}
                        className="relative min-h-0 min-w-0 overflow-hidden bg-[oklch(10%_0.03_265)]"
                      >
                        {isWallCell && <img src={WALL_TILES[getWallTileKey(mazeState.maze, x, y)]} alt="" className="absolute inset-0 block h-full w-full object-fill" draggable={false} />}
                        {isPellet && <img src={pelletSprite} alt="" className="absolute left-1/2 top-1/2 h-[48%] w-[48%] -translate-x-1/2 -translate-y-1/2 object-contain" />}
                        {isPowerPellet && <img src={powerPelletSprite} alt="" className="absolute left-1/2 top-1/2 h-[88%] w-[88%] -translate-x-1/2 -translate-y-1/2 object-contain" />}
                        {isFruit && <img src={fruitSprite} alt="" className="absolute left-1/2 top-1/2 z-10 h-[95%] w-[95%] -translate-x-1/2 -translate-y-1/2 object-contain" />}
                      </div>
                    )
                  })}
                </div>
                <div className="pointer-events-none absolute inset-1 overflow-hidden rounded-lg">
                  {mazeState.ghosts.filter((ghost) => ghost.mode !== 'hidden').map((ghost) => (
                    <img
                      key={ghost.id}
                      src={ghost.mode === 'frightened' ? ghostFrightenedSprite : GHOST_SPRITES[ghost.id] || ghostCyanSprite}
                      alt=""
                      className="absolute z-20 object-contain drop-shadow-[0_0_8px_currentColor]"
                      style={getActorStyle(mazeState, ghost.position, ghostTransitionMs, wrapActorIds.has(ghost.id))}
                    />
                  ))}
                  <img
                    src={playerSprite.src}
                    alt=""
                    className="absolute z-30 object-contain drop-shadow-[0_0_10px_oklch(80%_0.18_78)]"
                    style={{
                      ...getActorStyle(mazeState, mazeState.player.position, playerTransitionMs, wrapActorIds.has('player')),
                      transform: playerSprite.transform,
                    }}
                  />
                </div>
                {isCountingDown && (
                  <div className="pointer-events-none absolute inset-1 z-40 flex items-center justify-center rounded-lg bg-black/35 backdrop-blur-[1px]">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/30 bg-surface/85 text-5xl font-bold text-text-primary shadow-lg">
                      {countdownRemaining}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isCountingDown) return
                    if (!mazeState.hasStarted) {
                      void startGame()
                      return
                    }
                    setIsPlaying((value) => !value)
                  }}
                  disabled={!isActive || mazeState.isGameOver || isCountingDown || isStarting}
                  className="min-h-10 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent shadow-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStarting ? 'Starting...' : !mazeState.hasStarted ? 'Start' : isPlaying ? 'Pause' : 'Play'}
                </button>
                <span className="rounded-lg bg-overlay px-3 py-2 text-sm text-text-secondary">Use WASD or arrow keys</span>
              </div>
              <div className="mx-auto mt-4 grid w-44 select-none grid-cols-3 gap-2 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent] sm:hidden" aria-label="Touch controls">
                <span />
                <button type="button" onPointerDown={(event) => handleDirectionPress(event, 'up')} onContextMenu={preventTouchContextMenu} disabled={isCountingDown} className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary disabled:opacity-60 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]">Up</button>
                <span />
                <button type="button" onPointerDown={(event) => handleDirectionPress(event, 'left')} onContextMenu={preventTouchContextMenu} disabled={isCountingDown} className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary disabled:opacity-60 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]">Left</button>
                <button
                  type="button"
                  onClick={() => {
                    if (isCountingDown) return
                    if (!mazeState.hasStarted) {
                      void startGame()
                      return
                    }
                    setIsPlaying((value) => !value)
                  }}
                  disabled={!isActive || mazeState.isGameOver || isCountingDown || isStarting}
                  className="min-h-12 rounded-lg bg-accent text-xs font-bold text-text-on-accent disabled:opacity-60"
                >
                  {isStarting ? 'Starting' : !mazeState.hasStarted ? 'Start' : isPlaying ? 'Pause' : 'Play'}
                </button>
                <button type="button" onPointerDown={(event) => handleDirectionPress(event, 'right')} onContextMenu={preventTouchContextMenu} disabled={isCountingDown} className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary disabled:opacity-60 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]">Right</button>
                <span />
                <button type="button" onPointerDown={(event) => handleDirectionPress(event, 'down')} onContextMenu={preventTouchContextMenu} disabled={isCountingDown} className="min-h-12 select-none rounded-lg bg-elevated text-sm font-bold text-text-primary disabled:opacity-60 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]">Down</button>
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
