import { presentGameForUser, presentMoveHistory } from './gamePresenter'

describe('presentGameForUser', () => {
  it('uses positive DTO allowlists for top-level and nested document fields', () => {
    const presented = presentGameForUser({
      _id: 'game1',
      gameType: 'ticTacToe',
      status: 'active',
      gameCode: 'ABCDEFGH',
      players: [{ userId: 'user1', username: 'alice', index: 0, isConnected: true, disconnectCount: 7, _id: 'player-subdoc' }],
      gameState: { board: Array(9).fill(null) },
      moveHistory: [{ moveNumber: 1, playerId: 'user1', playerName: 'alice', move: '0', timestamp: 'now', _id: 'move-subdoc' }],
      chatMessages: [{ messageId: 'message1', userId: 'user1', username: 'alice', text: 'hello', timestamp: 'now', _id: 'chat-subdoc' }],
      result: { winner: 'user1', winnerName: 'alice', isDraw: false, winType: 'line', verification: 'server', internalResult: true },
      metadata: { mode: 'multiplayer', ratedGame: false, internalMetadata: true },
      statsProcessedAt: 'secret-internal-marker',
      __v: 9,
      futureInternalField: 'must not cross the boundary',
    }, 'user1')

    expect(presented).not.toHaveProperty('__v')
    expect(presented.revision).toBe(9)
    expect(presented).not.toHaveProperty('statsProcessedAt')
    expect(presented).not.toHaveProperty('futureInternalField')
    expect((presented.players as Array<Record<string, unknown>>)[0]).toEqual({
      userId: 'user1', username: 'alice', index: 0, isConnected: true,
    })
    expect((presented.moveHistory as Array<Record<string, unknown>>)[0]).not.toHaveProperty('_id')
    expect((presented.chatMessages as Array<Record<string, unknown>>)[0]).not.toHaveProperty('_id')
    expect(presented.result).not.toHaveProperty('internalResult')
    expect(presented.metadata).not.toHaveProperty('internalMetadata')
  })

  it('normalizes missing or unsafe revisions to zero', () => {
    expect(presentGameForUser({ gameType: 'ticTacToe', gameState: {}, revision: 4 }, 'user1').revision).toBe(4)
    expect(presentGameForUser({ gameType: 'ticTacToe', gameState: {}, __v: -1 }, 'user1').revision).toBe(0)
    expect(presentGameForUser({ gameType: 'ticTacToe', gameState: {}, __v: Number.MAX_SAFE_INTEGER + 1 }, 'user1').revision).toBe(0)
  })

  it('positively allowlists state fields for each game type', () => {
    const presented = presentGameForUser({
      gameType: 'ticTacToe',
      gameState: {
        board: Array(9).fill(null),
        currentSymbol: 'X',
        futureHiddenState: 'must not cross the boundary',
      },
    }, 'user1')

    expect(presented.gameState).toEqual({ board: Array(9).fill(null), currentSymbol: 'X' })
  })

  it('exposes only the public replay descriptor and deterministic state counters', () => {
    const presented = presentGameForUser({
      gameType: 'snake',
      replay: {
        version: 1,
        seed: 'a'.repeat(64),
        startedAt: 'now',
        internalReplayField: 'hidden',
      },
      gameState: {
        width: 12,
        height: 12,
        tick: 7,
        score: 3,
        internalEngineField: 'hidden',
      },
    }, 'user1')

    expect(presented.replay).toEqual({ version: 1, seed: 'a'.repeat(64), startedAt: 'now' })
    expect(presented.gameState).toEqual({ width: 12, height: 12, tick: 7, score: 3 })
  })

  it('does not pass through malformed or unknown game state', () => {
    expect(presentGameForUser({ gameType: 'futureGame', gameState: { secret: true } }, 'user1').gameState).toEqual({})
    expect(presentGameForUser({ gameType: 'ticTacToe', gameState: 'invalid' }, 'user1').gameState).toEqual({})
  })

  it('embeds only the newest bounded move-history window in realtime DTOs', () => {
    const presented = presentGameForUser({
      gameType: 'ticTacToe',
      gameState: {},
      moveHistory: Array.from({ length: 101 }, (_, index) => ({
        moveNumber: index + 1,
        playerId: 'user1',
        playerName: 'alice',
        move: '0',
        timestamp: 'now',
      })),
    }, 'user1')
    const moves = presented.moveHistory as Array<Record<string, unknown>>

    expect(moves).toHaveLength(100)
    expect(moves[0].moveNumber).toBe(2)
    expect(moves[99].moveNumber).toBe(101)
  })

  it('exposes only the caller Scrabble rack and a bag count', () => {
    const presented = presentGameForUser({
      gameType: 'scrabble',
      gameState: {
        racks: {
          user1: [{ id: 'a', letter: 'A', internalTileSecret: 'hidden' }],
          user2: [{ id: 'z', letter: 'Z' }, { id: 'e', letter: 'E' }],
        },
        bag: [{ id: 'b' }, { id: 'c' }],
        pendingTrade: {
          fromUserId: 'user1',
          targetUserId: 'user2',
          offeredTiles: [{ id: 'a', letter: 'A', internalTileSecret: 'hidden' }],
          internalTradeSecret: 'hidden',
        },
      },
    }, 'user1')
    const state = presented.gameState as Record<string, unknown>

    expect(state.racks).toEqual({ user1: [{ id: 'a', letter: 'A' }] })
    expect(state.rackCounts).toEqual({ user1: 1, user2: 2 })
    expect(state.bag).toBeUndefined()
    expect(state.bagCount).toBe(2)
    expect(state.pendingTrade).toEqual(expect.objectContaining({ offeredTileCount: 1, offeredTiles: [{ id: 'a', letter: 'A' }] }))
    expect(state.pendingTrade).not.toHaveProperty('internalTradeSecret')
  })

  it('hides offered Scrabble tiles from uninvolved players', () => {
    const presented = presentGameForUser({
      gameType: 'scrabble',
      gameState: {
        racks: { user1: [{ id: 'a' }], user2: [{ id: 'b' }], user3: [] },
        bag: [],
        pendingTrade: { fromUserId: 'user1', targetUserId: 'user2', offeredTiles: [{ id: 'a' }] },
      },
    }, 'user3')
    const trade = (presented.gameState as Record<string, unknown>).pendingTrade as Record<string, unknown>

    expect(trade.offeredTiles).toBeUndefined()
    expect(trade.offeredTileCount).toBe(1)
  })

  it('publishes anonymous Wisecracker responses and only the caller private answer', () => {
    const presented = presentGameForUser({
      gameType: 'wisecracker',
      gameState: {
        phase: 'revealing',
        activePlayerIds: ['chooser', 'user1', 'user2'],
        submittedAnswers: { user1: ['mine'], user2: ['theirs'] },
        responseIds: { user1: 'a'.repeat(32), user2: 'b'.repeat(32) },
        answerOrder: ['user2', 'user1'],
        revealedCount: 1,
        roundWinnerUserId: null,
      },
    }, 'user1')
    const state = presented.gameState as Record<string, unknown>

    expect(state.submissionStatus).toEqual({ chooser: false, user1: true, user2: true })
    expect(state.myAnswers).toEqual(['mine'])
    expect(state.revealedResponses).toEqual([{ responseId: 'b'.repeat(32), answers: ['theirs'] }])
    expect(state.submittedAnswers).toBeUndefined()
    expect(state.responseIds).toBeUndefined()
    expect(state.answerOrder).toBeUndefined()
  })

  it('hides Property Management card order', () => {
    const state = presentGameForUser({
      gameType: 'propertyManagement',
      gameState: { chanceCardOrder: [3, 1, 2], communityChestCardOrder: [2, 1], chanceCardIndex: 1 },
    }, 'user1').gameState as Record<string, unknown>

    expect(state.chanceCardOrder).toBeUndefined()
    expect(state.communityChestCardOrder).toBeUndefined()
    expect(state.chanceCardIndex).toBe(1)
  })

  it('exposes only the caller UNO hand and card counts', () => {
    const state = presentGameForUser({
      gameType: 'uno',
      players: [{ userId: 'user1' }, { userId: 'user2' }],
      gameState: { hands: [[{ value: '1' }], [{ value: '2' }, { value: '3' }]], deck: [{ value: '4' }] },
    }, 'user2').gameState as Record<string, unknown>

    expect(state.hand).toEqual([{ value: '2' }, { value: '3' }])
    expect(state.handCounts).toEqual([1, 2])
    expect(state.deckCount).toBe(1)
    expect(state.hands).toBeUndefined()
    expect(state.deck).toBeUndefined()
  })

  it('exposes only the caller President hand', () => {
    const state = presentGameForUser({
      gameType: 'president',
      players: [{ userId: 'user1' }, { userId: 'user2' }],
      gameState: { hands: [['ace'], ['king', 'queen']], deck: ['jack'] },
    }, 'user1').gameState as Record<string, unknown>

    expect(state.hand).toEqual(['ace'])
    expect(state.handCounts).toEqual([1, 2])
    expect(state.deckCount).toBe(1)
    expect(state.hands).toBeUndefined()
    expect(state.deck).toBeUndefined()
  })

  it('snapshots every game-state DTO field boundary', () => {
    const fixtures: Record<string, Record<string, unknown>> = {
      ticTacToe: { board: [], currentSymbol: 'X', hidden: true },
      chess: { board: [], enPassantTarget: null, castlingRights: {}, hidden: true },
      checkers: { board: [], mustJump: false, hidden: true },
      wisecracker: {
        phase: 'submitting',
        activePlayerIds: ['user1', 'user2'],
        submittedAnswers: { user1: ['mine'] },
        responseIds: { user1: 'a'.repeat(32) },
        answerOrder: [],
        revealedCount: 0,
        hidden: true,
      },
      scrabble: {
        board: [],
        racks: { user1: [] },
        bag: [],
        scores: {},
        pendingTrade: null,
        hidden: true,
      },
      propertyManagement: {
        phase: 'playing',
        playerStates: {},
        chanceCardOrder: [2, 1],
        communityChestCardOrder: [1, 2],
        hidden: true,
      },
      uno: {
        hands: [[{ color: 'red', value: '1', type: 'NUMBER' }], []],
        deck: [{ color: 'blue', value: '2', type: 'NUMBER' }],
        discardPile: [],
        hidden: true,
      },
      president: { hands: [['ace'], []], deck: ['king'], currentTrick: [], rankings: [], hidden: true },
      snake: {
        width: 12,
        height: 12,
        snake: [{ x: 1, y: 1 }],
        direction: 'right',
        pendingDirection: 'right',
        food: { x: 2, y: 2 },
        score: 0,
        isGameOver: false,
        tickMs: 120,
        hidden: true,
      },
      mazeChase: {
        width: 21,
        height: 21,
        maze: [],
        player: {},
        ghosts: [],
        pellets: [],
        powerPellets: [],
        fruit: null,
        score: 0,
        lives: 3,
        level: 1,
        frightenedUntil: 0,
        isGameOver: false,
        tickMs: 150,
        hidden: true,
      },
    }

    const fieldBoundary = Object.fromEntries(Object.entries(fixtures).map(([gameType, gameState]) => {
      const presented = presentGameForUser({
        gameType,
        players: [{ userId: 'user1' }, { userId: 'user2' }],
        gameState,
      }, 'user1')
      return [gameType, Object.keys(presented.gameState as Record<string, unknown>).sort()]
    }))

    expect(fieldBoundary).toMatchInlineSnapshot(`
{
  "checkers": [
    "board",
    "mustJump",
  ],
  "chess": [
    "board",
    "castlingRights",
    "enPassantTarget",
  ],
  "mazeChase": [
    "frightenedUntil",
    "fruit",
    "ghosts",
    "height",
    "isGameOver",
    "level",
    "lives",
    "maze",
    "pellets",
    "player",
    "powerPellets",
    "score",
    "tickMs",
    "width",
  ],
  "president": [
    "currentTrick",
    "deckCount",
    "hand",
    "handCounts",
    "rankings",
  ],
  "propertyManagement": [
    "phase",
    "playerStates",
  ],
  "scrabble": [
    "bagCount",
    "board",
    "pendingTrade",
    "rackCounts",
    "racks",
    "scores",
  ],
  "snake": [
    "direction",
    "food",
    "height",
    "isGameOver",
    "pendingDirection",
    "score",
    "snake",
    "tickMs",
    "width",
  ],
  "ticTacToe": [
    "board",
    "currentSymbol",
  ],
  "uno": [
    "deckCount",
    "discardPile",
    "hand",
    "handCounts",
  ],
  "wisecracker": [
    "activePlayerIds",
    "myAnswers",
    "phase",
    "revealedCount",
    "revealedResponses",
    "roundWinnerResponseId",
    "submissionStatus",
  ],
}
`)
  })

  it('snapshots hidden-state views by recipient and reveal phase', () => {
    const wisecrackerState = {
      phase: 'revealing',
      activePlayerIds: ['chooser', 'user1', 'user2'],
      submittedAnswers: { user1: ['mine'], user2: ['theirs'] },
      responseIds: { user1: 'a'.repeat(32), user2: 'b'.repeat(32) },
      answerOrder: ['user2', 'user1'],
      revealedCount: 1,
      roundWinnerUserId: 'user2',
      internalAnswerOwnerMap: { hidden: true },
    }
    const scrabbleState = {
      racks: {
        user1: [{ id: 'a', letter: 'A', value: 1, isBlank: false, hidden: true }],
        user2: [{ id: 'b', letter: 'B', value: 3, isBlank: false }],
        observer: [],
      },
      bag: [{ id: 'z' }],
      pendingTrade: {
        offerId: 'offer-1',
        fromUserId: 'user1',
        targetUserId: 'user2',
        offeredTiles: [{ id: 'a', letter: 'A', value: 1, isBlank: false, hidden: true }],
        hidden: true,
      },
    }
    const scrabbleGame = { gameType: 'scrabble', gameState: scrabbleState }

    const views = {
      wisecrackerSubmitterDuringReveal: presentGameForUser({ gameType: 'wisecracker', gameState: wisecrackerState }, 'user1').gameState,
      wisecrackerRevealedAnswerOwner: presentGameForUser({ gameType: 'wisecracker', gameState: wisecrackerState }, 'user2').gameState,
      scrabbleOfferSender: presentGameForUser(scrabbleGame, 'user1').gameState,
      scrabbleOfferTarget: presentGameForUser(scrabbleGame, 'user2').gameState,
      scrabbleObserver: presentGameForUser(scrabbleGame, 'observer').gameState,
    }

    expect(JSON.stringify(views)).not.toContain('internalAnswerOwnerMap')
    expect(JSON.stringify(views)).not.toContain('"hidden"')
    expect(views).toMatchInlineSnapshot(`
{
  "scrabbleObserver": {
    "bagCount": 1,
    "pendingTrade": {
      "fromUserId": "user1",
      "offerId": "offer-1",
      "offeredTileCount": 1,
      "targetUserId": "user2",
    },
    "rackCounts": {
      "observer": 0,
      "user1": 1,
      "user2": 1,
    },
    "racks": {
      "observer": [],
    },
  },
  "scrabbleOfferSender": {
    "bagCount": 1,
    "pendingTrade": {
      "fromUserId": "user1",
      "offerId": "offer-1",
      "offeredTileCount": 1,
      "offeredTiles": [
        {
          "id": "a",
          "isBlank": false,
          "letter": "A",
          "value": 1,
        },
      ],
      "targetUserId": "user2",
    },
    "rackCounts": {
      "observer": 0,
      "user1": 1,
      "user2": 1,
    },
    "racks": {
      "user1": [
        {
          "id": "a",
          "isBlank": false,
          "letter": "A",
          "value": 1,
        },
      ],
    },
  },
  "scrabbleOfferTarget": {
    "bagCount": 1,
    "pendingTrade": {
      "fromUserId": "user1",
      "offerId": "offer-1",
      "offeredTileCount": 1,
      "offeredTiles": [
        {
          "id": "a",
          "isBlank": false,
          "letter": "A",
          "value": 1,
        },
      ],
      "targetUserId": "user2",
    },
    "rackCounts": {
      "observer": 0,
      "user1": 1,
      "user2": 1,
    },
    "racks": {
      "user2": [
        {
          "id": "b",
          "isBlank": false,
          "letter": "B",
          "value": 3,
        },
      ],
    },
  },
  "wisecrackerRevealedAnswerOwner": {
    "activePlayerIds": [
      "chooser",
      "user1",
      "user2",
    ],
    "phase": "revealing",
    "revealedCount": 1,
    "revealedResponses": [
      {
        "answers": [
          "theirs",
        ],
        "responseId": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ],
    "roundWinnerResponseId": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "submissionStatus": {
      "chooser": false,
      "user1": true,
      "user2": true,
    },
  },
  "wisecrackerSubmitterDuringReveal": {
    "activePlayerIds": [
      "chooser",
      "user1",
      "user2",
    ],
    "myAnswers": [
      "mine",
    ],
    "phase": "revealing",
    "revealedCount": 1,
    "revealedResponses": [
      {
        "answers": [
          "theirs",
        ],
        "responseId": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ],
    "roundWinnerResponseId": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "submissionStatus": {
      "chooser": false,
      "user1": true,
      "user2": true,
    },
  },
}
`)
  })
})

describe('presentMoveHistory', () => {
  it('applies the same positive field allowlist to the standalone history endpoint', () => {
    expect(presentMoveHistory([{
      moveNumber: 1,
      playerId: 'user1',
      playerName: 'alice',
      move: '0',
      timestamp: 'now',
      _id: 'internal-subdocument-id',
      futureInternalField: 'hidden',
    }])).toEqual([{
      moveNumber: 1,
      playerId: 'user1',
      playerName: 'alice',
      move: '0',
      timestamp: 'now',
    }])
  })
})
