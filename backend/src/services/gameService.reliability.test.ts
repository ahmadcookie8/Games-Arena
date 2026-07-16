import { gameService } from './gameService'
import { AppError } from '../utils/errors'
import { PropertyManagement } from '../games/PropertyManagement'

jest.mock('../models/Game', () => ({
  Game: {
    create: jest.fn(),
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
  userService: {
    updateStatsAfterGame: jest.fn(),
    invalidateLeaderboardCache: jest.fn(),
  },
}))

const { Game } = jest.requireMock('../models/Game') as {
  Game: {
    create: jest.Mock
    findById: jest.Mock
    findOne: jest.Mock
    findOneAndUpdate: jest.Mock
  }
}
const {
  emitChatMessage,
  emitGameUpdated,
  emitGamesChanged,
  emitMoveMade,
  emitPlayerPresenceChanged,
} = jest.requireMock('./socketNotifier') as Record<string, jest.Mock>
const { userService } = jest.requireMock('./userService') as {
  userService: { updateStatsAfterGame: jest.Mock; invalidateLeaderboardCache: jest.Mock }
}
const { logSecurityEvent } = jest.requireMock('../utils/securityLogger') as {
  logSecurityEvent: jest.Mock
}

const aliceId = '0123456789abcdef01234567'
const bobId = '1123456789abcdef01234567'
const carolId = '2123456789abcdef01234567'
const waitingId = '3123456789abcdef01234567'
const gameId = 'abcdef0123456789abcdef01'

function id(value: string): { toString(): string } {
  return { toString: () => value }
}

function multiplayerGame(overrides: Record<string, unknown> = {}) {
  return {
    _id: id(gameId),
    __v: 11,
    gameType: 'ticTacToe',
    status: 'active',
    gameCode: 'ABCDEFGH',
    inviteExpiresAt: new Date(Date.now() + 60_000),
    players: [
      { userId: id(aliceId), username: 'alice', index: 0, isConnected: true, disconnectCount: 0 },
      { userId: id(bobId), username: 'bob', index: 1, isConnected: true, disconnectCount: 0 },
    ],
    currentTurnIndex: 0,
    currentTurn: id(aliceId),
    gameState: { board: Array(9).fill(null), currentSymbol: 'X' },
    moveHistory: [],
    chatMessages: [],
    metadata: { mode: 'multiplayer', ratedGame: false },
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function versionConflict(): Error {
  return Object.assign(new Error('stale document'), { name: 'VersionError' })
}

async function settleWithin<T>(promise: Promise<T>, timeoutMs = 250): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('operation remained on the acknowledgement path')), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

describe('gameService shared multiplayer reliability', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns a stable unavailable code before creating or joining legacy game types', async () => {
    await expect(gameService.createGame(aliceId, 'alice', 'chess')).rejects.toMatchObject<Partial<AppError>>({
      statusCode: 409,
      code: 'GAME_TYPE_UNAVAILABLE',
    })
    expect(Game.create).not.toHaveBeenCalled()

    Game.findOne.mockResolvedValue(multiplayerGame({ gameType: 'uno' }))
    await expect(gameService.joinGame('ABCDEFGH', aliceId, 'alice')).rejects.toMatchObject<Partial<AppError>>({
      statusCode: 409,
      code: 'GAME_TYPE_UNAVAILABLE',
    })
    expect(Game.findOne).toHaveBeenCalledTimes(1)

    Game.findOne.mockResolvedValue(multiplayerGame({ gameType: 'uno', status: 'completed' }))
    await expect(gameService.replayGame(gameId, aliceId)).rejects.toMatchObject<Partial<AppError>>({
      statusCode: 409,
      code: 'GAME_TYPE_UNAVAILABLE',
    })
    await expect(gameService.sendChatMessage(gameId, aliceId, 'alice', 'hello')).rejects.toMatchObject<Partial<AppError>>({
      statusCode: 409,
      code: 'GAME_TYPE_UNAVAILABLE',
    })
    await expect(gameService.resignGame(gameId, aliceId)).rejects.toMatchObject<Partial<AppError>>({
      statusCode: 409,
      code: 'GAME_TYPE_UNAVAILABLE',
    })
  })

  it('updates presence atomically without incrementing the gameplay revision or emitting full state', async () => {
    const updatedGame = multiplayerGame()
    Game.findOneAndUpdate.mockResolvedValue(updatedGame)

    await expect(gameService.setPlayerConnection(gameId, aliceId, false)).resolves.toBe(updatedGame)

    const [query, update, options] = Game.findOneAndUpdate.mock.calls[0]
    expect(query).toEqual({
      _id: gameId,
      'players.userId': aliceId,
      players: { $elemMatch: { userId: aliceId, isConnected: true } },
    })
    expect(update).toEqual({
      $set: { 'players.$[player].isConnected': false },
      $inc: { 'players.$[player].disconnectCount': 1 },
    })
    expect(update.$inc).not.toHaveProperty('__v')
    expect(options).toEqual(expect.objectContaining({ new: true, arrayFilters: expect.any(Array) }))
    expect(emitPlayerPresenceChanged).toHaveBeenCalledWith(updatedGame, aliceId, false)
    expect(emitGamesChanged).toHaveBeenCalledWith(updatedGame)
    expect(emitGameUpdated).not.toHaveBeenCalled()
  })

  it('appends chat atomically with a bounded slice and never saves or versions the full game', async () => {
    const sourceGame = multiplayerGame()
    const updatedGame = multiplayerGame({ chatMessages: [{ messageId: 'persisted-message' }] })
    Game.findOne.mockResolvedValue(sourceGame)
    Game.findOneAndUpdate.mockResolvedValue(updatedGame)

    const message = await gameService.sendChatMessage(gameId, aliceId, 'alice', '  hello table  ')

    expect(sourceGame.save).not.toHaveBeenCalled()
    const [query, update, options] = Game.findOneAndUpdate.mock.calls[0]
    expect(query).toEqual({ _id: gameId, 'players.userId': aliceId })
    expect(update).toEqual({
      $push: {
        chatMessages: {
          $each: [expect.objectContaining({ username: 'alice', text: 'hello table' })],
          $slice: -100,
        },
      },
    })
    expect(update).not.toHaveProperty('$inc')
    expect(options).toEqual({ new: true, runValidators: true })
    expect(message).toEqual(expect.objectContaining({ userId: aliceId, username: 'alice', text: 'hello table' }))
    expect(emitChatMessage).toHaveBeenCalledWith(updatedGame, message)
  })

  it('rejects and logs a Property Management transition that violates an engine invariant', async () => {
    let state = PropertyManagement.createInitialState(aliceId, 'alice')
    state = PropertyManagement.addPlayer(state, bobId, 'bob')
    state = PropertyManagement.applyAction(state, { type: 'startGame' }, aliceId)
    state.turnPhase = 'auction'
    state.pendingAction = {
      type: 'auction',
      auction: {
        squareIndex: 1,
        currentBid: 0,
        highBidderUserId: null,
        passedUserIds: [],
        activeUserIds: [aliceId, bobId],
        currentBidderIndex: 0,
      },
    }
    state.properties['1'].ownerId = bobId
    const game = multiplayerGame({ gameType: 'propertyManagement', gameState: state })
    Game.findOne.mockResolvedValue(game)

    await expect(gameService.makeMove(gameId, aliceId, { type: 'auctionPass' })).rejects.toMatchObject<Partial<AppError>>({
      statusCode: 409,
      code: 'GAME_INVARIANT_VIOLATION',
    })

    expect(game.save).not.toHaveBeenCalled()
    expect(logSecurityEvent).toHaveBeenCalledWith(
      'game.property_management_invariant_failed',
      expect.objectContaining({
        gameId,
        userId: aliceId,
        socketEvent: 'auctionPass',
        violationCount: 1,
      }),
      'error',
    )
  })

  it('re-reads a fresh game after optimistic conflicts and succeeds within four gameplay attempts', async () => {
    let attempt = 0
    Game.findOne.mockImplementation(async () => {
      attempt += 1
      const freshGame = multiplayerGame()
      freshGame.save = attempt < 4
        ? jest.fn().mockRejectedValue(versionConflict())
        : jest.fn().mockResolvedValue(undefined)
      return freshGame
    })

    const result = await gameService.makeMove(gameId, aliceId, '0')

    expect(Game.findOne).toHaveBeenCalledTimes(4)
    expect(result.moveHistory).toHaveLength(1)
    expect(result.currentTurn.toString()).toBe(bobId)
    expect(emitMoveMade).toHaveBeenCalledTimes(1)
    expect(emitGameUpdated).toHaveBeenCalledTimes(1)
  })

  it('stops after four gameplay conflicts and returns the retryable conflict code', async () => {
    Game.findOne.mockImplementation(async () => {
      const freshGame = multiplayerGame()
      freshGame.save = jest.fn().mockRejectedValue(versionConflict())
      return freshGame
    })

    await expect(gameService.makeMove(gameId, aliceId, '0')).rejects.toMatchObject<Partial<AppError>>({
      statusCode: 409,
      code: 'GAME_STATE_CONFLICT',
    })
    expect(Game.findOne).toHaveBeenCalledTimes(4)
    expect(emitGameUpdated).not.toHaveBeenCalled()
  })

  it('acknowledges a committed completion without waiting for statistics reconciliation', async () => {
    const completingGame = multiplayerGame({
      gameState: {
        board: ['X', 'X', null, 'O', 'O', null, null, null, null],
        currentSymbol: 'X',
      },
    })
    Game.findOne.mockResolvedValue(completingGame)
    userService.updateStatsAfterGame.mockImplementation(() => new Promise(() => undefined))

    const result = await settleWithin(gameService.makeMove(gameId, aliceId, '2'))

    expect(result.status).toBe('completed')
    expect(result.save).toHaveBeenCalled()
    expect(Game.findById).not.toHaveBeenCalled()
    expect(userService.updateStatsAfterGame).not.toHaveBeenCalled()
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(userService.updateStatsAfterGame).toHaveBeenCalledWith({ winnerId: aliceId, loserIds: [bobId] })
    expect(emitGameUpdated).toHaveBeenCalledWith(result)
  })

  it('keeps the offerer turn after Scrabble decline or cancellation and advances only after acceptance', async () => {
    const scrabbleGame = multiplayerGame({
      gameType: 'scrabble',
      players: [
        { userId: id(aliceId), username: 'alice', index: 0, isConnected: true },
        { userId: id(bobId), username: 'bob', index: 1, isConnected: true },
      ],
      gameState: {
        board: Array.from({ length: 15 }, () => Array(15).fill(null)),
        racks: {
          [aliceId]: [{ id: '?-1712345678901-blank01', letter: '?', value: 0, isBlank: true }],
          [bobId]: [{ id: 'b3fdd5f9-92bb-4efe-8f8e-9122d2f307df', letter: 'E', value: 1, isBlank: false }],
        },
        scores: { [aliceId]: 0, [bobId]: 0 },
        bag: [],
        infiniteLetters: true,
        usedPremiumSquares: [],
        pendingTrade: null,
        consecutivePasses: 0,
        givenUpUserIds: [],
        lastScoreEvent: null,
      },
    })
    Game.findOne.mockResolvedValue(scrabbleGame)
    Game.findById.mockResolvedValue(scrabbleGame)

    await gameService.makeMove(gameId, aliceId, {
      type: 'offerTrade', targetUserId: bobId, rackTileIds: ['?-1712345678901-blank01'],
    })
    const declinedOfferId = (scrabbleGame.gameState as { pendingTrade: { offerId: string } }).pendingTrade.offerId
    expect(scrabbleGame.currentTurnIndex).toBe(0)
    await gameService.makeMove(gameId, bobId, { type: 'respondTrade', offerId: declinedOfferId, accept: false })
    expect(scrabbleGame.currentTurnIndex).toBe(0)

    await gameService.makeMove(gameId, aliceId, {
      type: 'offerTrade', targetUserId: bobId, rackTileIds: ['?-1712345678901-blank01'],
    })
    const cancelledOfferId = (scrabbleGame.gameState as { pendingTrade: { offerId: string } }).pendingTrade.offerId
    await gameService.makeMove(gameId, aliceId, { type: 'cancelTrade', offerId: cancelledOfferId })
    expect(scrabbleGame.currentTurnIndex).toBe(0)

    await gameService.makeMove(gameId, aliceId, {
      type: 'offerTrade', targetUserId: bobId, rackTileIds: ['?-1712345678901-blank01'],
    })
    const acceptedOfferId = (scrabbleGame.gameState as { pendingTrade: { offerId: string } }).pendingTrade.offerId
    await gameService.makeMove(gameId, bobId, {
      type: 'respondTrade',
      offerId: acceptedOfferId,
      accept: true,
      rackTileIds: ['b3fdd5f9-92bb-4efe-8f8e-9122d2f307df'],
    })
    expect(scrabbleGame.currentTurnIndex).toBe(1)
    expect(scrabbleGame.currentTurn.toString()).toBe(bobId)
  })

  it('freezes Wisecracker completion statistics to active round participants', async () => {
    const winnerResponseId = 'a'.repeat(32)
    const wisecrackerGame = multiplayerGame({
      gameType: 'wisecracker',
      players: [
        { userId: id(aliceId), username: 'alice', index: 0, isConnected: true },
        { userId: id(bobId), username: 'bob', index: 1, isConnected: true },
        { userId: id(carolId), username: 'carol', index: 2, isConnected: true },
        { userId: id(waitingId), username: 'waiting', index: 3, isConnected: true },
      ],
      gameState: {
        phase: 'revealing',
        hostUserId: aliceId,
        maxScore: 1,
        chooserUserId: aliceId,
        chooserIndex: 0,
        activePlayerIds: [aliceId, bobId, carolId],
        waitingPlayerIds: [waitingId],
        prompt: 'A _.',
        answerSlots: 1,
        submittedAnswers: { [bobId]: ['first'], [carolId]: ['second'] },
        responseIds: { [bobId]: winnerResponseId, [carolId]: 'b'.repeat(32) },
        answerOrder: [bobId, carolId],
        revealedCount: 2,
        scores: { [aliceId]: 0, [bobId]: 0, [carolId]: 0, [waitingId]: 0 },
        roundWinnerUserId: null,
        matchWinnerUserId: null,
      },
    })
    Game.findOne.mockResolvedValue(wisecrackerGame)
    Game.findById.mockResolvedValue(wisecrackerGame)
    Game.findOneAndUpdate.mockResolvedValue(wisecrackerGame)

    const completed = await gameService.makeMove(gameId, aliceId, {
      type: 'selectRoundWinner', responseId: winnerResponseId,
    })
    expect(completed.status).toBe('completed')
    expect(completed.statsParticipantIds?.map((playerId: { toString(): string }) => playerId.toString())).toEqual([
      aliceId,
      bobId,
      carolId,
    ])

    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(userService.updateStatsAfterGame).toHaveBeenCalledWith({
      winnerId: bobId,
      loserIds: [aliceId, carolId],
    })
    expect(userService.updateStatsAfterGame).not.toHaveBeenCalledWith(
      expect.objectContaining({ loserIds: expect.arrayContaining([waitingId]) })
    )
  })
})
