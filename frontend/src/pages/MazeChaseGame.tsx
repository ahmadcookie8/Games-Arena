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

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'
type GhostMode = 'chase' | 'frightened' | 'returning' | 'hidden'

interface MazePoint {
  x: number
  y: number
}

interface MazeGhost {
  id: string
  color: string
  position: MazePoint
  start: MazePoint
  direction: Direction
  mode: GhostMode
  respawnAt?: number
}

interface MazeChaseState {
  width: number
  height: number
  maze: string[]
  player: {
    position: MazePoint
    start: MazePoint
    direction: Direction
    pendingDirection: Direction
  }
  ghosts: MazeGhost[]
  pellets: MazePoint[]
  powerPellets: MazePoint[]
  fruit: {
    position: MazePoint
    active: boolean
    collected: boolean
  } | null
  score: number
  lives: number
  level: number
  frightenedUntil: number
  isGameOver: boolean
  hasStarted?: boolean
  tickMs: number
  ghostStepCounter?: number
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

const DIRECTION_DELTA: Record<Exclude<Direction, 'none'>, MazePoint> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITE_DIRECTION: Record<Exclude<Direction, 'none'>, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

const GHOST_EAT_SCORE = 200
const FRIGHTENED_MS = 7000
const GHOST_RESPAWN_MS = 3000
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

function isDirection(direction: Direction): direction is Exclude<Direction, 'none'> {
  return direction !== 'none'
}

function getRawNextPoint(point: MazePoint, direction: Direction): MazePoint {
  if (!isDirection(direction)) return point
  const delta = DIRECTION_DELTA[direction]
  return { x: point.x + delta.x, y: point.y + delta.y }
}

export function getNextPoint(state: MazeChaseState, point: MazePoint, direction: Direction): MazePoint {
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

export function getPlayerSprite(direction: Direction, mouthClosed = false): { src: string; transform?: string } {
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

export function canMove(state: MazeChaseState, point: MazePoint, direction: Direction): boolean {
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

function distance(left: MazePoint, right: MazePoint): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y)
}

function withoutCell(cells: MazePoint[], target: MazePoint): MazePoint[] {
  return cells.filter((cell) => !cellsMatch(cell, target))
}

function resetActors(state: MazeChaseState): MazeChaseState {
  return {
    ...state,
    player: {
      ...state.player,
      position: { ...state.player.start },
      direction: 'none',
      pendingDirection: 'none',
    },
    ghosts: state.ghosts.map((ghost) => ({
      ...ghost,
      position: { ...ghost.start },
      direction: ghost.direction === 'none' ? 'left' : ghost.direction,
      mode: 'chase',
      respawnAt: undefined,
    })),
    frightenedUntil: 0,
  }
}

function resetLevel(state: MazeChaseState): MazeChaseState {
  const source = state.maze
  const pellets: MazePoint[] = []
  const powerPellets: MazePoint[] = []
  source.forEach((row, y) => row.split('').forEach((cell, x) => {
    if (cell === '.') pellets.push({ x, y })
    if (cell === 'o') powerPellets.push({ x, y })
  }))

  return resetActors({
    ...state,
    pellets,
    powerPellets,
    fruit: { position: { x: 9, y: 13 }, active: true, collected: false },
    level: state.level + 1,
    tickMs: Math.max(90, state.tickMs - 8),
    ghostStepCounter: 0,
  })
}

function rankGhostDirections(state: MazeChaseState, ghost: MazeGhost, now: number): Direction[] {
  if (ghost.mode === 'hidden') return []

  const options = (Object.keys(DIRECTION_DELTA) as Array<Exclude<Direction, 'none'>>)
    .filter((direction) => !isWall(state, getNextPoint(state, ghost.position, direction)))
    .filter((direction) => !isDirection(ghost.direction) || OPPOSITE_DIRECTION[ghost.direction] !== direction)
  const available = options.length > 0
    ? options
    : (Object.keys(DIRECTION_DELTA) as Array<Exclude<Direction, 'none'>>).filter((direction) => !isWall(state, getNextPoint(state, ghost.position, direction)))
  if (available.length === 0) return []

  const target = ghost.mode === 'returning'
    ? ghost.start
    : now < state.frightenedUntil
      ? { x: state.width - state.player.position.x - 1, y: state.height - state.player.position.y - 1 }
      : state.player.position

  return available.sort((left, right) => {
    const leftDistance = distance(getNextPoint(state, ghost.position, left), target)
    const rightDistance = distance(getNextPoint(state, ghost.position, right), target)
    return ghost.mode === 'frightened' ? rightDistance - leftDistance : leftDistance - rightDistance
  })
}

function chooseGhostDirection(state: MazeChaseState, ghost: MazeGhost, now: number, reservedCells = new Set<string>()): Direction {
  const rankedDirections = rankGhostDirections(state, ghost, now)
  return rankedDirections.find((direction) => !reservedCells.has(getCellKey(getNextPoint(state, ghost.position, direction)))) || 'none'
}

function hasCollision(
  previousPlayerPosition: MazePoint,
  nextPlayerPosition: MazePoint,
  previousGhostPosition: MazePoint,
  nextGhostPosition: MazePoint
): boolean {
  const sameCellCollision = cellsMatch(nextPlayerPosition, nextGhostPosition)
  const swapCollision = cellsMatch(previousPlayerPosition, nextGhostPosition) && cellsMatch(previousGhostPosition, nextPlayerPosition)
  return sameCellCollision || swapCollision
}

function getLiveGhostMode(state: MazeChaseState, ghost: MazeGhost, now: number): GhostMode {
  if (ghost.mode === 'hidden') return 'hidden'
  if (ghost.mode === 'returning') return cellsMatch(ghost.position, ghost.start) ? 'chase' : 'returning'
  return now < state.frightenedUntil ? 'frightened' : 'chase'
}

function reviveHiddenGhosts(state: MazeChaseState, now: number): MazeChaseState {
  const reservedCells = new Set(
    state.ghosts
      .filter((ghost) => ghost.mode !== 'hidden')
      .map((ghost) => getCellKey(ghost.position))
  )

  return {
    ...state,
    ghosts: state.ghosts.map((ghost) => {
      if (ghost.mode !== 'hidden' || ghost.respawnAt === undefined || now < ghost.respawnAt) return ghost
      const startKey = getCellKey(ghost.start)
      if (reservedCells.has(startKey)) return ghost
      reservedCells.add(startKey)
      return {
        ...ghost,
        position: { ...ghost.start },
        mode: 'chase',
        direction: ghost.direction === 'none' ? 'left' : ghost.direction,
        respawnAt: undefined,
      }
    }),
  }
}

function resolveGhostCollisions(
  state: MazeChaseState,
  previousPlayerPosition: MazePoint,
  nextPlayerPosition: MazePoint,
  previousGhostPositions: Map<string, MazePoint>,
  now: number
): MazeChaseState {
  let next = state
  for (const ghost of next.ghosts) {
    if (ghost.mode === 'returning' || ghost.mode === 'hidden') continue
    const collisionMode = getLiveGhostMode(next, ghost, now)
    const previousGhostPosition = previousGhostPositions.get(ghost.id) || ghost.position
    if (!hasCollision(previousPlayerPosition, nextPlayerPosition, previousGhostPosition, ghost.position)) continue

    if (collisionMode === 'frightened') {
      next = {
        ...next,
        score: next.score + GHOST_EAT_SCORE,
        ghosts: next.ghosts.map((item) => item.id === ghost.id ? {
          ...item,
          position: { ...item.start },
          mode: 'hidden',
          direction: 'none',
          respawnAt: now + GHOST_RESPAWN_MS,
        } : item),
      }
    } else {
      const lives = Math.max(0, next.lives - 1)
      next = resetActors({ ...next, lives, isGameOver: lives === 0 })
      break
    }
  }
  return next
}

export function nextMazeState(state: MazeChaseState): MazeChaseState {
  if (state.isGameOver) return state

  const now = Date.now()
  let next: MazeChaseState = reviveHiddenGhosts({ ...state, hasStarted: true }, now)
  const previousPlayerPosition = { ...next.player.position }
  const previousGhostPositions = new Map(next.ghosts.map((ghost) => [ghost.id, { ...ghost.position }]))
  const desiredDirection = canMove(next, next.player.position, next.player.pendingDirection)
    ? next.player.pendingDirection
    : next.player.direction
  const playerDirection = canMove(next, next.player.position, desiredDirection) ? desiredDirection : 'none'
  const playerPosition = getNextPoint(next, next.player.position, playerDirection)

  next = {
    ...next,
    player: { ...next.player, position: playerPosition, direction: playerDirection },
  }

  const atePellet = next.pellets.some((cell) => cellsMatch(cell, playerPosition))
  const atePowerPellet = next.powerPellets.some((cell) => cellsMatch(cell, playerPosition))
  const ateFruit = Boolean(next.fruit?.active && !next.fruit.collected && cellsMatch(next.fruit.position, playerPosition))

  if (atePellet) {
    next = { ...next, pellets: withoutCell(next.pellets, playerPosition), score: next.score + 10 }
  }
  if (atePowerPellet) {
    next = {
      ...next,
      powerPellets: withoutCell(next.powerPellets, playerPosition),
      score: next.score + 50,
      frightenedUntil: now + FRIGHTENED_MS,
    }
  }
  if (ateFruit && next.fruit) {
    next = {
      ...next,
      fruit: { ...next.fruit, active: false, collected: true },
      score: next.score + 100,
    }
  }

  next = resolveGhostCollisions(next, previousPlayerPosition, next.player.position, previousGhostPositions, now)

  if (!next.isGameOver && next.pellets.length === 0 && next.powerPellets.length === 0) {
    next = resetLevel(next)
  }

  return next
}

export function getGhostTickMs(tickMs: number): number {
  return Math.round(tickMs * 1.2)
}

export function nextGhostState(state: MazeChaseState, previousPlayerPosition = state.player.position): MazeChaseState {
  if (state.isGameOver) return state

  const now = Date.now()
  let next = reviveHiddenGhosts({ ...state, hasStarted: true }, now)
  const previousGhostPositions = new Map(next.ghosts.map((ghost) => [ghost.id, { ...ghost.position }]))
  const reservedCells = new Set(
    next.ghosts
      .filter((ghost) => ghost.mode !== 'hidden')
      .map((ghost) => getCellKey(ghost.position))
  )

  next = {
    ...next,
    ghosts: next.ghosts.map((ghost) => {
      if (ghost.mode === 'hidden') return ghost

      reservedCells.delete(getCellKey(ghost.position))
      const mode = getLiveGhostMode(next, ghost, now)
      const direction = chooseGhostDirection(next, { ...ghost, mode }, now, reservedCells)
      const position = direction === 'none' ? ghost.position : getNextPoint(next, ghost.position, direction)
      reservedCells.add(getCellKey(position))
      return { ...ghost, mode, direction, position }
    }),
  }

  return resolveGhostCollisions(next, previousPlayerPosition, next.player.position, previousGhostPositions, now)
}

export function advanceMazeState(state: MazeChaseState, steps: number): MazeChaseState {
  let next = state
  for (let index = 0; index < steps; index += 1) {
    next = nextMazeState(next)
  }
  return next
}

export default function MazeChaseGame() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { game, loading, setGame } = useGameState(gameId)
  const [mazeState, setMazeState] = useState<MazeChaseState | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [lastFacingDirection, setLastFacingDirection] = useState<Exclude<Direction, 'none'>>('right')
  const [chompClosed, setChompClosed] = useState(false)
  const [wrapActorIds, setWrapActorIds] = useState<Set<string>>(new Set())
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null)
  const [snapResetActive, setSnapResetActive] = useState(false)
  const latestStateRef = useRef<MazeChaseState | null>(null)
  const previousPlayerPositionRef = useRef<MazePoint | null>(null)
  const pendingDirectionRef = useRef<Direction>('none')
  const lastCheckpointAtRef = useRef(0)
  const completedRef = useRef(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (!game) return
    const state = game.gameState as unknown as MazeChaseState
    setMazeState(state)
    latestStateRef.current = state
    previousPlayerPositionRef.current = state.player.position
    pendingDirectionRef.current = state.player.pendingDirection
    setWrapActorIds(new Set())
    setChompClosed(false)
    setCountdownRemaining(null)
    setSnapResetActive(false)
    if (isDirection(state.player.direction)) {
      setLastFacingDirection(state.player.direction)
    }
    setIsPlaying(Boolean(state.hasStarted && game.status === 'active' && !state.isGameOver))
  }, [game])

  useEffect(() => {
    latestStateRef.current = mazeState
    if (mazeState && isDirection(mazeState.player.direction)) {
      setLastFacingDirection(mazeState.player.direction)
    }
  }, [mazeState])

  useEffect(() => {
    if (!isPlaying || !mazeState || !isDirection(mazeState.player.direction)) {
      setChompClosed(false)
      return
    }

    const interval = window.setInterval(() => {
      setChompClosed((value) => !value)
    }, Math.max(70, Math.floor(mazeState.tickMs / 2)))

    return () => window.clearInterval(interval)
  }, [isPlaying, mazeState?.player.direction, mazeState?.tickMs])

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

  const beginLifeResetCountdown = useCallback((state: MazeChaseState) => {
    pendingDirectionRef.current = 'none'
    previousPlayerPositionRef.current = state.player.position
    setIsPlaying(false)
    setChompClosed(false)
    setSnapResetActive(true)
    setWrapActorIds(new Set(['player', ...state.ghosts.map((ghost) => ghost.id)]))
    setCountdownRemaining(3)
    window.setTimeout(() => setSnapResetActive(false), 120)
  }, [])

  function startGame() {
    if (!mazeState || mazeState.isGameOver || game?.status !== 'active' || countdownRemaining !== null) return
    const next = { ...mazeState, hasStarted: true }
    setMazeState(next)
    latestStateRef.current = next
    previousPlayerPositionRef.current = next.player.position
    setIsPlaying(true)
    void saveState(next).catch(() => undefined)
  }

  const setPendingDirection = useCallback((direction: Direction) => {
    const current = latestStateRef.current
    if (game?.status !== 'active' || !current || current.isGameOver || countdownRemaining !== null) return

    pendingDirectionRef.current = direction
    setMazeState((current) => {
      if (!current || current.isGameOver) return current
      const next = {
        ...current,
        hasStarted: true,
        player: { ...current.player, pendingDirection: direction },
      }
      latestStateRef.current = next
      return next
    })
    setIsPlaying(true)
  }, [countdownRemaining, game?.status])

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

      const queuedState = {
        ...current,
        player: { ...current.player, pendingDirection: pendingDirectionRef.current },
      }
      const next = nextMazeState(queuedState)
      const wrappedActors = new Set<string>()
      if (isWrapMove(next, current.player.position, next.player.position)) {
        wrappedActors.add('player')
      }
      pendingDirectionRef.current = next.player.pendingDirection
      previousPlayerPositionRef.current = current.player.position
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
        void saveState(next, true, true).catch((err: unknown) => {
          setModal({ title: 'Could not save score', message: getErrorMessage(err), variant: 'danger' })
        })
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
  }, [beginLifeResetCountdown, game?.status, isPlaying, mazeState?.tickMs, saveState])

  useEffect(() => {
    if (!latestStateRef.current || !isPlaying || game?.status !== 'active') return

    const interval = window.setInterval(() => {
      const current = latestStateRef.current
      if (!current) return

      const next = nextGhostState(current, previousPlayerPositionRef.current || current.player.position)
      const wrappedActors = new Set<string>()
      for (const ghost of next.ghosts) {
        const previousGhost = current.ghosts.find((item) => item.id === ghost.id)
        if (previousGhost && isWrapMove(next, previousGhost.position, ghost.position)) {
          wrappedActors.add(ghost.id)
        }
      }
      latestStateRef.current = next
      setWrapActorIds(wrappedActors)
      setMazeState(next)

      const scored = next.score > current.score
      const lostLife = next.lives < current.lives && !next.isGameOver
      const now = Date.now()

      if (next.isGameOver && !completedRef.current) {
        completedRef.current = true
        setIsPlaying(false)
        void saveState(next, true, true).catch((err: unknown) => {
          setModal({ title: 'Could not save score', message: getErrorMessage(err), variant: 'danger' })
        })
      } else if (lostLife) {
        beginLifeResetCountdown(next)
        lastCheckpointAtRef.current = now
        void saveState(next).catch(() => undefined)
      } else if (scored || now - lastCheckpointAtRef.current > 3000) {
        lastCheckpointAtRef.current = now
        void saveState(next).catch(() => undefined)
      }
    }, getGhostTickMs(mazeState?.tickMs ?? 150))

    return () => window.clearInterval(interval)
  }, [beginLifeResetCountdown, game?.status, isPlaying, mazeState?.tickMs, saveState])

  useEffect(() => {
    function handleBeforeUnload() {
      const state = latestStateRef.current
      if (!game || game.status !== 'active' || !state) return
      const url = `/api/games/${game._id}/single-player/maze-chase/state`
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
  const isCountingDown = countdownRemaining !== null
  const playerTransitionMs = prefersReducedMotion || snapResetActive ? 0 : mazeState.tickMs
  const ghostTransitionMs = prefersReducedMotion || snapResetActive ? 0 : getGhostTickMs(mazeState.tickMs)
  const isPlayerMoving = isDirection(mazeState.player.direction)
  const playerSprite = getPlayerSprite(lastFacingDirection, isPlayerMoving && chompClosed)

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
            {mazeState.isGameOver && (
              <div className="mb-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-center text-sm font-medium text-success-text sm:flex-row">
                <span>Game over: final score {mazeState.score}</span>
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
                      startGame()
                      return
                    }
                    setIsPlaying((value) => !value)
                  }}
                  disabled={!isActive || mazeState.isGameOver || isCountingDown}
                  className="min-h-10 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent shadow-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {!mazeState.hasStarted ? 'Start' : isPlaying ? 'Pause' : 'Play'}
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
                      startGame()
                      return
                    }
                    setIsPlaying((value) => !value)
                  }}
                  disabled={!isActive || mazeState.isGameOver || isCountingDown}
                  className="min-h-12 rounded-lg bg-accent text-xs font-bold text-text-on-accent disabled:opacity-60"
                >
                  {!mazeState.hasStarted ? 'Start' : isPlaying ? 'Pause' : 'Play'}
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
