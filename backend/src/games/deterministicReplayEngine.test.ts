import {
  MAX_REPLAY_INPUTS,
  ReplayValidationError,
  createMazeChaseInitialState,
  createSnakeInitialState,
  replayMazeChase,
  replaySnake,
  stepMazeChaseState,
  stepSnakeState,
} from '@games-arena/game-engine'

const seed = 'b'.repeat(64)

describe('deterministic single-player replay engine', () => {
  it('produces identical Snake states from the same seed and input log', () => {
    const replay = { version: 1 as const, tickCount: 6, inputs: [] }
    const first = replaySnake(seed, { boardSize: 'small', wallLooping: false }, replay)
    const second = replaySnake(seed, { boardSize: 'small', wallLooping: false }, replay)

    expect(first).toEqual(second)
    expect(first).toMatchObject({ completed: true, score: 3, elapsedMs: 720 })
    expect(first.state.tick).toBe(6)
  })

  it('produces identical Maze Chase states and a canonical terminal tick', () => {
    const replay = { version: 1 as const, tickCount: 69, inputs: [] }
    const first = replayMazeChase(seed, replay)
    const second = replayMazeChase(seed, replay)

    expect(first).toEqual(second)
    expect(first).toMatchObject({ completed: true, score: 0, elapsedMs: 10_350 })
    expect(first.state).toMatchObject({ lives: 0, isGameOver: true, tick: 69 })
  })

  it('keeps step functions pure so browser and server simulations cannot share mutation', () => {
    const snake = createSnakeInitialState(seed, 'small')
    const maze = createMazeChaseInitialState(seed)
    const snakeSnapshot = structuredClone(snake)
    const mazeSnapshot = structuredClone(maze)

    stepSnakeState(snake, { seed, wallLooping: false })
    stepMazeChaseState(maze, { seed })

    expect(snake).toEqual(snakeSnapshot)
    expect(maze).toEqual(mazeSnapshot)
  })

  it('rejects reordered, duplicate, oversized, and post-completion inputs', () => {
    expect(() => replaySnake(seed, { boardSize: 'small', wallLooping: false }, {
      version: 1,
      tickCount: 6,
      inputs: [{ tick: 2, direction: 'up' }, { tick: 1, direction: 'left' }],
    })).toThrow(ReplayValidationError)

    expect(() => replaySnake(seed, { boardSize: 'small', wallLooping: false }, {
      version: 1,
      tickCount: 6,
      inputs: [{ tick: 1, direction: 'up' }, { tick: 1, direction: 'left' }],
    })).toThrow('unique increasing ticks')

    expect(() => replaySnake(seed, { boardSize: 'small', wallLooping: false }, {
      version: 1,
      tickCount: MAX_REPLAY_INPUTS + 1,
      inputs: Array.from({ length: MAX_REPLAY_INPUTS + 1 }, (_, tick) => ({ tick, direction: 'up' as const })),
    })).toThrow('Replay inputs are invalid')

    expect(() => replaySnake(seed, { boardSize: 'small', wallLooping: false }, {
      version: 1,
      tickCount: 7,
      inputs: [],
    })).toThrow('ticks after game over')
  })
})
