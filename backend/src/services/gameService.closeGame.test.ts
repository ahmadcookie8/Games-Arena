import { gameService } from './gameService'
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors'

jest.mock('../models/Game', () => ({
  Game: {
    create: jest.fn(),
    findById: jest.fn(),
  },
}))

jest.mock('../models/GameSnapshot', () => ({
  GameSnapshot: {
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
  },
}))

jest.mock('./socketNotifier', () => ({
  emitGameOver: jest.fn(),
  emitChatMessage: jest.fn(),
  emitGameReplayCreated: jest.fn(),
  emitGameUpdated: jest.fn(),
  emitGamesChanged: jest.fn(),
  emitMoveMade: jest.fn(),
}))

jest.mock('./userService', () => ({
  userService: {
    updateStatsAfterGame: jest.fn(),
    invalidateLeaderboardCache: jest.fn(),
  },
}))

jest.mock('../utils/securityLogger', () => ({
  logSecurityEvent: jest.fn(),
}))

const { Game } = jest.requireMock('../models/Game') as {
  Game: { create: jest.Mock; findById: jest.Mock }
}
const { emitChatMessage, emitGameReplayCreated, emitGameUpdated, emitGamesChanged } = jest.requireMock('./socketNotifier') as {
  emitChatMessage: jest.Mock
  emitGameReplayCreated: jest.Mock
  emitGameUpdated: jest.Mock
  emitGamesChanged: jest.Mock
}
const { userService } = jest.requireMock('./userService') as {
  userService: {
    updateStatsAfterGame: jest.Mock
    invalidateLeaderboardCache: jest.Mock
  }
}
const { logSecurityEvent } = jest.requireMock('../utils/securityLogger') as {
  logSecurityEvent: jest.Mock
}

function createGame(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'game-1',
    gameType: 'ticTacToe',
    status: 'active',
    players: [
      { userId: { toString: () => 'user-1' }, username: 'alice' },
      { userId: { toString: () => 'user-2' }, username: 'bob' },
    ],
    gameState: { board: Array(9).fill(null) },
    moveHistory: [],
    result: { winnerName: 'alice', isDraw: false, winType: 'three_in_a_row' },
    metadata: { ratedGame: false, mode: 'multiplayer' },
    completedAt: undefined,
    lastMoveAt: new Date('2024-01-01T00:00:00.000Z'),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function createSoloGame(overrides: Partial<Record<string, unknown>> = {}) {
  return createGame({
    players: [
      { userId: { toString: () => 'user-1' }, username: 'alice', index: 0 },
    ],
    currentTurnIndex: 0,
    currentTurn: { toString: () => 'user-1' },
    gameState: { board: Array(9).fill(null), currentSymbol: 'X' },
    result: undefined,
    metadata: { ratedGame: false, mode: 'singlePlayer', difficulty: 'hard' },
    ...overrides,
  })
}

function createSnakeGame(overrides: Partial<Record<string, unknown>> = {}) {
  return createGame({
    gameType: 'snake',
    players: [
      { userId: { toString: () => 'user-1' }, username: 'alice', index: 0 },
    ],
    currentTurnIndex: 0,
    currentTurn: { toString: () => 'user-1' },
    gameState: {
      width: 12,
      height: 12,
      snake: [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 6, y: 3 },
      score: 3,
      isGameOver: false,
      hasStarted: false,
      tickMs: 120,
    },
    result: undefined,
    metadata: { ratedGame: false, mode: 'singlePlayer', boardSize: 'small', wallLooping: false },
    ...overrides,
  })
}

function createMazeChaseState(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    width: 21,
    height: 21,
    maze: [
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
    ],
    player: {
      position: { x: 10, y: 15 },
      start: { x: 10, y: 15 },
      direction: 'none',
      pendingDirection: 'none',
    },
    ghosts: [
      { id: 'spark', color: '#22d3ee', position: { x: 9, y: 9 }, start: { x: 9, y: 9 }, direction: 'left', mode: 'chase' },
      { id: 'rose', color: '#fb7185', position: { x: 10, y: 9 }, start: { x: 10, y: 9 }, direction: 'up', mode: 'chase' },
      { id: 'lime', color: '#4ade80', position: { x: 11, y: 9 }, start: { x: 11, y: 9 }, direction: 'right', mode: 'chase' },
      { id: 'ember', color: '#f97316', position: { x: 10, y: 8 }, start: { x: 10, y: 8 }, direction: 'down', mode: 'chase' },
    ],
    pellets: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    powerPellets: [{ x: 1, y: 3 }],
    fruit: { position: { x: 9, y: 13 }, active: true, collected: false },
    score: 0,
    lives: 3,
    level: 1,
    frightenedUntil: 0,
    isGameOver: false,
    hasStarted: false,
    tickMs: 150,
    ghostStepCounter: 0,
    ...overrides,
  }
}

