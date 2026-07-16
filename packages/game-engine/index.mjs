const GAME_ENGINE_VERSION = 1
const MAX_REPLAY_TICKS = 20_000
const MAX_REPLAY_INPUTS = 1_024
const REPLAY_SEED_PATTERN = /^[a-f0-9]{64}$/
const DIRECTIONS = ['up', 'down', 'left', 'right']
const DIRECTION_SET = new Set(DIRECTIONS)
const DIRECTION_DELTA = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
const OPPOSITE_DIRECTION = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}
const SNAKE_BOARD_DIMENSIONS = { small: 12, medium: 18, large: 24 }

const MAZE_CHASE_LAYOUT = [
  '#####################',
  '#.........#.........#',
  '#.###.###.#.###.###.#',
  '#o#.....#...#.....#o#',
  '#.###.#.#####.#.###.#',
  '#.....#...#...#.....#',
  '#####.###.#.###.#####',
  '    #.#.......#.#    ',
  '#####.#.## ##.#.#####',
  '     ...#   #...     ',
  '#####.#.#####.#.#####',
  '    #.#.......#.#    ',
  '#####.#.#####.#.#####',
  '#.........#.........#',
  '#.###.###.#.###.###.#',
  '#o..#.....P.....#..o#',
  '###.#.#.#####.#.#.###',
  '#.....#...#...#.....#',
  '#.#######.#.#######.#',
  '#...................#',
  '#####################',
]
const MAZE_CHASE_PLAYER_START = { x: 10, y: 15 }
const MAZE_CHASE_GHOST_STARTS = [
  { id: 'spark', color: '#22d3ee', position: { x: 9, y: 9 }, direction: 'left' },
  { id: 'rose', color: '#fb7185', position: { x: 10, y: 9 }, direction: 'up' },
  { id: 'lime', color: '#4ade80', position: { x: 11, y: 9 }, direction: 'right' },
  { id: 'ember', color: '#f97316', position: { x: 10, y: 8 }, direction: 'down' },
]
const GHOST_EAT_SCORE = 200
const FRIGHTENED_MS = 7_000
const GHOST_RESPAWN_MS = 3_000

class ReplayValidationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ReplayValidationError'
    this.code = code
  }
}

function assertSeed(seed) {
  if (typeof seed !== 'string' || !REPLAY_SEED_PATTERN.test(seed)) {
    throw new ReplayValidationError('INVALID_REPLAY_SEED', 'Replay seed is invalid')
  }
}

function assertDirection(direction) {
  if (!DIRECTION_SET.has(direction)) {
    throw new ReplayValidationError('INVALID_REPLAY_DIRECTION', 'Replay direction is invalid')
  }
}

function validateReplay(replay) {
  if (!replay || typeof replay !== 'object' || Array.isArray(replay)) {
    throw new ReplayValidationError('INVALID_REPLAY', 'Replay payload is invalid')
  }
  if (replay.version !== GAME_ENGINE_VERSION) {
    throw new ReplayValidationError('UNSUPPORTED_REPLAY_VERSION', 'Replay version is not supported')
  }
  if (!Number.isSafeInteger(replay.tickCount) || replay.tickCount < 1 || replay.tickCount > MAX_REPLAY_TICKS) {
    throw new ReplayValidationError('INVALID_REPLAY_TICKS', 'Replay tick count is invalid')
  }
  if (!Array.isArray(replay.inputs) || replay.inputs.length > MAX_REPLAY_INPUTS) {
    throw new ReplayValidationError('INVALID_REPLAY_INPUTS', 'Replay inputs are invalid')
  }

  let previousTick = -1
  for (const input of replay.inputs) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ReplayValidationError('INVALID_REPLAY_INPUT', 'Replay input is invalid')
    }
    if (!Number.isSafeInteger(input.tick) || input.tick < 0 || input.tick >= replay.tickCount) {
      throw new ReplayValidationError('INVALID_REPLAY_INPUT_TICK', 'Replay input tick is invalid')
    }
    if (input.tick <= previousTick) {
      throw new ReplayValidationError('REPLAY_INPUT_ORDER', 'Replay inputs must use unique increasing ticks')
    }
    assertDirection(input.direction)
    previousTick = input.tick
  }
}

// A compact, platform-independent hash gives deterministic choices in Node and
// browsers without serializing mutable PRNG internals into the game state.
function deterministicIndex(seed, label, upperBound) {
  if (!Number.isSafeInteger(upperBound) || upperBound <= 0) return 0
  let hash = 2166136261
  const input = `${seed}:${label}`
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % upperBound
}

