import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceMazeState, canMove, getGhostTickMs, getNextPoint, getPlayerSprite, getWallConnections, getWallTileKey, nextGhostState, nextMazeState } from './MazeChaseGame'

function readPngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(fileURLToPath(new URL(path, import.meta.url)))
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  }
}

function createState(overrides: Record<string, unknown> = {}): any {
  const baseGhost = {
    color: '#22d3ee',
    start: { x: 3, y: 3 },
    direction: 'none',
    mode: 'chase',
  }

  return {
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
      { ...baseGhost, id: 'spark', position: { x: 3, y: 1 }, start: { x: 3, y: 1 }, direction: 'left' },
      { ...baseGhost, id: 'rose', color: '#fb7185', position: { x: 1, y: 3 }, start: { x: 1, y: 3 } },
      { ...baseGhost, id: 'lime', color: '#4ade80', position: { x: 2, y: 3 }, start: { x: 2, y: 3 } },
      { ...baseGhost, id: 'ember', color: '#f97316', position: { x: 3, y: 3 }, start: { x: 3, y: 3 } },
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
    ...overrides,
  }
}

describe('nextMazeState ghost collisions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('eats a frightened ghost when both actors end on the same cell', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const state = createState({
      frightenedUntil: 5000,
      ghosts: [
        { id: 'spark', color: '#22d3ee', position: { x: 2, y: 1 }, start: { x: 3, y: 1 }, direction: 'left', mode: 'frightened' },
        { id: 'rose', color: '#fb7185', position: { x: 4, y: 4 }, start: { x: 4, y: 4 }, direction: 'none', mode: 'frightened' },
        { id: 'lime', color: '#4ade80', position: { x: 4, y: 3 }, start: { x: 4, y: 3 }, direction: 'none', mode: 'frightened' },
        { id: 'ember', color: '#f97316', position: { x: 3, y: 4 }, start: { x: 3, y: 4 }, direction: 'none', mode: 'frightened' },
      ],
    })

    const next = nextMazeState(state)

    expect(next.score).toBe(200)
    expect(next.lives).toBe(3)
    expect(next.ghosts[0].mode).toBe('hidden')
    expect(next.ghosts[0].respawnAt).toBe(4000)
  })

  it('eats a frightened ghost when player and ghost swap cells', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const state = createState({
      frightenedUntil: 5000,
      ghosts: [
        { id: 'spark', color: '#22d3ee', position: { x: 2, y: 1 }, start: { x: 3, y: 1 }, direction: 'left', mode: 'frightened' },
        { id: 'rose', color: '#fb7185', position: { x: 4, y: 4 }, start: { x: 4, y: 4 }, direction: 'none', mode: 'frightened' },
        { id: 'lime', color: '#4ade80', position: { x: 4, y: 3 }, start: { x: 4, y: 3 }, direction: 'none', mode: 'frightened' },
        { id: 'ember', color: '#f97316', position: { x: 3, y: 4 }, start: { x: 3, y: 4 }, direction: 'none', mode: 'frightened' },
      ],
    })

    const next = nextGhostState({
      ...state,
      player: { ...state.player, position: { x: 2, y: 1 } },
    }, { x: 1, y: 1 })

    expect(next.score).toBe(200)
    expect(next.lives).toBe(3)
    expect(next.ghosts[0].mode).toBe('hidden')
    expect(next.ghosts[0].respawnAt).toBe(4000)
  })

  it('costs one life for same-cell and swap normal ghost collisions', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const sameCell = nextMazeState(createState({
      ghosts: [
        { id: 'spark', color: '#22d3ee', position: { x: 2, y: 1 }, start: { x: 3, y: 1 }, direction: 'left', mode: 'chase' },
        { id: 'rose', color: '#fb7185', position: { x: 4, y: 4 }, start: { x: 4, y: 4 }, direction: 'none', mode: 'chase' },
        { id: 'lime', color: '#4ade80', position: { x: 4, y: 3 }, start: { x: 4, y: 3 }, direction: 'none', mode: 'chase' },
        { id: 'ember', color: '#f97316', position: { x: 3, y: 4 }, start: { x: 3, y: 4 }, direction: 'none', mode: 'chase' },
      ],
    }))
    const swapState = createState({
      ghosts: [
        { id: 'spark', color: '#22d3ee', position: { x: 2, y: 1 }, start: { x: 3, y: 1 }, direction: 'left', mode: 'chase' },
        { id: 'rose', color: '#fb7185', position: { x: 4, y: 4 }, start: { x: 4, y: 4 }, direction: 'none', mode: 'chase' },
        { id: 'lime', color: '#4ade80', position: { x: 4, y: 3 }, start: { x: 4, y: 3 }, direction: 'none', mode: 'chase' },
        { id: 'ember', color: '#f97316', position: { x: 3, y: 4 }, start: { x: 3, y: 4 }, direction: 'none', mode: 'chase' },
      ],
    })
    const swap = nextGhostState({
      ...swapState,
      player: { ...swapState.player, position: { x: 2, y: 1 } },
    }, { x: 1, y: 1 })

    expect(sameCell.lives).toBe(2)
    expect(swap.lives).toBe(2)
  })

  it('applies a power pellet before resolving a same-tick ghost collision', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const state = createState({
      powerPellets: [{ x: 2, y: 1 }],
      ghosts: [
        { id: 'spark', color: '#22d3ee', position: { x: 2, y: 1 }, start: { x: 3, y: 1 }, direction: 'left', mode: 'chase' },
        { id: 'rose', color: '#fb7185', position: { x: 4, y: 4 }, start: { x: 4, y: 4 }, direction: 'none', mode: 'chase' },
        { id: 'lime', color: '#4ade80', position: { x: 4, y: 3 }, start: { x: 4, y: 3 }, direction: 'none', mode: 'chase' },
        { id: 'ember', color: '#f97316', position: { x: 3, y: 4 }, start: { x: 3, y: 4 }, direction: 'none', mode: 'chase' },
      ],
    })

    const next = nextMazeState(state)

    expect(next.lives).toBe(3)
    expect(next.score).toBe(250)
    expect(next.frightenedUntil).toBe(8000)
    expect(next.ghosts[0].mode).toBe('hidden')
  })

  it('resolves only one harmful collision per tick', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const state = createState({
      ghosts: [
        { id: 'spark', color: '#22d3ee', position: { x: 2, y: 1 }, start: { x: 3, y: 1 }, direction: 'left', mode: 'chase' },
        { id: 'rose', color: '#fb7185', position: { x: 2, y: 1 }, start: { x: 3, y: 1 }, direction: 'left', mode: 'chase' },
        { id: 'lime', color: '#4ade80', position: { x: 4, y: 3 }, start: { x: 4, y: 3 }, direction: 'none', mode: 'chase' },
        { id: 'ember', color: '#f97316', position: { x: 3, y: 4 }, start: { x: 3, y: 4 }, direction: 'none', mode: 'chase' },
      ],
    })

    const next = nextMazeState(state)

    expect(next.lives).toBe(2)
  })

  it('does not cost a life when a normal ghost is behind without sharing or swapping cells', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const state = createState({
      player: {
        position: { x: 2, y: 1 },
        start: { x: 1, y: 1 },
        direction: 'right',
        pendingDirection: 'right',
      },
      ghosts: [
        { id: 'spark', color: '#22d3ee', position: { x: 1, y: 1 }, start: { x: 3, y: 1 }, direction: 'none', mode: 'chase' },
        { id: 'rose', color: '#fb7185', position: { x: 1, y: 3 }, start: { x: 1, y: 3 }, direction: 'none', mode: 'chase' },
        { id: 'lime', color: '#4ade80', position: { x: 2, y: 3 }, start: { x: 2, y: 3 }, direction: 'none', mode: 'chase' },
        { id: 'ember', color: '#f97316', position: { x: 3, y: 3 }, start: { x: 3, y: 3 }, direction: 'none', mode: 'chase' },
      ],
    })

    const next = nextMazeState(state)

    expect(next.lives).toBe(3)
  })

  it('ignores hidden ghosts for collisions and respawns them at center after three seconds', () => {
    vi.spyOn(Date, 'now').mockReturnValue(3000)
    const hidden = createState({
      ghosts: [
        { id: 'spark', color: '#22d3ee', position: { x: 2, y: 1 }, start: { x: 3, y: 1 }, direction: 'none', mode: 'hidden', respawnAt: 4000 },
        { id: 'rose', color: '#fb7185', position: { x: 1, y: 3 }, start: { x: 1, y: 3 }, direction: 'none', mode: 'chase' },
        { id: 'lime', color: '#4ade80', position: { x: 2, y: 3 }, start: { x: 2, y: 3 }, direction: 'none', mode: 'chase' },
        { id: 'ember', color: '#f97316', position: { x: 3, y: 3 }, start: { x: 3, y: 3 }, direction: 'none', mode: 'chase' },
      ],
    })

    const stillHidden = nextMazeState(hidden)
    expect(stillHidden.lives).toBe(3)
    expect(stillHidden.ghosts[0].mode).toBe('hidden')

    vi.spyOn(Date, 'now').mockReturnValue(4000)
    const respawned = nextMazeState(stillHidden)
    expect(respawned.ghosts[0].mode).toBe('chase')
    expect(respawned.ghosts[0].position).toEqual({ x: 3, y: 1 })
  })

  it('uses a slower ghost cadence without skipped ghost logic ticks', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const state = createState({
      width: 7,
      height: 5,
      maze: ['#######', '#     #', '#######', '#     #', '#######'],
      player: {
        position: { x: 1, y: 1 },
        start: { x: 1, y: 1 },
        direction: 'right',
        pendingDirection: 'right',
      },
      ghosts: [
        { id: 'spark', color: '#22d3ee', position: { x: 5, y: 3 }, start: { x: 5, y: 3 }, direction: 'left', mode: 'chase' },
        { id: 'rose', color: '#fb7185', position: { x: 1, y: 3 }, start: { x: 1, y: 3 }, direction: 'none', mode: 'chase' },
        { id: 'lime', color: '#4ade80', position: { x: 2, y: 3 }, start: { x: 2, y: 3 }, direction: 'none', mode: 'chase' },
        { id: 'ember', color: '#f97316', position: { x: 3, y: 3 }, start: { x: 3, y: 3 }, direction: 'none', mode: 'chase' },
      ],
    })

    const playerNext = advanceMazeState(state, 1)
    const ghostNext = nextGhostState(state)

    expect(getGhostTickMs(state.tickMs)).toBe(180)
    expect(playerNext.player.position.x).toBe(2)
    expect(ghostNext.ghosts[0].position.x).toBe(4)
    expect(ghostNext.ghostStepCounter).toBe(0)
  })

  it('prevents visible ghosts from choosing overlapping next cells', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const state = createState({
      width: 7,
      height: 5,
      maze: ['#######', '#     #', '#######', '#     #', '#######'],
      player: {
        position: { x: 3, y: 1 },
        start: { x: 1, y: 1 },
        direction: 'right',
        pendingDirection: 'right',
      },
      ghosts: [
        { id: 'spark', color: '#22d3ee', position: { x: 1, y: 1 }, start: { x: 1, y: 1 }, direction: 'right', mode: 'chase' },
        { id: 'rose', color: '#fb7185', position: { x: 3, y: 1 }, start: { x: 3, y: 1 }, direction: 'left', mode: 'chase' },
        { id: 'lime', color: '#4ade80', position: { x: 1, y: 3 }, start: { x: 1, y: 3 }, direction: 'none', mode: 'hidden', respawnAt: 5000 },
        { id: 'ember', color: '#f97316', position: { x: 5, y: 3 }, start: { x: 5, y: 3 }, direction: 'left', mode: 'chase' },
      ],
    })

    const next = nextGhostState(state)
    const visibleCells = next.ghosts.filter((ghost) => ghost.mode !== 'hidden').map((ghost) => `${ghost.position.x}:${ghost.position.y}`)

    expect(new Set(visibleCells).size).toBe(visibleCells.length)
  })
})