function createMazeChaseGame(overrides: Partial<Record<string, unknown>> = {}) {
  return createGame({
    gameType: 'mazeChase',
    players: [
      { userId: { toString: () => 'user-1' }, username: 'alice', index: 0 },
    ],
    currentTurnIndex: 0,
    currentTurn: { toString: () => 'user-1' },
    gameState: createMazeChaseState(),
    result: undefined,
    metadata: { ratedGame: false, mode: 'singlePlayer' },
    ...overrides,
  })
}

describe('gameService.closeGame', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('marks an active waiting room as abandoned and emits refresh events', async () => {
    const game = createGame({ players: [{ userId: { toString: () => 'user-1' }, username: 'alice', index: 0 }] })
    Game.findById.mockResolvedValue(game)

    const result = await gameService.closeGame('game-1', 'user-1')

    expect(result).toBe(game)
    expect(game.status).toBe('abandoned')
    expect(game.result).toBeUndefined()
    expect(game.completedAt).toBeInstanceOf(Date)
    expect(game.lastMoveAt).toBeInstanceOf(Date)
    expect(game.save).toHaveBeenCalled()
    expect(emitGameUpdated).toHaveBeenCalledWith(game)
    expect(emitGamesChanged).toHaveBeenCalledWith(game)
    expect(userService.updateStatsAfterGame).not.toHaveBeenCalled()
    expect(userService.invalidateLeaderboardCache).not.toHaveBeenCalled()
  })

  it('marks an active single player game as abandoned', async () => {
    const game = createSoloGame()
    Game.findById.mockResolvedValue(game)

    const result = await gameService.closeGame('game-1', 'user-1')

    expect(result).toBe(game)
    expect(game.status).toBe('abandoned')
    expect(emitGameUpdated).toHaveBeenCalledWith(game)
    expect(emitGamesChanged).toHaveBeenCalledWith(game)
  })

  it('rejects non-participants', async () => {
    Game.findById.mockResolvedValue(createGame())

    await expect(gameService.closeGame('game-1', 'user-3')).rejects.toBeInstanceOf(NotFoundError)
  })

  it.each(['paused', 'completed', 'abandoned'])('rejects %s games without changing them', async (status) => {
    const game = createGame({ status })
    Game.findById.mockResolvedValue(game)

    await expect(gameService.closeGame('game-1', 'user-1')).rejects.toBeInstanceOf(BadRequestError)
    expect(game.status).toBe(status)
    expect(game.save).not.toHaveBeenCalled()
  })

  it('allows the host to abandon a started multiplayer game without recording a result or statistics', async () => {
    const game = createGame({ statsProcessedAt: new Date('2024-01-02T00:00:00.000Z') })
    Game.findById.mockResolvedValue(game)

    await expect(gameService.closeGame('game-1', 'user-1')).resolves.toBe(game)

    expect(game.status).toBe('abandoned')
    expect(game.result).toBeUndefined()
    expect(game.statsProcessedAt).toBeUndefined()
    expect(game.save).toHaveBeenCalled()
    expect(userService.updateStatsAfterGame).not.toHaveBeenCalled()
    expect(userService.invalidateLeaderboardCache).not.toHaveBeenCalled()
    expect(emitGameUpdated).toHaveBeenCalledWith(game)
    expect(emitGamesChanged).toHaveBeenCalledWith(game)
    expect(logSecurityEvent).toHaveBeenCalledWith('game.host_closed_in_progress', {
      gameId: 'game-1',
      gameType: 'ticTacToe',
      hostUserId: 'user-1',
      playerCount: 2,
    })
  })

  it('allows the host to abandon an active game with more than two players', async () => {
    const game = createGame({
      gameType: 'wisecracker',
      players: [
        { userId: { toString: () => 'user-1' }, username: 'alice' },
        { userId: { toString: () => 'user-2' }, username: 'bob' },
        { userId: { toString: () => 'user-3' }, username: 'carol' },
      ],
    })
    Game.findById.mockResolvedValue(game)

    await expect(gameService.closeGame('game-1', 'user-1')).resolves.toBe(game)

    expect(game.status).toBe('abandoned')
    expect(logSecurityEvent).toHaveBeenCalledWith('game.host_closed_in_progress', expect.objectContaining({
      gameType: 'wisecracker',
      playerCount: 3,
    }))
  })

  it('rejects an in-progress close from a non-host participant', async () => {
    const game = createGame()
    Game.findById.mockResolvedValue(game)

    await expect(gameService.closeGame('game-1', 'user-2')).rejects.toBeInstanceOf(ForbiddenError)

    expect(game.status).toBe('active')
    expect(game.save).not.toHaveBeenCalled()
    expect(logSecurityEvent).not.toHaveBeenCalled()
  })
})