function cellsMatch(left, right) {
  return left.x === right.x && left.y === right.y
}

function cellKey(cell) {
  return `${cell.x}:${cell.y}`
}

function findSnakeFood(seed, width, height, snake, sequence) {
  const occupied = new Set(snake.map(cellKey))
  const openCells = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!occupied.has(`${x}:${y}`)) openCells.push({ x, y })
    }
  }
  if (openCells.length === 0) return null
  return openCells[deterministicIndex(seed, `snake-food:${sequence}`, openCells.length)]
}

function createSnakeInitialState(seed, boardSize) {
  assertSeed(seed)
  const size = SNAKE_BOARD_DIMENSIONS[boardSize]
  if (!size) throw new ReplayValidationError('INVALID_SNAKE_BOARD', 'Snake board size is invalid')
  const center = Math.floor(size / 2)
  const snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ]
  return {
    width: size,
    height: size,
    snake,
    direction: 'right',
    pendingDirection: 'right',
    food: findSnakeFood(seed, size, size, snake, 0) || { ...snake[0] },
    score: snake.length,
    isGameOver: false,
    hasStarted: false,
    tickMs: 120,
    tick: 0,
  }
}

function stepSnakeState(state, options) {
  if (!options || typeof options !== 'object') {
    throw new ReplayValidationError('INVALID_SNAKE_OPTIONS', 'Snake step options are invalid')
  }
  assertSeed(options.seed)
  if (state.isGameOver) return clone(state)

  let pendingDirection = state.pendingDirection
  if (options.direction !== undefined) {
    assertDirection(options.direction)
    if (OPPOSITE_DIRECTION[state.direction] === options.direction) {
      throw new ReplayValidationError('INVALID_DIRECTION_TRANSITION', 'Snake cannot reverse direction')
    }
    pendingDirection = options.direction
  }
  assertDirection(pendingDirection)

  const tick = safeStateTick(state) + 1
  const delta = DIRECTION_DELTA[pendingDirection]
  const head = state.snake[0]
  let nextHead = { x: head.x + delta.x, y: head.y + delta.y }

  if (options.wallLooping === true) {
    nextHead = {
      x: (nextHead.x + state.width) % state.width,
      y: (nextHead.y + state.height) % state.height,
    }
  } else if (nextHead.x < 0 || nextHead.x >= state.width || nextHead.y < 0 || nextHead.y >= state.height) {
    return {
      ...clone(state),
      direction: pendingDirection,
      pendingDirection,
      isGameOver: true,
      hasStarted: true,
      tick,
    }
  }

  const ateFood = cellsMatch(nextHead, state.food)
  const nextSnake = ateFood
    ? [nextHead, ...state.snake.map(copyPoint)]
    : [nextHead, ...state.snake.slice(0, -1).map(copyPoint)]
  if (nextSnake.slice(1).some((cell) => cellsMatch(cell, nextHead))) {
    return {
      ...clone(state),
      direction: pendingDirection,
      pendingDirection,
      isGameOver: true,
      hasStarted: true,
      tick,
    }
  }

  const food = ateFood
    ? findSnakeFood(options.seed, state.width, state.height, nextSnake, tick)
    : copyPoint(state.food)
  return {
    ...clone(state),
    snake: nextSnake,
    direction: pendingDirection,
    pendingDirection,
    food: food || copyPoint(nextHead),
    score: nextSnake.length,
    isGameOver: food === null,
    hasStarted: true,
    tick,
  }
}

function replaySnake(seed, settings, replay) {
  assertSeed(seed)
  validateReplay(replay)
  if (!settings || !SNAKE_BOARD_DIMENSIONS[settings.boardSize] || typeof settings.wallLooping !== 'boolean') {
    throw new ReplayValidationError('INVALID_SNAKE_SETTINGS', 'Snake replay settings are invalid')
  }
  let state = createSnakeInitialState(seed, settings.boardSize)
  let inputIndex = 0
  for (let tick = 0; tick < replay.tickCount; tick += 1) {
    if (state.isGameOver) {
      throw new ReplayValidationError('REPLAY_AFTER_COMPLETION', 'Replay contains ticks after game over')
    }
    const input = replay.inputs[inputIndex]?.tick === tick ? replay.inputs[inputIndex++] : undefined
    state = stepSnakeState(state, {
      seed,
      wallLooping: settings.wallLooping,
      direction: input?.direction,
    })
  }
  return {
    state,
    score: state.score,
    completed: state.isGameOver,
    elapsedMs: replay.tickCount * state.tickMs,
  }
}

