'use strict'

const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const {
  ReplayValidationError,
  createMazeChaseInitialState,
  createSnakeInitialState,
  replayMazeChase,
  replaySnake,
  stepMazeChaseState,
  stepSnakeState,
} = require('..')

const seed = 'b'.repeat(64)

test('Snake replay is deterministic and reaches one canonical terminal tick', () => {
  const replay = { version: 1, tickCount: 6, inputs: [] }
  const first = replaySnake(seed, { boardSize: 'small', wallLooping: false }, replay)
  const second = replaySnake(seed, { boardSize: 'small', wallLooping: false }, replay)
  assert.deepEqual(first, second)
  assert.deepEqual({ completed: first.completed, score: first.score, tick: first.state.tick }, {
    completed: true,
    score: 3,
    tick: 6,
  })
})

test('Maze Chase replay is deterministic and uses logical elapsed time', () => {
  const replay = { version: 1, tickCount: 69, inputs: [] }
  const first = replayMazeChase(seed, replay)
  const second = replayMazeChase(seed, replay)
  assert.deepEqual(first, second)
  assert.deepEqual({ completed: first.completed, lives: first.state.lives, elapsedMs: first.elapsedMs }, {
    completed: true,
    lives: 0,
    elapsedMs: 10_350,
  })
})

test('step functions do not mutate their input state', () => {
  const snake = createSnakeInitialState(seed, 'small')
  const maze = createMazeChaseInitialState(seed)
  const snakeBefore = structuredClone(snake)
  const mazeBefore = structuredClone(maze)
  stepSnakeState(snake, { seed, wallLooping: false })
  stepMazeChaseState(maze, { seed })
  assert.deepEqual(snake, snakeBefore)
  assert.deepEqual(maze, mazeBefore)
})

test('replay rejects reordered and padded logs', () => {
  assert.throws(() => replaySnake(seed, { boardSize: 'small', wallLooping: false }, {
    version: 1,
    tickCount: 6,
    inputs: [{ tick: 2, direction: 'up' }, { tick: 1, direction: 'left' }],
  }), ReplayValidationError)
  assert.throws(() => replaySnake(seed, { boardSize: 'small', wallLooping: false }, {
    version: 1,
    tickCount: 7,
    inputs: [],
  }), /ticks after game over/)
})

test('CommonJS and ESM consumers execute the same engine implementation', async () => {
  const esm = await import('../index.mjs')
  const replay = { version: 1, tickCount: 6, inputs: [] }
  assert.deepEqual(
    esm.replaySnake(seed, { boardSize: 'small', wallLooping: false }, replay),
    replaySnake(seed, { boardSize: 'small', wallLooping: false }, replay),
  )
  assert.equal(esm.GAME_ENGINE_VERSION, 1)
})

test('browser ESM entry has no CommonJS runtime dependency', () => {
  const esmSource = readFileSync(join(__dirname, '..', 'index.mjs'), 'utf8')
  assert.doesNotMatch(esmSource, /from\s+['"][^'"]+\.cjs['"]|\brequire\s*\(|\bmodule\.exports\b/)
  assert.match(esmSource, /export\s*\{/)
})