describe('gameService.sendChatMessage', () => {
  const chatUserId = '507f1f77bcf86cd799439011'
  const otherChatUserId = '507f1f77bcf86cd799439012'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('persists a trimmed player chat message and emits it to the room', async () => {
    const game = createGame({
      chatMessages: [],
      players: [
        { userId: { toString: () => chatUserId }, username: 'alice' },
        { userId: { toString: () => otherChatUserId }, username: 'bob' },
      ],
    })
    Game.findById.mockResolvedValue(game)

    const message = await gameService.sendChatMessage('game-1', chatUserId, 'alice', '  hello table  ')

    expect(message).toEqual(expect.objectContaining({
      username: 'alice',
      text: 'hello table',
    }))
    expect(game.chatMessages).toHaveLength(1)
    expect(game.save).toHaveBeenCalled()
    expect(emitChatMessage).toHaveBeenCalledWith(game, message)
  })

  it('rejects chat from non-players and blank messages', async () => {
    Game.findById.mockResolvedValue(createGame({
      chatMessages: [],
      players: [
        { userId: { toString: () => chatUserId }, username: 'alice' },
        { userId: { toString: () => otherChatUserId }, username: 'bob' },
      ],
    }))

    await expect(gameService.sendChatMessage('game-1', 'user-3', 'mallory', 'hi')).rejects.toBeInstanceOf(NotFoundError)
    await expect(gameService.sendChatMessage('game-1', chatUserId, 'alice', '   ')).rejects.toBeInstanceOf(BadRequestError)
  })

  it('caps messages at 500 characters and keeps the most recent 100 messages', async () => {
    const game = createGame({
      players: [
        { userId: { toString: () => chatUserId }, username: 'alice' },
        { userId: { toString: () => otherChatUserId }, username: 'bob' },
      ],
      chatMessages: Array.from({ length: 100 }, (_, index) => ({
        messageId: `old-${index}`,
        userId: { toString: () => chatUserId },
        username: 'alice',
        text: `old ${index}`,
        timestamp: new Date(),
      })),
    })
    Game.findById.mockResolvedValue(game)

    await expect(gameService.sendChatMessage('game-1', chatUserId, 'alice', 'x'.repeat(501))).rejects.toBeInstanceOf(BadRequestError)
    await gameService.sendChatMessage('game-1', chatUserId, 'alice', 'new')

    expect(game.chatMessages).toHaveLength(100)
    expect(game.chatMessages[0].messageId).toBe('old-1')
    expect(game.chatMessages[99].text).toBe('new')
  })
})