function mazePellets() {
  const pellets = []
  const powerPellets = []
  MAZE_CHASE_LAYOUT.forEach((row, y) => {
    row.split('').forEach((cell, x) => {
      if (cell === '.') pellets.push({ x, y })
      if (cell === 'o') powerPellets.push({ x, y })
    })
  })
  return { pellets, powerPellets }
}

function createMazeChaseInitialState(seed) {
  assertSeed(seed)
  const { pellets, powerPellets } = mazePellets()
  return {
    width: MAZE_CHASE_LAYOUT[0].length,
    height: MAZE_CHASE_LAYOUT.length,
    maze: [...MAZE_CHASE_LAYOUT],
    player: {
      position: { ...MAZE_CHASE_PLAYER_START },
      start: { ...MAZE_CHASE_PLAYER_START },
      direction: 'none',
      pendingDirection: 'none',
    },
    ghosts: MAZE_CHASE_GHOST_STARTS.map((ghost) => ({
      id: ghost.id,
      color: ghost.color,
      position: copyPoint(ghost.position),
      start: copyPoint(ghost.position),
      direction: ghost.direction,
      mode: 'chase',
    })),
    pellets,
    powerPellets,
    fruit: { position: { x: 9, y: 13 }, active: true, collected: false },
    score: 0,
    lives: 3,
    level: 1,
    frightenedUntil: 0,
    isGameOver: false,
    hasStarted: false,
    tickMs: 150,
    ghostStepCounter: 0,
    tick: 0,
    elapsedMs: 0,
  }
}

function getNextPoint(state, point, direction) {
  if (!DIRECTION_SET.has(direction)) return copyPoint(point)
  const delta = DIRECTION_DELTA[direction]
  const next = { x: point.x + delta.x, y: point.y + delta.y }
  if (direction === 'left' && next.x < 0) next.x = state.width - 1
  if (direction === 'right' && next.x >= state.width) next.x = 0
  return next
}

function isMazeWall(state, point) {
  return point.x < 0 || point.x >= state.width || point.y < 0 || point.y >= state.height || state.maze[point.y]?.[point.x] === '#'
}

function canMazeMove(state, point, direction) {
  return DIRECTION_SET.has(direction) && !isMazeWall(state, getNextPoint(state, point, direction))
}

function withoutCell(cells, target) {
  return cells.filter((cell) => !cellsMatch(cell, target)).map(copyPoint)
}

function resetMazeActors(state) {
  return {
    ...state,
    player: {
      ...state.player,
      position: copyPoint(state.player.start),
      direction: 'none',
      pendingDirection: 'none',
    },
    ghosts: state.ghosts.map((ghost) => ({
      ...ghost,
      position: copyPoint(ghost.start),
      direction: ghost.direction === 'none' ? 'left' : ghost.direction,
      mode: 'chase',
      respawnAt: undefined,
    })),
    frightenedUntil: 0,
  }
}

function resetMazeLevel(state) {
  const { pellets, powerPellets } = mazePellets()
  return resetMazeActors({
    ...state,
    pellets,
    powerPellets,
    fruit: { position: { x: 9, y: 13 }, active: true, collected: false },
    level: state.level + 1,
    tickMs: Math.max(90, state.tickMs - 8),
    ghostStepCounter: 0,
  })
}

function reviveHiddenGhosts(state, now) {
  const reserved = new Set(state.ghosts.filter((ghost) => ghost.mode !== 'hidden').map((ghost) => cellKey(ghost.position)))
  return {
    ...state,
    ghosts: state.ghosts.map((ghost) => {
      if (ghost.mode !== 'hidden' || ghost.respawnAt === undefined || now < ghost.respawnAt) return { ...ghost, position: copyPoint(ghost.position), start: copyPoint(ghost.start) }
      const startKey = cellKey(ghost.start)
      if (reserved.has(startKey)) return { ...ghost, position: copyPoint(ghost.position), start: copyPoint(ghost.start) }
      reserved.add(startKey)
      return {
        ...ghost,
        position: copyPoint(ghost.start),
        start: copyPoint(ghost.start),
        mode: 'chase',
        direction: ghost.direction === 'none' ? 'left' : ghost.direction,
        respawnAt: undefined,
      }
    }),
  }
}

