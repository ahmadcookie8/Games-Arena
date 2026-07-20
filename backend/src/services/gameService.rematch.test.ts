import { gameService } from './gameService'
import { ForbiddenError } from '../utils/errors'

jest.mock('../models/Game', () => ({
  Game: {
    create: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}))

jest.mock('../models/GameSnapshot', () => ({
  GameSnapshot: { countDocuments: jest.fn(), create: jest.fn() },
}))

jest.mock('../middleware/rateLimit', () => ({
  acquireRedisConcurrencySlot: jest.fn(),
  releaseRedisConcurrencySlot: jest.fn(),
}))

jest.mock('../utils/securityLogger', () => ({ logSecurityEvent: jest.fn() }))

jest.mock('./socketNotifier', () => ({
  emitChatMessage: jest.fn(),
  emitGameOver: jest.fn(),
  emitGameReplayCreated: jest.fn(),
  emitGameUpdated: jest.fn(),
  emitGamesChanged: jest.fn(),
  emitMoveMade: jest.fn(),
  emitPlayerPresenceChanged: jest.fn(),
}))

jest.mock('./userService', () => ({
  userService: { updateStatsAfterGame: jest.fn(), invalidateLeaderboardCache: jest.fn() },
}))

const { Game } = jest.requireMock('../models/Game') as {
  Game: {
    create: jest.Mock
    countDocuments: jest.Mock
    findOne: jest.Mock
  }
}
const { acquireRedisConcurrencySlot, releaseRedisConcurrencySlot } = jest.requireMock('../middleware/rateLimit') as {
  acquireRedisConcurrencySlot: jest.Mock
  releaseRedisConcurrencySlot: jest.Mock
}
const { emitGameReplayCreated, emitGamesChanged } = jest.requireMock('./socketNotifier') as {
  emitGameReplayCreated: jest.Mock
  emitGamesChanged: jest.Mock
}

const gameId = 'abcdef0123456789abcdef01'
const rematchId = 'fedcba9876543210fedcba98'

function userId(index: number): string {
  return index.toString(16).padStart(24, '0')
}

function id(value: string): { toString(): string } {
  return { toString: () => value }
}

type PublishedGameType = 'ticTacToe' | 'scrabble' | 'wisecracker' | 'propertyManagement'

function completedGame(gameType: PublishedGameType, playerCount: number) {
  const players = Array.from({ length: playerCount }, (_, index) => ({
    userId: id(userId(index + 1)),
    username: `player-${index + 1}`,
    index,
    color: `color-${index + 1}`,
    rank: `rank-${index + 1}`,
    isConnected: true,
    connectedAt: new Date('2025-01-01T00:00:00.000Z'),
    disconnectCount: index + 2,
  }))
  return {
    _id: id(gameId),
    __v: 9,
    gameType,
    status: 'completed',
    gameCode: 'OLDGAME1',
    players,
    currentTurnIndex: Math.max(0, playerCount - 1),
    currentTurn: players.at(-1)?.userId,
    gameState: { stale: true, nested: { score: 99 } },
    moveHistory: [{ moveNumber: 1, move: 'old move' }],
    chatMessages: [{ messageId: 'old-message', text: 'old chat' }],
    completedAt: new Date('2025-01-02T00:00:00.000Z'),
    result: { winner: players[0]?.userId, winnerName: players[0]?.username, isDraw: false, winType: 'old' },
    metadata: { mode: 'multiplayer', ratedGame: true, infiniteLetters: gameType === 'scrabble' },
    save: jest.fn(),
  }
}

function createdGame(attributes: Record<string, unknown>) {
  return { ...attributes, _id: id(rematchId), __v: 0 }
}

function queryHas(query: unknown, key: string): boolean {
  return Boolean(query && typeof query === 'object' && key in query)
}

function arrangeCreation(source: ReturnType<typeof completedGame>): void {
  Game.findOne.mockImplementation(async (query: unknown) => queryHas(query, 'rematchOf') ? null : source)
  Game.countDocuments.mockResolvedValue(0)
  Game.create.mockImplementation(async (attributes: Record<string, unknown>) => createdGame(attributes))
  acquireRedisConcurrencySlot.mockResolvedValue({ allowed: true, count: 1 })
  releaseRedisConcurrencySlot.mockResolvedValue(undefined)
}

describe('coordinated multiplayer rematches', () => {
  beforeEach(() => jest.resetAllMocks())

  it('allows only players[0] to create the linked room', async () => {
    const source = completedGame('ticTacToe', 2)
    Game.findOne.mockResolvedValue(source)

    await expect(gameService.replayGame(gameId, userId(2))).rejects.toBeInstanceOf(ForbiddenError)

    expect(Game.create).not.toHaveBeenCalled()
    expect(acquireRedisConcurrencySlot).not.toHaveBeenCalled()
  })

  it.each([
    ['ticTacToe', 2],
    ['scrabble', 3],
    ['wisecracker', 3],
    ['propertyManagement', 3],
  ] as const)('creates fresh %s state for every original player', async (gameType, playerCount) => {
    const source = completedGame(gameType, playerCount)
    const sourceBefore = JSON.stringify(source)
    arrangeCreation(source)

    const rematch = await gameService.replayGame(gameId, userId(1)) as unknown as Record<string, any>

    expect(rematch.rematchOf).toBe(source._id)
    expect(rematch.status).toBe('active')
    expect(rematch.players).toHaveLength(playerCount)
    expect(rematch.players.map((player: Record<string, unknown>) => player.index)).toEqual(
      Array.from({ length: playerCount }, (_, index) => index)
    )
    expect(rematch.players.every((player: Record<string, unknown>) => (
      player.isConnected === false && player.disconnectCount === 0 && !('connectedAt' in player)
    ))).toBe(true)
    expect(rematch.currentTurn).toBe(source.players[0].userId)
    expect(rematch.currentTurnIndex).toBe(0)
    expect(rematch.moveHistory).toEqual([])
    expect(rematch.chatMessages).toEqual([])
    expect(rematch).not.toHaveProperty('result')
    expect(rematch.metadata).toEqual({
      ratedGame: true,
      mode: 'multiplayer',
      infiniteLetters: gameType === 'scrabble' ? true : undefined,
    })

    const playerIds = source.players.map((player) => player.userId.toString())
    if (gameType === 'ticTacToe') {
      expect(rematch.gameState).toEqual({ board: Array(9).fill(null), currentSymbol: 'X' })
    } else if (gameType === 'scrabble') {
      expect(Object.keys(rematch.gameState.racks)).toEqual(playerIds)
      expect(rematch.gameState.scores).toEqual(Object.fromEntries(playerIds.map((playerId) => [playerId, 0])))
      expect(rematch.gameState.infiniteLetters).toBe(true)
      expect(rematch.gameState.board.flat().every((cell: unknown) => cell === null)).toBe(true)
    } else if (gameType === 'wisecracker') {
      expect(rematch.gameState).toEqual(expect.objectContaining({
        phase: 'lobby',
        hostUserId: playerIds[0],
        maxScore: 3,
        activePlayerIds: playerIds,
        waitingPlayerIds: [],
        scores: Object.fromEntries(playerIds.map((playerId) => [playerId, 0])),
      }))
    } else {
      expect(rematch.gameState).toEqual(expect.objectContaining({
        phase: 'lobby',
        hostUserId: playerIds[0],
        currentPlayerUserId: playerIds[0],
        playerOrder: playerIds,
        pendingAction: null,
        bankruptPlayerIds: [],
        winnerId: null,
      }))
      expect(Object.values(rematch.gameState.playerStates).every((player: any) => (
        player.position === 0 && player.money === 1500 && player.inJail === false && player.isBankrupt === false
      ))).toBe(true)
      expect(Object.values(rematch.gameState.properties).every((property: any) => (
        property.ownerId === null && property.houses === 0 && property.mortgaged === false
      ))).toBe(true)
    }

    expect(JSON.stringify(source)).toBe(sourceBefore)
    expect(emitGameReplayCreated).toHaveBeenCalledWith(source, rematch)
    expect(emitGamesChanged).toHaveBeenCalledWith(rematch)
  })

  it.each([
    ['ticTacToe', 1],
    ['ticTacToe', 3],
    ['scrabble', 1],
    ['scrabble', 5],
    ['wisecracker', 2],
    ['wisecracker', 5],
    ['propertyManagement', 1],
    ['propertyManagement', 9],
  ] as const)('rejects a malformed %s roster containing %i players', async (gameType, playerCount) => {
    const source = completedGame(gameType, playerCount)
    Game.findOne.mockResolvedValue(source)

    await expect(gameService.replayGame(gameId, userId(1))).rejects.toMatchObject({ statusCode: 400 })
    expect(Game.create).not.toHaveBeenCalled()
  })

  it('locks every participant and counts only their active games toward membership capacity', async () => {
    const source = completedGame('wisecracker', 3)
    arrangeCreation(source)

    await gameService.replayGame(gameId, userId(1))

    const playerIds = source.players.map((player) => player.userId.toString()).sort()
    expect(acquireRedisConcurrencySlot.mock.calls.map((call) => call[1])).toEqual(playerIds)
    expect(Game.countDocuments.mock.calls.map((call) => call[0]['players.userId'])).toEqual(playerIds)
    expect(Game.countDocuments.mock.calls.map((call) => call[0].status)).toEqual(
      playerIds.map(() => 'active')
    )
    expect(releaseRedisConcurrencySlot.mock.calls.map((call) => call[1])).toEqual([...playerIds].reverse())
  })

  it('excludes completed and abandoned records from the 20-active-game membership cap', async () => {
    const source = completedGame('ticTacToe', 2)
    arrangeCreation(source)
    const membershipRecords = [
      ...Array.from({ length: 19 }, () => ({ status: 'active' })),
      ...Array.from({ length: 20 }, () => ({ status: 'completed' })),
      ...Array.from({ length: 20 }, () => ({ status: 'abandoned' })),
    ]
    Game.countDocuments.mockImplementation(async (query: Record<string, unknown>) => (
      membershipRecords.filter((record) => !query.status || record.status === query.status).length
    ))

    await expect(gameService.replayGame(gameId, userId(1))).resolves.toMatchObject({ status: 'active' })

    expect(Game.create).toHaveBeenCalledTimes(1)
    expect(Game.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }))
  })

  it('rejects a new membership when any participant already has 20 active games', async () => {
    const source = completedGame('ticTacToe', 2)
    arrangeCreation(source)
    Game.countDocuments.mockResolvedValueOnce(20)

    await expect(gameService.replayGame(gameId, userId(1))).rejects.toMatchObject({
      statusCode: 429,
      code: 'ACTIVE_GAME_LIMIT',
    })

    expect(Game.create).not.toHaveBeenCalled()
  })

  it('returns an existing linked rematch without creating or emitting again', async () => {
    const source = completedGame('ticTacToe', 2)
    const existing = createdGame({ gameType: 'ticTacToe', rematchOf: source._id, gameCode: 'EXISTING' })
    Game.findOne.mockImplementation(async (query: unknown) => queryHas(query, 'rematchOf') ? existing : source)

    await expect(gameService.replayGame(gameId, userId(1))).resolves.toBe(existing)

    expect(Game.create).not.toHaveBeenCalled()
    expect(emitGameReplayCreated).not.toHaveBeenCalled()
    expect(emitGamesChanged).not.toHaveBeenCalled()
  })

  it('converges concurrent duplicate inserts on one room and emits creation once', async () => {
    const source = completedGame('ticTacToe', 2)
    const existing = createdGame({ gameType: 'ticTacToe', rematchOf: source._id, gameCode: 'SAMEGAME' })
    let rematchLookups = 0
    Game.findOne.mockImplementation(async (query: unknown) => {
      if (!queryHas(query, 'rematchOf')) return source
      rematchLookups += 1
      return rematchLookups <= 4 ? null : existing
    })
    Game.countDocuments.mockResolvedValue(0)
    acquireRedisConcurrencySlot.mockResolvedValue({ allowed: true, count: 1 })
    releaseRedisConcurrencySlot.mockResolvedValue(undefined)
    Game.create
      .mockResolvedValueOnce(existing)
      .mockRejectedValueOnce({ code: 11000, keyPattern: { rematchOf: 1 } })

    const [first, second] = await Promise.all([
      gameService.replayGame(gameId, userId(1)),
      gameService.replayGame(gameId, userId(1)),
    ])

    expect(first).toBe(existing)
    expect(second).toBe(existing)
    expect(Game.create).toHaveBeenCalledTimes(2)
    expect(emitGameReplayCreated).toHaveBeenCalledTimes(1)
    expect(emitGamesChanged).toHaveBeenCalledTimes(1)
  })
})