describe('gameService.replayGame', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a fresh invite-only Tic Tac Toe room for the replay requester', async () => {
    const sourceGame = createGame({ status: 'completed', chatMessages: [{ messageId: 'old' }], moveHistory: [{ moveNumber: 1 }] })
    const replayGame = createGame({ _id: 'game-2', status: 'active', gameCode: 'REPLAY', moveHistory: [], chatMessages: [] })
    Game.findById.mockResolvedValue(sourceGame)
    Game.create.mockResolvedValue(replayGame)

    const result = await gameService.replayGame('game-1', 'user-2')

    expect(result).toBe(replayGame)
    expect(Game.create).toHaveBeenCalledWith(expect.objectContaining({
      gameType: 'ticTacToe',
      moveHistory: [],
      chatMessages: [],
      currentTurnIndex: 0,
      currentTurn: sourceGame.players[1].userId,
      gameState: { board: Array(9).fill(null), currentSymbol: 'X' },
      metadata: { ratedGame: false, mode: 'multiplayer', infiniteLetters: undefined },
    }))
    expect(Game.create.mock.calls[0][0].players).toEqual([
      expect.objectContaining({ userId: sourceGame.players[1].userId, username: 'bob', index: 0, isConnected: false }),
    ])
    expect(emitGameReplayCreated).toHaveBeenCalledWith(sourceGame, replayGame, 'user-2')
    expect(emitGamesChanged).not.toHaveBeenCalledWith(sourceGame)
    expect(emitGamesChanged).toHaveBeenCalledWith(replayGame)
  })

  it('preserves Scrabble infinite letters and creates a fresh rack only for the requester', async () => {
    const sourceGame = createGame({
      gameType: 'scrabble',
      status: 'completed',
      metadata: { ratedGame: false, mode: 'multiplayer', infiniteLetters: true },
    })
    const replayGame = createGame({ _id: 'game-2', gameType: 'scrabble', status: 'active', gameCode: 'REPLAY' })
    Game.findById.mockResolvedValue(sourceGame)
    Game.create.mockResolvedValue(replayGame)

    await gameService.replayGame('game-1', 'user-1')

    const created = Game.create.mock.calls[0][0]
    expect(created.metadata).toEqual({ ratedGame: false, mode: 'multiplayer', infiniteLetters: true })
    expect(created.gameState.infiniteLetters).toBe(true)
    expect(Object.keys(created.gameState.racks)).toEqual(['user-1'])
    expect(created.gameState.scores).toEqual({ 'user-1': 0 })
    expect(created.gameState.board.flat().every((cell: unknown) => cell === null)).toBe(true)
  })

  it('rejects non-players, non-completed games, single-player games, and unsupported games', async () => {
    Game.findById.mockResolvedValue(createGame({ status: 'completed' }))
    await expect(gameService.replayGame('game-1', 'user-3')).rejects.toBeInstanceOf(NotFoundError)

    Game.findById.mockResolvedValue(createGame({ status: 'active' }))
    await expect(gameService.replayGame('game-1', 'user-1')).rejects.toBeInstanceOf(BadRequestError)

    Game.findById.mockResolvedValue(createSoloGame({ status: 'completed' }))
    await expect(gameService.replayGame('game-1', 'user-1')).rejects.toBeInstanceOf(BadRequestError)

    Game.findById.mockResolvedValue(createGame({ gameType: 'wisecracker', status: 'completed' }))
    await expect(gameService.replayGame('game-1', 'user-1')).rejects.toBeInstanceOf(BadRequestError)
  })
})

