import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  createMazeChaseInitialState,
  createSnakeInitialState,
  replayMazeChase,
  replaySnake,
  stepMazeChaseState,
  stepSnakeState,
  type Direction,
  type MazeChaseState,
  type ReplayV1,
} from '@games-arena/game-engine'
import {
  canMove,
  getGhostTickMs,
  getNextPoint,
  getPlayerSprite,
  getWallConnections,
  getWallTileKey,
  normalizeLegacyMazeState,
} from './MazeChaseGame'

const SEED = 'b'.repeat(64)

function readPngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(fileURLToPath(new URL(path, import.meta.url)))
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  }
}

function createCollisionState(overrides: Partial<MazeChaseState> = {}): MazeChaseState {
  const hiddenUntilLater = 99_999
  const base: MazeChaseState = {
    width: 5,
    height: 5,
    maze: ['#####', '#   #', '#####', '#   #', '#####'],
    player: {
      position: { x: 1, y: 1 },
      start: { x: 1, y: 1 },
      direction: 'right',
      pendingDirection: 'right',
    },
    ghosts: [
      { id: 'spark', color: '#22d3ee', position: { x: 2, y: 1 }, start: { x: 3, y: 1 }, direction: 'left', mode: 'chase' },
      { id: 'rose', color: '#fb7185', position: { x: 1, y: 3 }, start: { x: 1, y: 3 }, direction: 'none', mode: 'hidden', respawnAt: hiddenUntilLater },
      { id: 'lime', color: '#4ade80', position: { x: 2, y: 3 }, start: { x: 2, y: 3 }, direction: 'none', mode: 'hidden', respawnAt: hiddenUntilLater },
      { id: 'ember', color: '#f97316', position: { x: 3, y: 3 }, start: { x: 3, y: 3 }, direction: 'none', mode: 'hidden', respawnAt: hiddenUntilLater },
    ],
    pellets: [{ x: 1, y: 3 }],
    powerPellets: [],
    fruit: null,
    score: 0,
    lives: 3,
    level: 1,
    frightenedUntil: 0,
    isGameOver: false,
    hasStarted: true,
    tickMs: 150,
    ghostStepCounter: 0,
    tick: 0,
    elapsedMs: 1_000,
  }
  return { ...base, ...overrides }
}

