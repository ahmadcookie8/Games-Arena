import { describe, expect, it } from 'vitest'
import type { Game } from '../types/game'
import { parseGameStateEnvelope, shouldApplyGameSnapshot } from './gameStateEvents'

function makeGame(id = 'game-a', revision?: number): Game {
  return {
    _id: id,
    ...(revision === undefined ? {} : { revision }),
    gameType: 'ticTacToe',
    status: 'active',
    gameCode: 'ABC12345',
    players: [],
    currentTurnIndex: 0,
    gameState: {},
    moveHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    lastMoveAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('game state event compatibility', () => {
  it('normalizes canonical, legacy wrapped, and direct game payloads', () => {
    const game = makeGame('game-a', 4)
    expect(parseGameStateEnvelope({ gameId: 'game-a', revision: 4, game })).toEqual({ gameId: 'game-a', revision: 4, game })
    expect(parseGameStateEnvelope({ game })).toEqual({ gameId: 'game-a', revision: 4, game })
    expect(parseGameStateEnvelope(game)).toEqual({ gameId: 'game-a', revision: 4, game })
  })

  it('rejects mismatched and malformed envelopes', () => {
    const game = makeGame('game-a', 4)
    expect(parseGameStateEnvelope({ gameId: 'game-b', revision: 4, game })).toBeNull()
    expect(parseGameStateEnvelope({ gameId: 'game-a', revision: 3, game })).toBeNull()
    expect(parseGameStateEnvelope({ gameId: 'game-a' })).toBeNull()
  })

  it('filters foreign, stale, duplicate, and legacy-after-versioned snapshots', () => {
    const current = makeGame('game-a', 5)
    expect(shouldApplyGameSnapshot(current, { gameId: 'game-b', revision: 6, game: makeGame('game-b', 6) }, 'game-a')).toBe(false)
    expect(shouldApplyGameSnapshot(current, { gameId: 'game-a', revision: 4, game: makeGame('game-a', 4) }, 'game-a')).toBe(false)
    expect(shouldApplyGameSnapshot(current, { gameId: 'game-a', revision: 5, game: makeGame('game-a', 5) }, 'game-a')).toBe(false)
    expect(shouldApplyGameSnapshot(current, { gameId: 'game-a', game: makeGame('game-a') }, 'game-a')).toBe(false)
    expect(shouldApplyGameSnapshot(current, { gameId: 'game-a', revision: 6, game: makeGame('game-a', 6) }, 'game-a')).toBe(true)
  })

  it('lets an authoritative refetch replace an equal revision', () => {
    const current = makeGame('game-a', 5)
    const equal = { gameId: 'game-a', revision: 5, game: makeGame('game-a', 5) }
    expect(shouldApplyGameSnapshot(current, equal, 'game-a', true)).toBe(true)
  })
})
