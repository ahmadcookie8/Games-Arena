import { beforeEach, describe, expect, it } from 'vitest'
import type { Game } from '../types/game'
import { useGameStore } from './useGameState'

function makeGame(id = 'game-a', revision = 1): Game {
  return {
    _id: id,
    revision,
    gameType: 'ticTacToe',
    status: 'active',
    gameCode: 'ABCDEFGH',
    players: [{ userId: 'user-a', username: 'A', index: 0, isConnected: true }],
    currentTurnIndex: 0,
    gameState: {},
    moveHistory: [],
    chatMessages: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    lastMoveAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('multiplayer game state store', () => {
  beforeEach(() => {
    useGameStore.setState({ activeGameId: null, currentGame: null, isMyTurn: false })
  })

  it('applies only newer snapshots for the current route', () => {
    const store = useGameStore.getState()
    store.activateGame('game-a')
    expect(store.applyGameSnapshot({ gameId: 'game-a', revision: 2, game: makeGame('game-a', 2) }, 'game-a')).toBe(true)
    expect(store.applyGameSnapshot({ gameId: 'game-a', revision: 1, game: makeGame('game-a', 1) }, 'game-a')).toBe(false)
    expect(store.applyGameSnapshot({ gameId: 'game-b', revision: 3, game: makeGame('game-b', 3) }, 'game-a')).toBe(false)
    expect(useGameStore.getState().currentGame?.revision).toBe(2)
  })

  it('applies route-filtered chat and presence deltas without changing revision', () => {
    useGameStore.getState().activateGame('game-a')
    useGameStore.getState().setGame(makeGame('game-a', 7))
    const store = useGameStore.getState()

    store.updatePlayerPresence('game-b', 'user-a', false)
    store.appendChatMessage('game-b', {
      messageId: 'foreign', userId: 'user-a', username: 'A', text: 'foreign', timestamp: '2026-01-01T00:00:00.000Z',
    })
    expect(useGameStore.getState().currentGame?.players[0].isConnected).toBe(true)
    expect(useGameStore.getState().currentGame?.chatMessages).toEqual([])

    store.updatePlayerPresence('game-a', 'user-a', false)
    store.appendChatMessage('game-a', {
      messageId: 'local', userId: 'user-a', username: 'A', text: 'hello', timestamp: '2026-01-01T00:00:00.000Z',
    })
    expect(useGameStore.getState().currentGame?.players[0].isConnected).toBe(false)
    expect(useGameStore.getState().currentGame?.chatMessages?.map((message) => message.messageId)).toEqual(['local'])
    expect(useGameStore.getState().currentGame?.revision).toBe(7)
  })

  it('keeps received chat and presence deltas when a gameplay snapshot arrives', () => {
    const current = makeGame('game-a', 7)
    current.players[0].isConnected = false
    current.chatMessages = [{
      messageId: 'delta', userId: 'user-a', username: 'A', text: 'delta', timestamp: '2026-01-01T00:00:02.000Z',
    }]
    useGameStore.getState().activateGame('game-a')
    useGameStore.getState().setGame(current)
    const incoming = makeGame('game-a', 7)
    incoming.chatMessages = [{
      messageId: 'server', userId: 'user-a', username: 'A', text: 'server', timestamp: '2026-01-01T00:00:01.000Z',
    }]

    expect(useGameStore.getState().applyGameSnapshot({ gameId: 'game-a', revision: 7, game: incoming }, 'game-a', true, true)).toBe(true)
    expect(useGameStore.getState().currentGame?.chatMessages?.map((message) => message.messageId)).toEqual(['server', 'delta'])
    expect(useGameStore.getState().currentGame?.players[0].isConnected).toBe(false)
  })

  it('lets an authoritative equal-revision snapshot repair missed presence deltas', () => {
    const stale = makeGame('game-a', 7)
    stale.players[0].isConnected = false
    useGameStore.getState().activateGame('game-a')
    useGameStore.getState().setGame(stale)

    const authoritative = makeGame('game-a', 7)
    expect(useGameStore.getState().applyGameSnapshot(
      { gameId: 'game-a', revision: 7, game: authoritative },
      'game-a',
      true,
    )).toBe(true)
    expect(useGameStore.getState().currentGame?.players[0].isConnected).toBe(true)
  })

  it('rejects a late acknowledgement from a route that is no longer active', () => {
    const store = useGameStore.getState()
    store.activateGame('game-a')
    expect(store.applyGameSnapshot({ gameId: 'game-a', revision: 2, game: makeGame('game-a', 2) }, 'game-a')).toBe(true)

    store.activateGame('game-b')
    expect(store.applyGameSnapshot({ gameId: 'game-b', revision: 1, game: makeGame('game-b', 1) }, 'game-b')).toBe(true)
    expect(store.applyGameSnapshot({ gameId: 'game-a', revision: 3, game: makeGame('game-a', 3) }, 'game-a', true, true)).toBe(false)
    expect(useGameStore.getState().currentGame?._id).toBe('game-b')
  })
})