describe('shared deterministic single-player engines', () => {
  it('reproduces the exact Snake terminal state from a bounded replay', () => {
    let liveState = createSnakeInitialState(SEED, 'medium')
    for (let tick = 0; tick < 9; tick += 1) {
      liveState = stepSnakeState(liveState, { seed: SEED, wallLooping: false })
    }

    const replay = replaySnake(SEED, { boardSize: 'medium', wallLooping: false }, {
      version: 1,
      tickCount: 9,
      inputs: [],
    })

    expect(liveState.isGameOver).toBe(true)
    expect(replay.completed).toBe(true)
    expect(replay.state).toEqual(liveState)
  })

  it('uses the same logical clock and canonical direction events for Maze Chase', () => {
    const inputs = [
      { tick: 0, direction: 'left' },
      { tick: 4, direction: 'up' },
      { tick: 8, direction: 'right' },
    ] as const
    const replay: ReplayV1 = { version: 1, tickCount: 12, inputs: [...inputs] }
    let liveState = createMazeChaseInitialState(SEED)

    for (let tick = 0; tick < replay.tickCount; tick += 1) {
      const direction = inputs.find((input) => input.tick === tick)?.direction as Direction | undefined
      liveState = stepMazeChaseState(liveState, { seed: SEED, direction })
    }

    const reproduced = replayMazeChase(SEED, replay)
    expect(reproduced.state).toEqual(liveState)
    expect(reproduced.elapsedMs).toBe(liveState.elapsedMs)
    expect(liveState.tick).toBe(12)
  })

  it('eats a frightened ghost on same-cell and head-on crossing attempts', () => {
    const sameCell = createCollisionState({
      frightenedUntil: 5_000,
      ghosts: createCollisionState().ghosts.map((ghost, index) => index === 0 ? { ...ghost, mode: 'frightened' } : ghost),
    })
    const crossing = createCollisionState({
      frightenedUntil: 5_000,
      ghostStepCounter: 1,
      ghosts: createCollisionState().ghosts.map((ghost, index) => index === 0 ? { ...ghost, mode: 'frightened', direction: 'left' } : ghost),
    })

    for (const state of [sameCell, crossing]) {
      const next = stepMazeChaseState(state, { seed: SEED, direction: 'right' })
      expect(next.score).toBe(200)
      expect(next.lives).toBe(3)
      expect(next.ghosts[0].mode).toBe('hidden')
      expect(next.ghosts[0].respawnAt).toBe(4_150)
    }
  })

  it('applies a power pellet before resolving a same-tick ghost collision', () => {
    const state = createCollisionState({ powerPellets: [{ x: 2, y: 1 }] })
    const next = stepMazeChaseState(state, { seed: SEED, direction: 'right' })

    expect(next.lives).toBe(3)
    expect(next.score).toBe(250)
    expect(next.frightenedUntil).toBe(8_150)
    expect(next.ghosts[0].mode).toBe('hidden')
  })

  it('costs one life for a normal collision and never applies duplicate harmful damage', () => {
    const base = createCollisionState()
    const state = {
      ...base,
      ghosts: [
        base.ghosts[0],
        { ...base.ghosts[1], position: { x: 2, y: 1 }, start: { x: 1, y: 3 }, mode: 'chase' as const, respawnAt: undefined },
        ...base.ghosts.slice(2),
      ],
    }
    const next = stepMazeChaseState(state, { seed: SEED, direction: 'right' })

    expect(next.lives).toBe(2)
    expect(next.isGameOver).toBe(false)
    expect(next.player.position).toEqual(next.player.start)
  })

  it('ignores a hidden ghost until its logical respawn deadline', () => {
    const base = createCollisionState()
    const hiddenGhost = { ...base.ghosts[0], position: { x: 3, y: 1 }, mode: 'hidden' as const, respawnAt: 1_200 }
    const hidden = createCollisionState({ ghosts: [hiddenGhost, ...base.ghosts.slice(1)] })
    const stillHidden = stepMazeChaseState(hidden, { seed: SEED, direction: 'right' })
    expect(stillHidden.ghosts[0].mode).toBe('hidden')

    const ready = { ...stillHidden, elapsedMs: 1_200, ghostStepCounter: 0, player: { ...stillHidden.player, position: { x: 1, y: 1 } } }
    const respawned = stepMazeChaseState(ready, { seed: SEED, direction: 'right' })
    expect(respawned.ghosts[0].mode).toBe('chase')
    expect(respawned.ghosts[0].position).toEqual(respawned.ghosts[0].start)
  })

  it('keeps visible ghosts from choosing the same reserved destination cell', () => {
    const state = createMazeChaseInitialState(SEED)
    const corridor: MazeChaseState = {
      ...state,
      width: 7,
      height: 5,
      maze: ['#######', '#     #', '#######', '#     #', '#######'],
      player: { ...state.player, position: { x: 3, y: 3 }, start: { x: 3, y: 3 }, direction: 'none', pendingDirection: 'none' },
      ghosts: [
        { ...state.ghosts[0], position: { x: 1, y: 1 }, start: { x: 1, y: 1 }, direction: 'right', mode: 'chase' },
        { ...state.ghosts[1], position: { x: 3, y: 1 }, start: { x: 3, y: 1 }, direction: 'left', mode: 'chase' },
        { ...state.ghosts[2], position: { x: 1, y: 3 }, start: { x: 1, y: 3 }, mode: 'hidden', respawnAt: 99_999 },
        { ...state.ghosts[3], position: { x: 5, y: 1 }, start: { x: 5, y: 1 }, direction: 'left', mode: 'chase' },
      ],
      pellets: [{ x: 5, y: 3 }],
      powerPellets: [],
      fruit: null,
      ghostStepCounter: 1,
      tick: 0,
      elapsedMs: 0,
    }

    const next = stepMazeChaseState(corridor, { seed: SEED })
    const visibleCells = next.ghosts
      .filter((ghost) => ghost.mode !== 'hidden')
      .map((ghost) => `${ghost.position.x}:${ghost.position.y}`)
    expect(new Set(visibleCells).size).toBe(visibleCells.length)
  })
})

