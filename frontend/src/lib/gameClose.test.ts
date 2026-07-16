import { describe, expect, it } from 'vitest'
import { Game } from '../types/game'
import { canHostCloseGame, getCloseGamePrompt } from './gameClose'

function createGame(overrides: Partial<Game> = {}): Game {
  return {
    _id: 'game-1',
    gameType: 'ticTacToe',
    status: 'active',
    gameCode: 'ABCDEFGH',
    players: [
      { userId: 'host-1', username: 'Host', index: 0 },
      { userId: 'guest-1', username: 'Guest', index: 1 },
    ],
    currentTurnIndex: 0,
    gameState: {},
    moveHistory: [],
    createdAt: '2026-07-15T12:00:00.000Z',
    lastMoveAt: '2026-07-15T12:00:00.000Z',
    metadata: { mode: 'multiplayer' },
    ...overrides,
  }
}

describe('host close permission', () => {
  it('allows the first player to close an active game', () => {
    expect(canHostCloseGame(createGame(), 'host-1')).toBe(true)
  })

  it('does not allow another participant or a nonparticipant to close it', () => {
    const game = createGame()

    expect(canHostCloseGame(game, 'guest-1')).toBe(false)
    expect(canHostCloseGame(game, 'stranger-1')).toBe(false)
  })

  it.each(['paused', 'completed', 'abandoned'] as const)('does not allow an active host to close a %s game', (status) => {
    expect(canHostCloseGame(createGame({ status }), 'host-1')).toBe(false)
  })

  it('allows the sole host to close an active solo game', () => {
    const game = createGame({
      players: [{ userId: 'host-1', username: 'Host', index: 0 }],
      metadata: { mode: 'singlePlayer' },
    })

    expect(canHostCloseGame(game, 'host-1')).toBe(true)
  })

  it('fails closed when the current user or host is unavailable', () => {
    expect(canHostCloseGame(createGame(), undefined)).toBe(false)
    expect(canHostCloseGame(createGame({ players: [] }), 'host-1')).toBe(false)
  })
})

describe('close confirmation copy', () => {
  it('warns that closing a started multiplayer game affects everyone and records no result or stats', () => {
    expect(getCloseGamePrompt(createGame())).toEqual({
      title: 'Close this game for everyone?',
      message: 'This will end the Tic Tac Toe game for everyone and record it as abandoned. No result or player statistics will be recorded.',
    })
  })

  it('uses the waiting-room wording when only the host has joined', () => {
    const game = createGame({
      players: [{ userId: 'host-1', username: 'Host', index: 0 }],
    })

    expect(getCloseGamePrompt(game)).toEqual({
      title: 'Close this game?',
      message: 'This will close the Tic Tac Toe room and remove it from your active games list. Other players will no longer be able to join or continue it.',
    })
  })

  it('keeps the solo-game wording even when the game has one player', () => {
    const game = createGame({
      players: [{ userId: 'host-1', username: 'Host', index: 0 }],
      metadata: { mode: 'singlePlayer' },
    })

    expect(getCloseGamePrompt(game)).toEqual({
      title: 'Close this solo game?',
      message: 'This will close the active solo match and remove it from your Single Player active games list.',
    })
  })

  it('treats a legacy game without mode metadata as multiplayer', () => {
    const game = createGame({ metadata: undefined })

    expect(getCloseGamePrompt(game).title).toBe('Close this game for everyone?')
  })
})
