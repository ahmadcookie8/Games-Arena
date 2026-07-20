import { Server } from 'socket.io'
import { IGameDocument } from '../models/Game'
import {
  createGameStateEnvelope,
  disconnectUserSockets,
  emitChatMessage,
  emitGameReplayCreated,
  emitGameOver,
  emitGameUpdated,
  emitGamesChanged,
  emitMoveMade,
  emitPlayerPresenceChanged,
  releaseActiveGameConnectionLeases,
  setSocketServer,
} from './socketNotifier'
import { activeGameConnectionLeases } from './activeGameConnectionLeases'

type Emission = { room: string; event: string; payload: unknown }

function scrabbleGame(): IGameDocument {
  return {
    _id: 'game-1',
    __v: 7,
    gameType: 'scrabble',
    status: 'active',
    gameCode: 'ABCDEFGH',
    players: [
      { userId: 'user-1', username: 'alice', index: 0, isConnected: true },
      { userId: 'user-2', username: 'bob', index: 1, isConnected: true },
    ],
    currentTurnIndex: 0,
    currentTurn: 'user-1',
    gameState: {
      board: [],
      racks: {
        'user-1': [{ id: 'tile-a', letter: 'A', value: 1 }],
        'user-2': [{ id: 'tile-b', letter: 'B', value: 3 }],
      },
      bag: [{ id: 'tile-c', letter: 'C', value: 3 }],
      scores: { 'user-1': 0, 'user-2': 0 },
    },
    moveHistory: [],
    chatMessages: [],
    metadata: { ratedGame: false, mode: 'multiplayer' },
  } as unknown as IGameDocument
}

describe('socket notifier reliability contract', () => {
  let emissions: Emission[]
  let to: jest.Mock
  let inRoom: jest.Mock
  let disconnectSockets: jest.Mock

  beforeEach(() => {
    emissions = []
    to = jest.fn((room: string) => ({
      emit: (event: string, payload?: unknown) => emissions.push({ room, event, payload }),
    }))
    disconnectSockets = jest.fn()
    inRoom = jest.fn(() => ({ disconnectSockets }))
    setSocketServer({ to, in: inRoom } as unknown as Server)
  })

  it('builds revisioned full-state envelopes and keeps hidden state personalized', () => {
    const game = scrabbleGame()

    expect(createGameStateEnvelope(game, 'user-1')).toEqual(expect.objectContaining({
      gameId: 'game-1',
      revision: 7,
      game: expect.objectContaining({ _id: 'game-1', revision: 7 }),
    }))

    emitGameUpdated(game)

    expect(emissions).toHaveLength(2)
    expect(emissions.map(({ room }) => room)).toEqual([
      'game:game-1:user:user-1',
      'game:game-1:user:user-2',
    ])
    for (const emission of emissions) {
      expect(emission.event).toBe('gameUpdated')
      expect(emission.payload).toEqual(expect.objectContaining({ gameId: 'game-1', revision: 7 }))
    }

    const aliceGame = (emissions[0].payload as { game: Record<string, unknown> }).game
    const bobGame = (emissions[1].payload as { game: Record<string, unknown> }).game
    expect((aliceGame.gameState as { racks: unknown }).racks).toEqual({
      'user-1': [{ id: 'tile-a', letter: 'A', value: 1 }],
    })
    expect((bobGame.gameState as { racks: unknown }).racks).toEqual({
      'user-2': [{ id: 'tile-b', letter: 'B', value: 3 }],
    })
  })

  it('sends gameplay metadata and deltas without another full-state document', () => {
    const game = scrabbleGame()
    game.result = {
      winner: 'user-1',
      winnerName: 'alice',
      isDraw: false,
      winType: 'score',
      verification: 'server',
    } as unknown as IGameDocument['result']

    emitMoveMade(game, 'placed CAT')
    emitGameOver(game)
    emitPlayerPresenceChanged(game, 'user-2', false)
    emitChatMessage(game, { messageId: 'message-1', text: 'hello' })

    expect(emissions).toHaveLength(8)
    expect(emissions.every(({ room }) => room.startsWith('game:game-1:user:'))).toBe(true)

    const move = emissions.find(({ event }) => event === 'moveMade')?.payload as Record<string, unknown>
    expect(move).toEqual({ gameId: 'game-1', revision: 7, move: 'placed CAT' })
    expect(move).not.toHaveProperty('game')

    const gameOver = emissions.find(({ event }) => event === 'gameOver')?.payload as Record<string, unknown>
    expect(gameOver).toEqual(expect.objectContaining({
      gameId: 'game-1',
      revision: 7,
      result: expect.objectContaining({ winnerName: 'alice', verification: 'server' }),
    }))
    expect(gameOver).not.toHaveProperty('game')

    const presence = emissions.find(({ event }) => event === 'playerPresenceChanged')?.payload
    expect(presence).toEqual({ gameId: 'game-1', userId: 'user-2', isConnected: false })

    const chat = emissions.find(({ event }) => event === 'chatMessage')?.payload
    expect(chat).toEqual({ gameId: 'game-1', message: { messageId: 'message-1', text: 'hello' } })
  })

  it('keeps dashboard refreshes and logout disconnection on the global user room', () => {
    const game = scrabbleGame()

    emitGamesChanged(game)
    disconnectUserSockets('user-1')

    expect(emissions).toEqual([
      { room: 'user:user-1', event: 'gamesChanged', payload: undefined },
      { room: 'user:user-2', event: 'gamesChanged', payload: undefined },
    ])
    expect(inRoom).toHaveBeenCalledWith('user:user-1')
    expect(disconnectSockets).toHaveBeenCalledWith(true)
  })

  it('fans a rematch redirect with the unchanged payload to every source participant', () => {
    const sourceGame = scrabbleGame()
    const replayGame = {
      ...scrabbleGame(),
      _id: 'game-2',
      gameCode: 'REPLAY12',
    } as unknown as IGameDocument

    emitGameReplayCreated(sourceGame, replayGame)

    expect(emissions).toEqual([
      {
        room: 'user:user-1',
        event: 'gameReplayCreated',
        payload: { oldGameId: 'game-1', gameId: 'game-2', gameCode: 'REPLAY12', gameType: 'scrabble' },
      },
      {
        room: 'user:user-2',
        event: 'gameReplayCreated',
        payload: { oldGameId: 'game-1', gameId: 'game-2', gameCode: 'REPLAY12', gameType: 'scrabble' },
      },
    ])
  })

  it('starts terminal lease cleanup before broadcasting the final full state', async () => {
    const game = scrabbleGame()
    game.status = 'completed'
    const release = jest.spyOn(activeGameConnectionLeases, 'releaseGame').mockResolvedValue(2)

    emitGameUpdated(game)

    expect(release).toHaveBeenCalledWith('game-1')
    expect(emissions.filter(({ event }) => event === 'gameUpdated')).toHaveLength(2)
    await expect(releaseActiveGameConnectionLeases('game-1')).resolves.toBeUndefined()
    release.mockRestore()
  })
})