describe('Maze Chase rendering helpers', () => {
  it('wraps horizontally through open edge tunnels', () => {
    const state = createMazeChaseInitialState(SEED)

    expect(getNextPoint(state, { x: 0, y: 9 }, 'left')).toEqual({ x: 20, y: 9 })
    expect(getNextPoint(state, { x: 20, y: 9 }, 'right')).toEqual({ x: 0, y: 9 })
    expect(canMove(state, { x: 0, y: 9 }, 'left')).toBe(true)
    expect(canMove(state, { x: 20, y: 9 }, 'right')).toBe(true)
  })

  it('blocks movement into a wall and retains the slower ghost animation cadence', () => {
    const state = createMazeChaseInitialState(SEED)

    expect(canMove(state, { x: 1, y: 1 }, 'up')).toBe(false)
    expect(getGhostTickMs(state.tickMs)).toBe(180)
  })

  it('converts legacy wall-clock deadlines for continued unranked play', () => {
    const state = createMazeChaseInitialState(SEED)
    const legacy = {
      ...state,
      tick: undefined,
      elapsedMs: undefined,
      frightenedUntil: 15_000,
      ghosts: state.ghosts.map((ghost, index) => index === 0 ? { ...ghost, respawnAt: 13_000 } : ghost),
    } as unknown as typeof state

    const normalized = normalizeLegacyMazeState(legacy, 10_000)
    expect(normalized.tick).toBe(0)
    expect(normalized.elapsedMs).toBe(0)
    expect(normalized.frightenedUntil).toBe(5_000)
    expect(normalized.ghosts[0].respawnAt).toBe(3_000)
  })

  it('uses closed mouth only as a directional chomp frame', () => {
    const open = getPlayerSprite('right', false)
    const closed = getPlayerSprite('right', true)
    const idle = getPlayerSprite('none', false)
    const left = getPlayerSprite('left', false)
    const leftClosed = getPlayerSprite('left', true)

    expect(closed.src).not.toBe(open.src)
    expect(idle.src).toBe(open.src)
    expect(left.src).toBe(open.src)
    expect(left.transform).toBe('scaleX(-1)')
    expect(leftClosed.transform).toBe(left.transform)
  })

  it('keeps the open and closed player frames on the same canvas', () => {
    const open = readPngSize('../assets/maze-chase/player-right.png')
    const closed = readPngSize('../assets/maze-chase/player-closed.png')

    expect(closed).toEqual(open)
  })

  it('classifies wall connections and deterministic tile sprites', () => {
    const maze = [
      '  #  ',
      '  #  ',
      '#####',
      '  #  ',
      '     ',
    ]

    expect(getWallConnections(maze, 2, 2)).toEqual({ up: true, down: true, left: true, right: true })
    expect(getWallTileKey(['###'], 1, 0)).toBe('horizontal')
    expect(getWallTileKey(['#', '#', '#'], 0, 1)).toBe('vertical')
    expect(getWallTileKey(['##', ' #'], 1, 0)).toBe('corner-sw')
    expect(getWallTileKey(maze, 2, 2)).toBe('cross')
    expect(getWallTileKey(maze, 0, 2)).toBe('end-right')
    expect(getWallTileKey(['#'], 0, 0)).toBe('block')
  })
})