describe('gameService single player Tic Tac Toe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates an active persisted solo game with difficulty metadata', async () => {
    const game = createSoloGame({ metadata: { ratedGame: false, mode: 'singlePlayer', difficulty: 'medium' } })
    Game.create.mockResolvedValue(game)

    const result = await gameService.createSinglePlayerGame('user-1', 'alice', { gameType: 'ticTacToe', difficulty: 'medium' })

    expect(result).toBe(game)
    expect(Game.create).toHaveBeenCalledWith(expect.objectContaining({
      gameType: 'ticTacToe',
      players: [{ userId: 'user-1', username: 'alice', index: 0 }],
      metadata: { ratedGame: false, mode: 'singlePlayer', difficulty: 'medium' },
    }))
  })

  it('defaults Tic Tac Toe difficulty to easy when omitted', async () => {
    const game = createSoloGame({ metadata: { ratedGame: false, mode: 'singlePlayer', difficulty: 'easy' } })
    Game.create.mockResolvedValue(game)

    await gameService.createSinglePlayerGame('user-1', 'alice', { gameType: 'ticTacToe' })

    expect(Game.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { ratedGame: false, mode: 'singlePlayer', difficulty: 'easy' },
    }))
  })

  it('updates Tic Tac Toe difficulty before the first move', async () => {
    const game = createSoloGame({ metadata: { ratedGame: false, mode: 'singlePlayer', difficulty: 'easy' } })
    Game.findById.mockResolvedValue(game)

    await gameService.updateSinglePlayerSettings('game-1', 'user-1', { difficulty: 'hard' })

    expect(game.metadata.difficulty).toBe('hard')
    expect(game.save).toHaveBeenCalled()
  })

  it('rejects Tic Tac Toe difficulty changes after the first move', async () => {
    const game = createSoloGame({
      moveHistory: [{ moveNumber: 1, playerId: { toString: () => 'user-1' }, playerName: 'alice', move: '0', timestamp: new Date() }],
    })
    Game.findById.mockResolvedValue(game)

    await expect(gameService.updateSinglePlayerSettings('game-1', 'user-1', { difficulty: 'medium' })).rejects.toBeInstanceOf(BadRequestError)
  })

  it('records a human move and an AI reply when the game continues', async () => {
    const game = createSoloGame({ metadata: { ratedGame: false, mode: 'singlePlayer', difficulty: 'hard' } })
    Game.findById.mockResolvedValue(game)

    const result = await gameService.makeSinglePlayerTicTacToeMove('game-1', 'user-1', '0')

    expect(result).toBe(game)
    expect(game.status).toBe('active')
    expect(game.moveHistory).toHaveLength(2)
    expect(game.moveHistory[0].playerName).toBe('alice')
    expect(game.moveHistory[1].playerName).toBe('Computer (Hard)')
    expect(game.save).toHaveBeenCalled()
    expect(userService.updateStatsAfterGame).not.toHaveBeenCalled()
  })

  it('hard AI blocks an immediate human win', async () => {
    const game = createSoloGame({
      gameState: {
        board: ['X', 'X', null, null, 'O', null, null, null, null],
        currentSymbol: 'X',
      },
      metadata: { ratedGame: false, mode: 'singlePlayer', difficulty: 'hard' },
    })
    Game.findById.mockResolvedValue(game)

    await gameService.makeSinglePlayerTicTacToeMove('game-1', 'user-1', '8')

    expect(game.moveHistory[1].move).toBe('2')
    expect(game.gameState.board[2]).toBe('O')
  })

  it('completes with a user win and does not update multiplayer stats', async () => {
    const game = createSoloGame({
      gameState: {
        board: ['X', 'X', null, 'O', 'O', null, null, null, null],
        currentSymbol: 'X',
      },
      metadata: { ratedGame: false, mode: 'singlePlayer', difficulty: 'easy' },
    })
    Game.findById.mockResolvedValue(game)

    await gameService.makeSinglePlayerTicTacToeMove('game-1', 'user-1', '2')

    expect(game.status).toBe('completed')
    expect(game.result).toEqual(expect.objectContaining({
      winnerName: 'alice',
      isDraw: false,
      winType: 'three_in_a_row',
    }))
    expect(game.moveHistory).toHaveLength(1)
    expect(userService.updateStatsAfterGame).not.toHaveBeenCalled()
    expect(userService.invalidateLeaderboardCache).toHaveBeenCalledWith('ticTacToe')
  })

  it('keeps a committed single-player completion successful when Redis invalidation fails', async () => {
    const game = createSoloGame({
      gameState: {
        board: ['X', 'X', null, 'O', 'O', null, null, null, null],
        currentSymbol: 'X',
      },
      metadata: { ratedGame: false, mode: 'singlePlayer', difficulty: 'easy' },
    })
    Game.findById.mockResolvedValue(game)
    userService.invalidateLeaderboardCache.mockRejectedValueOnce(new Error('Redis unavailable'))

    await expect(gameService.makeSinglePlayerTicTacToeMove('game-1', 'user-1', '2')).resolves.toBe(game)

    expect(game.status).toBe('completed')
    expect(game.save).toHaveBeenCalled()
    expect(emitGameUpdated).toHaveBeenCalledWith(game)
    expect(emitGamesChanged).toHaveBeenCalledWith(game)
  })
})

