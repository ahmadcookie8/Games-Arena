export const GAME_ENGINE_VERSION: 1
export const MAX_REPLAY_TICKS: 20000
export const MAX_REPLAY_INPUTS: 1024
export const REPLAY_SEED_PATTERN: RegExp

export type Direction = 'up' | 'down' | 'left' | 'right'
export type SnakeBoardSize = 'small' | 'medium' | 'large'
export interface Point { x: number; y: number }
export interface ReplayInput { tick: number; direction: Direction }
export interface ReplayV1 { version: 1; tickCount: number; inputs: ReplayInput[] }

export interface SnakeState {
  width: number
  height: number
  snake: Point[]
  direction: Direction
  pendingDirection: Direction
  food: Point
  score: number
  isGameOver: boolean
  hasStarted: boolean
  tickMs: number
  tick: number
}

export type MazeChaseDirection = Direction | 'none'
export type MazeChaseGhostMode = 'chase' | 'frightened' | 'returning' | 'hidden'
export interface MazeChaseGhost {
  id: string
  color: string
  position: Point
  start: Point
  direction: MazeChaseDirection
  mode: MazeChaseGhostMode
  respawnAt?: number
}
export interface MazeChaseState {
  width: number
  height: number
  maze: string[]
  player: {
    position: Point
    start: Point
    direction: MazeChaseDirection
    pendingDirection: MazeChaseDirection
  }
  ghosts: MazeChaseGhost[]
  pellets: Point[]
  powerPellets: Point[]
  fruit: { position: Point; active: boolean; collected: boolean } | null
  score: number
  lives: number
  level: number
  frightenedUntil: number
  isGameOver: boolean
  hasStarted: boolean
  tickMs: number
  ghostStepCounter: number
  tick: number
  elapsedMs: number
}

export interface ReplayResult<TState> {
  state: TState
  score: number
  completed: boolean
  elapsedMs: number
}

export class ReplayValidationError extends Error {
  readonly code: string
  constructor(code: string, message: string)
}

export function createSnakeInitialState(seed: string, boardSize: SnakeBoardSize): SnakeState
export function stepSnakeState(
  state: SnakeState,
  options: { seed: string; wallLooping: boolean; direction?: Direction }
): SnakeState
export function replaySnake(
  seed: string,
  settings: { boardSize: SnakeBoardSize; wallLooping: boolean },
  replay: ReplayV1
): ReplayResult<SnakeState>

export function createMazeChaseInitialState(seed: string): MazeChaseState
export function stepMazeChaseState(
  state: MazeChaseState,
  options: { seed: string; direction?: Direction }
): MazeChaseState
export function replayMazeChase(seed: string, replay: ReplayV1): ReplayResult<MazeChaseState>

declare const engine: {
  GAME_ENGINE_VERSION: typeof GAME_ENGINE_VERSION
  MAX_REPLAY_TICKS: typeof MAX_REPLAY_TICKS
  MAX_REPLAY_INPUTS: typeof MAX_REPLAY_INPUTS
  REPLAY_SEED_PATTERN: typeof REPLAY_SEED_PATTERN
  ReplayValidationError: typeof ReplayValidationError
  createSnakeInitialState: typeof createSnakeInitialState
  stepSnakeState: typeof stepSnakeState
  replaySnake: typeof replaySnake
  createMazeChaseInitialState: typeof createMazeChaseInitialState
  stepMazeChaseState: typeof stepMazeChaseState
  replayMazeChase: typeof replayMazeChase
}
export default engine