function liveGhostMode(state, ghost, now) {
  if (ghost.mode === 'hidden') return 'hidden'
  if (ghost.mode === 'returning') return cellsMatch(ghost.position, ghost.start) ? 'chase' : 'returning'
  return now < state.frightenedUntil ? 'frightened' : 'chase'
}

function rankGhostDirections(seed, state, ghost, now) {
  const options = DIRECTIONS
    .filter((direction) => !isMazeWall(state, getNextPoint(state, ghost.position, direction)))
    .filter((direction) => !DIRECTION_SET.has(ghost.direction) || OPPOSITE_DIRECTION[ghost.direction] !== direction)
  const available = options.length > 0
    ? options
    : DIRECTIONS.filter((direction) => !isMazeWall(state, getNextPoint(state, ghost.position, direction)))
  const target = ghost.mode === 'returning'
    ? ghost.start
    : now < state.frightenedUntil
      ? { x: state.width - state.player.position.x - 1, y: state.height - state.player.position.y - 1 }
      : state.player.position
  return available.sort((left, right) => {
    const leftDistance = distance(getNextPoint(state, ghost.position, left), target)
    const rightDistance = distance(getNextPoint(state, ghost.position, right), target)
    const distanceOrder = ghost.mode === 'frightened' ? rightDistance - leftDistance : leftDistance - rightDistance
    if (distanceOrder !== 0) return distanceOrder
    return deterministicIndex(seed, `maze:${state.tick}:${ghost.id}:${left}`, 0x7fffffff)
      - deterministicIndex(seed, `maze:${state.tick}:${ghost.id}:${right}`, 0x7fffffff)
  })
}

function chooseGhostDirection(seed, state, ghost, now, reserved) {
  return rankGhostDirections(seed, state, ghost, now)
    .find((direction) => !reserved.has(cellKey(getNextPoint(state, ghost.position, direction)))) || 'none'
}

function hasCollision(previousPlayer, nextPlayer, previousGhost, nextGhost) {
  return cellsMatch(nextPlayer, nextGhost)
    || (cellsMatch(previousPlayer, nextGhost) && cellsMatch(previousGhost, nextPlayer))
}

function resolveGhostCollisions(state, previousPlayer, nextPlayer, previousGhosts, now) {
  let next = state
  for (const ghost of next.ghosts) {
    if (ghost.mode === 'returning' || ghost.mode === 'hidden') continue
    const mode = liveGhostMode(next, ghost, now)
    const previousGhost = previousGhosts.get(ghost.id) || ghost.position
    if (!hasCollision(previousPlayer, nextPlayer, previousGhost, ghost.position)) continue
    if (mode === 'frightened') {
      next = {
        ...next,
        score: next.score + GHOST_EAT_SCORE,
        ghosts: next.ghosts.map((item) => item.id === ghost.id ? {
          ...item,
          position: copyPoint(item.start),
          mode: 'hidden',
          direction: 'none',
          respawnAt: now + GHOST_RESPAWN_MS,
        } : item),
      }
    } else {
      const lives = Math.max(0, next.lives - 1)
      next = resetMazeActors({ ...next, lives, isGameOver: lives === 0 })
      break
    }
  }
  return next
}

function moveGhosts(seed, state, now, previousPlayer) {
  let next = reviveHiddenGhosts(state, now)
  const previousGhosts = new Map(next.ghosts.map((ghost) => [ghost.id, copyPoint(ghost.position)]))
  const reserved = new Set(next.ghosts.filter((ghost) => ghost.mode !== 'hidden').map((ghost) => cellKey(ghost.position)))
  next = {
    ...next,
    ghosts: next.ghosts.map((ghost) => {
      if (ghost.mode === 'hidden') return ghost
      reserved.delete(cellKey(ghost.position))
      const mode = liveGhostMode(next, ghost, now)
      const direction = chooseGhostDirection(seed, next, { ...ghost, mode }, now, reserved)
      const position = direction === 'none' ? copyPoint(ghost.position) : getNextPoint(next, ghost.position, direction)
      reserved.add(cellKey(position))
      return { ...ghost, mode, direction, position }
    }),
  }
  return resolveGhostCollisions(next, previousPlayer, next.player.position, previousGhosts, now)
}