describe('gameService single player Snake', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates an active persisted Snake game with board metadata', async () => {
    const game = createSnakeGame({ metadata: { ratedGame: false, mode: 'singlePlayer', boardSize: 'large', wallLooping: true } })
    Game.create.mockResolvedValue(game)

    const result = await gameService.createSinglePlayerGame('user-1', 'alice', { gameType: 'snake', boardSize: 'large', wallLooping: true })

    expect(result).toBe(game)
    expect(Game.create).toHaveBeenCalledWith(expect.objectContaining({
      gameType: 'snake',
      players: [{ userId: 'user-1', username: 'alice', index: 0 }],
      metadata: { ratedGame: false, mode: 'singlePlayer', boardSize: 'large', wallLooping: true },
    }))
  })

  it('defaults Snake to a medium solid-walls board when settings are omitted', async () => {
    const game = createSnakeGame({ metadata: { ratedGame: false, mode: 'singlePlayer', boardSize: 'medium', wallLooping: false } })
    Game.create.mockResolvedValue(game)

    await gameService.createSinglePlayerGame('user-1', 'alice', { gameType: 'snake' })

    expect(Game.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { ratedGame: false, mode: 'singlePlayer', boardSize: 'medium', wallLooping: false },
    }))
  })

  it('updates Snake settings before the run starts and resets board dimensions', async () => {
    const game = createSnakeGame()
    Game.findById.mockResolvedValue(game)

    await gameService.updateSinglePlayerSettings('game-1', 'user-1', { boardSize: 'large', wallLooping: true })

    expect(game.metadata.boardSize).toBe('large')
    expect(game.metadata.wallLooping).toBe(true)
    expect(game.gameState.width).toBe(24)
    expect(game.gameState.height).toBe(24)
    expect(game.gameState.hasStarted).toBe(false)
  })

  it('rejects Snake settings changes after the run starts', async () => {
    const game = createSnakeGame({
      gameState: {
        width: 12,
        height: 12,
        snake: [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }],
        direction: 'right',
        pendingDirection: 'right',
        food: { x: 6, y: 3 },
        score: 3,
        isGameOver: false,
        hasStarted: true,
        tickMs: 120,
      },
    })
    Game.findById.mockResolvedValue(game)

    await expect(gameService.updateSinglePlayerSettings('game-1', 'user-1', { boardSize: 'medium', wallLooping: false })).rejects.toBeInstanceOf(BadRequestError)
  })

  it('saves an active Snake checkpoint without completing the game', async () => {
    const game = createSnakeGame()
    Game.findById.mockResolvedValue(game)

    await gameService.saveSinglePlayerSnakeState('game-1', 'user-1', {
      width: 12,
      height: 12,
      snake: [{ x: 4, y: 3 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 6, y: 3 },
      score: 4,
      isGameOver: false,
      tickMs: 120,
    })

    expect(game.status).toBe('active')
    expect(game.gameState.score).toBe(4)
    expect(game.result).toBeUndefined()
    expect(game.moveHistory).toHaveLength(0)
    expect(userService.updateStatsAfterGame).not.toHaveBeenCalled()
  })

  it('completes Snake with final score equal to snake length', async () => {
    const game = createSnakeGame()
    Game.findById.mockResolvedValue(game)

    await gameService.saveSinglePlayerSnakeState('game-1', 'user-1', {
      width: 12,
      height: 12,
      snake: [{ x: 4, y: 3 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 6, y: 3 },
      score: 4,
      isGameOver: true,
      tickMs: 120,
    }, true)

    expect(game.status).toBe('completed')
    expect(game.result).toEqual(expect.objectContaining({
      winnerName: 'alice',
      isDraw: false,
      winType: 'score:4',
    }))
    expect(game.moveHistory[0].move).toBe('Score 4')
    expect(userService.updateStatsAfterGame).not.toHaveBeenCalled()
    expect(userService.invalidateLeaderboardCache).toHaveBeenCalledWith('snake')
  })

  it('rejects invalid Snake state scores', async () => {
    const game = createSnakeGame()
    Game.findById.mockResolvedValue(game)

    await expect(gameService.saveSinglePlayerSnakeState('game-1', 'user-1', {
      width: 12,
      height: 12,
      snake: [{ x: 4, y: 3 }, { x: 3, y: 3 }],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 6, y: 3 },
      score: 99,
      isGameOver: false,
      tickMs: 120,
    })).rejects.toBeInstanceOf(BadRequestError)
  })
})