describe('Maze Chase movement and rendering helpers', () => {
  it('wraps horizontally through open edge tunnels', () => {
    const state = createState({ maze: ['     ', '     ', '     ', '     ', '     '] })

    expect(getNextPoint(state, { x: 0, y: 1 }, 'left')).toEqual({ x: 4, y: 1 })
    expect(getNextPoint(state, { x: 4, y: 1 }, 'right')).toEqual({ x: 0, y: 1 })
    expect(canMove(state, { x: 0, y: 1 }, 'left')).toBe(true)
    expect(canMove(state, { x: 4, y: 1 }, 'right')).toBe(true)
  })

  it('blocks horizontal wraps when the destination edge is a wall', () => {
    const state = createState({ maze: ['#####', '#   #', '#####', '#   #', '#####'] })

    expect(getNextPoint(state, { x: 1, y: 1 }, 'left')).toEqual({ x: 0, y: 1 })
    expect(canMove(state, { x: 1, y: 1 }, 'left')).toBe(false)
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

  it('classifies wall connections from neighboring wall cells', () => {
    const maze = [
      ' ### ',
      ' ### ',
      '#####',
      '  #  ',
      '     ',
    ]

    expect(getWallConnections(maze, 2, 2)).toEqual({ up: true, down: true, left: true, right: true })
    expect(getWallConnections(maze, 1, 0)).toEqual({ up: false, down: true, left: false, right: true })
    expect(getWallConnections(maze, 4, 2)).toEqual({ up: false, down: false, left: true, right: false })
  })

  it('maps wall connections to deterministic tile sprites', () => {
    const maze = [
      '  #  ',
      '  #  ',
      '#####',
      '  #  ',
      '     ',
    ]

    expect(getWallTileKey(['###'], 1, 0)).toBe('horizontal')
    expect(getWallTileKey(['#', '#', '#'], 0, 1)).toBe('vertical')
    expect(getWallTileKey(['##', ' #'], 1, 0)).toBe('corner-sw')
    expect(getWallTileKey(['##', '# '], 0, 0)).toBe('corner-se')
    expect(getWallTileKey(['# ', '##'], 0, 1)).toBe('corner-ne')
    expect(getWallTileKey([' #', '##'], 1, 1)).toBe('corner-nw')
    expect(getWallTileKey(['##', '# '], 0, 0)).toBe('corner-se')
    expect(getWallTileKey(maze, 2, 2)).toBe('cross')
    expect(getWallTileKey(maze, 0, 2)).toBe('end-right')
    expect(getWallTileKey(['#'], 0, 0)).toBe('block')
  })
})