function stepMazeChaseState(state, options) {
  if (!options || typeof options !== 'object') {
    throw new ReplayValidationError('INVALID_MAZE_OPTIONS', 'Maze Chase step options are invalid')
  }
  assertSeed(options.seed)
  if (state.isGameOver) return clone(state)
  if (options.direction !== undefined) assertDirection(options.direction)

  const previousPlayer = copyPoint(state.player.position)
  const previousGhosts = new Map(state.ghosts.map((ghost) => [ghost.id, copyPoint(ghost.position)]))
  const now = safeElapsedMs(state) + state.tickMs
  // Keep immutable state semantics without serializing the entire maze and
  // pellet field every tick. Unchanged arrays are shared; every branch that
  // modifies one replaces it with a new array/object first.
  let next = reviveHiddenGhosts(state, now)
  if (options.direction !== undefined) next.player.pendingDirection = options.direction
  const desiredDirection = canMazeMove(next, next.player.position, next.player.pendingDirection)
    ? next.player.pendingDirection
    : next.player.direction
  const playerDirection = canMazeMove(next, next.player.position, desiredDirection) ? desiredDirection : 'none'
  const playerPosition = getNextPoint(next, next.player.position, playerDirection)
  next.player = { ...next.player, position: playerPosition, direction: playerDirection }

  if (next.pellets.some((cell) => cellsMatch(cell, playerPosition))) {
    next.pellets = withoutCell(next.pellets, playerPosition)
    next.score += 10
  }
  if (next.powerPellets.some((cell) => cellsMatch(cell, playerPosition))) {
    next.powerPellets = withoutCell(next.powerPellets, playerPosition)
    next.score += 50
    next.frightenedUntil = now + FRIGHTENED_MS
  }
  if (next.fruit?.active && !next.fruit.collected && cellsMatch(next.fruit.position, playerPosition)) {
    next.fruit = { ...next.fruit, active: false, collected: true }
    next.score += 100
  }

  next = resolveGhostCollisions(next, previousPlayer, next.player.position, previousGhosts, now)
  let ghostStepCounter = (Number.isSafeInteger(next.ghostStepCounter) ? next.ghostStepCounter : 0) + 5
  if (!next.isGameOver && ghostStepCounter >= 6) {
    ghostStepCounter -= 6
    next = moveGhosts(options.seed, next, now, previousPlayer)
  }
  next.ghostStepCounter = ghostStepCounter
  next.tick = safeStateTick(state) + 1
  next.elapsedMs = now
  next.hasStarted = true

  if (!next.isGameOver && next.pellets.length === 0 && next.powerPellets.length === 0) {
    next = resetMazeLevel(next)
  }
  return next
}

function replayMazeChase(seed, replay) {
  assertSeed(seed)
  validateReplay(replay)
  let state = createMazeChaseInitialState(seed)
  let inputIndex = 0
  for (let tick = 0; tick < replay.tickCount; tick += 1) {
    if (state.isGameOver) {
      throw new ReplayValidationError('REPLAY_AFTER_COMPLETION', 'Replay contains ticks after game over')
    }
    const input = replay.inputs[inputIndex]?.tick === tick ? replay.inputs[inputIndex++] : undefined
    state = stepMazeChaseState(state, { seed, direction: input?.direction })
  }
  return {
    state,
    score: state.score,
    completed: state.isGameOver,
    elapsedMs: state.elapsedMs,
  }
}

function safeStateTick(state) {
  return Number.isSafeInteger(state.tick) && state.tick >= 0 ? state.tick : 0
}

function safeElapsedMs(state) {
  return Number.isSafeInteger(state.elapsedMs) && state.elapsedMs >= 0 ? state.elapsedMs : 0
}

function distance(left, right) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y)
}

function copyPoint(point) {
  return { x: point.x, y: point.y }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

const engine = {
  GAME_ENGINE_VERSION,
  MAX_REPLAY_TICKS,
  MAX_REPLAY_INPUTS,
  REPLAY_SEED_PATTERN,
  ReplayValidationError,
  createSnakeInitialState,
  stepSnakeState,
  replaySnake,
  createMazeChaseInitialState,
  stepMazeChaseState,
  replayMazeChase,
}

export {
  GAME_ENGINE_VERSION,
  MAX_REPLAY_TICKS,
  MAX_REPLAY_INPUTS,
  REPLAY_SEED_PATTERN,
  ReplayValidationError,
  createSnakeInitialState,
  stepSnakeState,
  replaySnake,
  createMazeChaseInitialState,
  stepMazeChaseState,
  replayMazeChase,
}

export default engine