describe('gameService single player Maze Chase', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates an active persisted Maze Chase game with initial maze state', async () => {
    const game = createMazeChaseGame()
    Game.create.mockResolvedValue(game)

    const result = await gameService.createSinglePlayerGame('user-1', 'alice', { gameType: 'mazeChase' })

    expect(result).toBe(game)
    expect(Game.create).toHaveBeenCalledWith(expect.objectContaining({
      gameType: 'mazeChase',
      players: [{ userId: 'user-1', username: 'alice', index: 0 }],
      metadata: { ratedGame: false, mode: 'singlePlayer' },
    }))
    const created = Game.create.mock.calls[0][0]
    expect(created.gameState).toEqual(expect.objectContaining({
      width: 21,
      height: 21,
      lives: 3,
      level: 1,
      score: 0,
      isGameOver: false,
    }))
    expect(created.gameState.ghosts).toHaveLength(4)
  })

  it('saves an active Maze Chase checkpoint without completing the game', async () => {
    const game = createMazeChaseGame()
    Game.findById.mockResolvedValue(game)
    const state = createMazeChaseState({ score: 120, hasStarted: true })

    await gameService.saveSinglePlayerMazeChaseState('game-1', 'user-1', state)

    expect(game.status).toBe('active')
    expect(game.gameState.score).toBe(120)
    expect(game.result).toBeUndefined()
    expect(game.moveHistory).toHaveLength(0)
    expect(userService.updateStatsAfterGame).not.toHaveBeenCalled()
  })

  it('accepts hidden Maze Chase ghosts in checkpoints', async () => {
    const game = createMazeChaseGame()
    Game.findById.mockResolvedValue(game)
    const state = createMazeChaseState({
      ghosts: [
        { id: 'spark', color: '#22d3ee', position: { x: 9, y: 9 }, start: { x: 9, y: 9 }, direction: 'none', mode: 'hidden', respawnAt: 12345 },
        { id: 'rose', color: '#fb7185', position: { x: 10, y: 9 }, start: { x: 10, y: 9 }, direction: 'up', mode: 'chase' },
        { id: 'lime', color: '#4ade80', position: { x: 11, y: 9 }, start: { x: 11, y: 9 }, direction: 'right', mode: 'chase' },
        { id: 'ember', color: '#f97316', position: { x: 10, y: 8 }, start: { x: 10, y: 8 }, direction: 'down', mode: 'chase' },
      ],
    })

    await gameService.saveSinglePlayerMazeChaseState('game-1', 'user-1', state)

    expect(game.status).toBe('active')
    expect(game.gameState.ghosts[0].mode).toBe('hidden')
    expect(game.gameState.ghosts[0].respawnAt).toBe(12345)
  })


  it('completes Maze Chase with final score', async () => {
    const game = createMazeChaseGame()
    Game.findById.mockResolvedValue(game)
    const state = createMazeChaseState({ score: 420, lives: 0, isGameOver: true })

    await gameService.saveSinglePlayerMazeChaseState('game-1', 'user-1', state, true)

    expect(game.status).toBe('completed')
    expect(game.result).toEqual(expect.objectContaining({
      winnerName: 'alice',
      isDraw: false,
      winType: 'score:420',
    }))
    expect(game.moveHistory[0].move).toBe('Score 420')
    expect(userService.invalidateLeaderboardCache).toHaveBeenCalledWith('mazeChase')
  })

  it('rejects invalid Maze Chase state and non-player saves', async () => {
    const game = createMazeChaseGame()
    Game.findById.mockResolvedValue(game)

    await expect(gameService.saveSinglePlayerMazeChaseState('game-1', 'user-2', createMazeChaseState())).rejects.toBeInstanceOf(BadRequestError)
    await expect(gameService.saveSinglePlayerMazeChaseState('game-1', 'user-1', createMazeChaseState({
      player: {
        position: { x: 0, y: 0 },
        start: { x: 10, y: 15 },
        direction: 'none',
        pendingDirection: 'none',
      },
    }))).rejects.toBeInstanceOf(BadRequestError)
    await expect(gameService.saveSinglePlayerMazeChaseState('game-1', 'user-1', createMazeChaseState({ width: 20 }))).rejects.toBeInstanceOf(BadRequestError)
  })
})
