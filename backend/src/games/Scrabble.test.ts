import { makeMoveEventSchema } from '../utils/validators'
import { Scrabble, ScrabbleAction, ScrabbleState, ScrabbleTile } from './Scrabble'

const players = [
  { userId: 'user1', username: 'One', isConnected: true },
  { userId: 'user2', username: 'Two', isConnected: true },
]

const contractGameId = '507f1f77bcf86cd799439010'
const contractHostId = '507f1f77bcf86cd799439011'
const contractGuestId = '507f1f77bcf86cd799439012'
const legacyBlankId = '?-1712345678901-blank01'
const legacyNormalId = 'I-1712345678902-normal01'
const uuidTileId = '1b63f9d1-6e14-4f3d-84ef-76468cb29d1a'
const contractPlayers = [
  { userId: contractHostId, username: 'Host', isConnected: true },
  { userId: contractGuestId, username: 'Guest', isConnected: true },
]

function tile(id: string, letter: string, value: number): ScrabbleTile {
  return { id, letter, value, isBlank: letter === '?' }
}

function stateWithPlayers(infiniteLetters = false): ScrabbleState {
  let state = Scrabble.createInitialState('user1', infiniteLetters)
  state = Scrabble.addPlayer(state, 'user2')
  state.racks.user1 = [tile('q1', 'Q', 10), tile('i1', 'I', 1), tile('z1', 'Z', 10), tile('a1', 'A', 1), tile('b1', 'B', 3), tile('c1', 'C', 3), tile('d1', 'D', 2)]
  state.racks.user2 = [tile('e1', 'E', 1), tile('r1', 'R', 1), tile('s1', 'S', 1), tile('t1', 'T', 1), tile('u1', 'U', 1), tile('v1', 'V', 4), tile('w1', 'W', 4)]
  state.bag = [tile('n1', 'N', 1), tile('o1', 'O', 1), tile('p1', 'P', 3), tile('l1', 'L', 1)]
  return state
}

function validatedScrabbleAction(move: unknown): ScrabbleAction {
  return makeMoveEventSchema.parse({ gameId: contractGameId, move }).move as ScrabbleAction
}

function contractState(): ScrabbleState {
  let state = Scrabble.createInitialState(contractHostId)
  state = Scrabble.addPlayer(state, contractGuestId)
  state.racks[contractHostId] = [
    tile(legacyBlankId, '?', 0),
    tile(legacyNormalId, 'I', 1),
    tile(uuidTileId, 'Q', 10),
  ]
  state.racks[contractGuestId] = [
    tile('b3fdd5f9-92bb-4efe-8f8e-9122d2f307df', 'E', 1),
    tile('R-1712345678903-return01', 'R', 1),
  ]
  state.bag = [
    tile('6bf3a13f-e4ba-4fb8-890f-72d38fe47218', 'N', 1),
    tile('O-1712345678904-bag0001', 'O', 1),
    tile('f39f2707-d8a1-4392-83fe-ec922e3d5bb2', 'P', 3),
  ]
  return state
}

describe('Scrabble', () => {
  it('passes legacy blank, legacy normal, and UUID placements through the socket schema into the real engine', () => {
    const blankState = contractState()
    const blankMove = validatedScrabbleAction({
      type: 'placeTiles',
      placements: [
        { rackTileId: legacyBlankId, row: 7, col: 7, blankLetter: 'q' },
        { rackTileId: legacyNormalId, row: 7, col: 8 },
      ],
    })
    const blankResult = Scrabble.applyAction(
      blankState,
      blankMove,
      contractHostId,
      contractPlayers,
      0,
      1
    )

    expect(blankResult.state.board[7][7]?.tile).toMatchObject({ id: legacyBlankId, letter: 'Q', isBlank: true })
    expect(blankResult.state.lastScoreEvent?.words[0].word).toBe('qi')

    const uuidState = contractState()
    const uuidMove = validatedScrabbleAction({
      type: 'placeTiles',
      placements: [
        { rackTileId: uuidTileId, row: 7, col: 7 },
        { rackTileId: legacyNormalId, row: 7, col: 8 },
      ],
    })
    const uuidResult = Scrabble.applyAction(
      uuidState,
      uuidMove,
      contractHostId,
      contractPlayers,
      0,
      1
    )

    expect(uuidResult.state.board[7][7]?.tile.id).toBe(uuidTileId)
    expect(uuidResult.state.lastScoreEvent?.words[0].word).toBe('qi')
  })

  it('passes blank and UUID exchanges and trades through validation and rejects a consumed response as stale', () => {
    const exchangeState = contractState()
    const exchange = validatedScrabbleAction({
      type: 'exchangeWithBag',
      rackTileIds: [legacyBlankId, uuidTileId],
    })
    const exchanged = Scrabble.applyAction(
      exchangeState,
      exchange,
      contractHostId,
      contractPlayers,
      0,
      1
    )
    expect(exchanged.state.racks[contractHostId].map((rackTile) => rackTile.id)).not.toEqual(
      expect.arrayContaining([legacyBlankId, uuidTileId])
    )

    const tradeState = contractState()
    const offered = Scrabble.applyAction(
      tradeState,
      validatedScrabbleAction({
        type: 'offerTrade',
        targetUserId: contractGuestId,
        rackTileIds: [legacyBlankId],
      }),
      contractHostId,
      contractPlayers,
      0,
      1
    )
    const offerId = offered.state.pendingTrade?.offerId
    expect(offerId).toMatch(/^[0-9a-f-]{36}$/)

    const acceptedAction = validatedScrabbleAction({
      type: 'respondTrade',
      offerId,
      accept: true,
      rackTileIds: ['b3fdd5f9-92bb-4efe-8f8e-9122d2f307df'],
    })
    const accepted = Scrabble.applyAction(
      offered.state,
      acceptedAction,
      contractGuestId,
      contractPlayers,
      0,
      2
    )
    expect(accepted.state.racks[contractGuestId].map((rackTile) => rackTile.id)).toContain(legacyBlankId)
    expect(accepted.state.racks[contractHostId].map((rackTile) => rackTile.id)).toContain(
      'b3fdd5f9-92bb-4efe-8f8e-9122d2f307df'
    )

    const acceptedSnapshot = JSON.stringify(accepted.state)
    expect(() => Scrabble.applyAction(
      accepted.state,
      acceptedAction,
      contractGuestId,
      contractPlayers,
      0,
      3
    )).toThrow(expect.objectContaining({ code: 'STALE_TRADE_OFFER', statusCode: 409 }))
    expect(JSON.stringify(accepted.state)).toBe(acceptedSnapshot)
  })

  it('creates a persistent 15x15 game state with racks and weighted finite bag', () => {
    const state = Scrabble.createInitialState('user1')

    expect(state.board).toHaveLength(15)
    expect(state.board[0]).toHaveLength(15)
    expect(state.racks.user1).toHaveLength(7)
    expect(state.bag.length).toBe(93)
    expect(state.infiniteLetters).toBe(false)
    expect([...state.racks.user1, ...state.bag].every((rackTile) => (
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(rackTile.id)
    ))).toBe(true)
  })

  it('allows up to four players and rejects a fifth', () => {
    let state = Scrabble.createInitialState('user1')
    state = Scrabble.addPlayer(state, 'user2')
    state = Scrabble.addPlayer(state, 'user3')
    state = Scrabble.addPlayer(state, 'user4')

    expect(Object.keys(state.racks)).toHaveLength(4)
    expect(() => Scrabble.addPlayer(state, 'user5')).toThrow('Game is full')
  })

  it('accepts requested two-letter words on the center square', () => {
    const state = stateWithPlayers()
    const result = Scrabble.applyAction(
      state,
      { type: 'placeTiles', placements: [{ rackTileId: 'q1', row: 7, col: 7 }, { rackTileId: 'i1', row: 7, col: 8 }] },
      'user1',
      players,
      0,
      1
    )

    expect(result.state.board[7][7]?.tile.letter).toBe('Q')
    expect(result.state.lastScoreEvent?.words[0].word).toBe('qi')
    expect(result.state.scores.user1).toBe(11)
    expect(result.state.lastScoreEvent?.words[0].wordMultiplier).toBe(1)
  })

  it('accepts real words and common abbreviations with recognized meanings', () => {
    let state = stateWithPlayers()
    state.racks.user1 = [tile('c1', 'C', 3), tile('a1', 'A', 1), tile('t1', 'T', 1)]

    expect(() => Scrabble.applyAction(
      state,
      { type: 'placeTiles', placements: [{ rackTileId: 'c1', row: 7, col: 7 }, { rackTileId: 'a1', row: 7, col: 8 }, { rackTileId: 't1', row: 7, col: 9 }] },
      'user1',
      players,
      0,
      1
    )).not.toThrow()

    state = stateWithPlayers()
    state.racks.user1 = [tile('n1', 'N', 1), tile('a1', 'A', 1), tile('s1', 'S', 1), tile('a2', 'A', 1)]

    expect(() => Scrabble.applyAction(
      state,
      { type: 'placeTiles', placements: [{ rackTileId: 'n1', row: 7, col: 7 }, { rackTileId: 'a1', row: 7, col: 8 }, { rackTileId: 's1', row: 7, col: 9 }, { rackTileId: 'a2', row: 7, col: 10 }] },
      'user1',
      players,
      0,
      1
    )).not.toThrow()
  })

  it('rejects fake two-letter and longer words', () => {
    let state = stateWithPlayers()
    state.racks.user1 = [tile('q1', 'Q', 10), tile('z1', 'Z', 10)]

    expect(() => Scrabble.applyAction(
      state,
      { type: 'placeTiles', placements: [{ rackTileId: 'q1', row: 7, col: 7 }, { rackTileId: 'z1', row: 7, col: 8 }] },
      'user1',
      players,
      0,
      1
    )).toThrow('Word not allowed')

    state = stateWithPlayers()
    state.racks.user1 = [tile('a1', 'A', 1), tile('s1', 'S', 1), tile('d1', 'D', 2), tile('f1', 'F', 4)]

    expect(() => Scrabble.applyAction(
      state,
      { type: 'placeTiles', placements: [{ rackTileId: 'a1', row: 7, col: 7 }, { rackTileId: 's1', row: 7, col: 8 }, { rackTileId: 'd1', row: 7, col: 9 }, { rackTileId: 'f1', row: 7, col: 10 }] },
      'user1',
      players,
      0,
      1
    )).toThrow('Word not allowed')
  })

  it('rejects a multi-word move if any formed word is invalid', () => {
    const state = stateWithPlayers()
    state.board[6][7] = { tile: tile('old-q', 'Q', 10), placedBy: 'user2' }
    state.board[8][7] = { tile: tile('old-z', 'Z', 10), placedBy: 'user2' }
    state.racks.user1 = [tile('a1', 'A', 1), tile('t1', 'T', 1)]

    expect(() => Scrabble.applyAction(
      state,
      { type: 'placeTiles', placements: [{ rackTileId: 'a1', row: 7, col: 7 }, { rackTileId: 't1', row: 7, col: 8 }] },
      'user1',
      players,
      0,
      1
    )).toThrow('Word not allowed')
  })

  it('still requires the center square for the first move', () => {
    const state = stateWithPlayers()

    expect(() => Scrabble.applyAction(
      state,
      { type: 'placeTiles', placements: [{ rackTileId: 'q1', row: 7, col: 6 }, { rackTileId: 'i1', row: 7, col: 7 }] },
      'user1',
      players,
      0,
      1
    )).not.toThrow()

    expect(() => Scrabble.applyAction(
      state,
      { type: 'placeTiles', placements: [{ rackTileId: 'q1', row: 6, col: 6 }, { rackTileId: 'i1', row: 6, col: 7 }] },
      'user1',
      players,
      0,
      1
    )).toThrow('center square')
  })

  it('scores a main word and a crossing word with letter multipliers before word multipliers', () => {
    const state = stateWithPlayers()
    state.board[6][7] = { tile: tile('old-a', 'A', 1), placedBy: 'user2' }
    state.board[8][7] = { tile: tile('old-t', 'T', 1), placedBy: 'user2' }

    const result = Scrabble.applyAction(
      state,
      { type: 'placeTiles', placements: [{ rackTileId: 'q1', row: 7, col: 6 }, { rackTileId: 'i1', row: 7, col: 7 }] },
      'user1',
      players,
      0,
      1
    )

    expect(result.state.lastScoreEvent?.words.map((word) => word.word).sort()).toEqual(['ait', 'qi'])
    expect(result.state.lastScoreEvent?.total).toBe(14)
    expect(result.state.scores.user1).toBe(14)
  })

  it('does not reuse a consumed premium square', () => {
    const state = stateWithPlayers()
    state.board[7][7] = { tile: tile('old-i', 'I', 1), placedBy: 'user2' }
    state.usedPremiumSquares = ['7,7']

    const result = Scrabble.applyAction(
      state,
      { type: 'placeTiles', placements: [{ rackTileId: 'q1', row: 7, col: 6 }] },
      'user1',
      players,
      0,
      1
    )

    expect(result.state.lastScoreEvent?.total).toBe(11)
  })

  it('exchanges rack tiles with a finite bag and consumes the turn', () => {
    const state = stateWithPlayers()
    const result = Scrabble.applyAction(
      state,
      { type: 'exchangeWithBag', rackTileIds: ['q1', 'i1'] },
      'user1',
      players,
      0,
      1
    )

    expect(result.state.racks.user1).toHaveLength(7)
    expect(result.state.racks.user1.some((rackTile) => rackTile.id === 'q1')).toBe(false)
    expect(result.completed).toBe(false)
  })

  it('supports equal-count player trades with target-selected response tiles', () => {
    let state = stateWithPlayers()
    const offer = Scrabble.applyAction(
      state,
      { type: 'offerTrade', targetUserId: 'user2', rackTileIds: ['q1', 'i1'] },
      'user1',
      players,
      0,
      1
    )
    state = offer.state
    const offerId = state.pendingTrade?.offerId
    expect(offerId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

    const accepted = Scrabble.applyAction(
      state,
      { type: 'respondTrade', offerId, accept: true, rackTileIds: ['e1', 'r1'] },
      'user2',
      players,
      0,
      2
    )

    expect(accepted.state.pendingTrade).toBeNull()
    expect(accepted.state.racks.user1.map((rackTile) => rackTile.id)).toContain('e1')
    expect(accepted.state.racks.user2.map((rackTile) => rackTile.id)).toContain('q1')
  })

  it('rejects exchanges larger than the finite bag without changing the rack', () => {
    const state = stateWithPlayers()
    state.bag = [tile('n1', 'N', 1)]

    expect(() => Scrabble.applyAction(
      state,
      { type: 'exchangeWithBag', rackTileIds: ['q1', 'i1'] },
      'user1',
      players,
      0,
      1
    )).toThrow('Not enough tiles left in the bag')
    expect(state.racks.user1.map((rackTile) => rackTile.id)).toEqual(['q1', 'i1', 'z1', 'a1', 'b1', 'c1', 'd1'])
  })

  it('rejects offline trade targets and targets with too few return tiles', () => {
    const state = stateWithPlayers()
    const connectedPlayers = [
      { ...players[0], isConnected: true },
      { ...players[1], isConnected: false },
    ]

    expect(() => Scrabble.applyAction(
      state,
      { type: 'offerTrade', targetUserId: 'user2', rackTileIds: ['q1'] },
      'user1',
      connectedPlayers,
      0,
      1
    )).toThrow('offline player')

    expect(() => Scrabble.applyAction(
      state,
      { type: 'offerTrade', targetUserId: 'user2', rackTileIds: ['q1'] },
      'user1',
      players.map(({ isConnected: _isConnected, ...player }) => player),
      0,
      1
    )).toThrow('offline player')

    state.racks.user2 = [tile('e1', 'E', 1)]
    connectedPlayers[1].isConnected = true
    expect(() => Scrabble.applyAction(
      state,
      { type: 'offerTrade', targetUserId: 'user2', rackTileIds: ['q1', 'i1'] },
      'user1',
      connectedPlayers,
      0,
      1
    )).toThrow('does not have enough tiles')
  })

  it('requires the exact offer ID for modern trade responses', () => {
    const state = Scrabble.applyAction(
      stateWithPlayers(),
      { type: 'offerTrade', targetUserId: 'user2', rackTileIds: ['q1'] },
      'user1',
      players,
      0,
      1
    ).state

    for (const offerId of [undefined, '69f41c04-a21a-4c10-a8fd-d6c4ced43f14']) {
      try {
        Scrabble.applyAction(
          state,
          { type: 'respondTrade', offerId, accept: false },
          'user2',
          players,
          0,
          2
        )
        throw new Error('Expected stale trade rejection')
      } catch (error) {
        expect(error).toMatchObject({ code: 'STALE_TRADE_OFFER', statusCode: 409 })
      }
    }
  })

  it('reports a stale offer before revealing that a replacement targets someone else', () => {
    const threePlayers = [
      ...players,
      { userId: 'user3', username: 'Three', isConnected: true },
    ]
    const state = Scrabble.addPlayer(stateWithPlayers(), 'user3')
    state.pendingTrade = {
      offerId: '69f41c04-a21a-4c10-a8fd-d6c4ced43f15',
      fromUserId: 'user1',
      targetUserId: 'user3',
      offeredTiles: [state.racks.user1[0]],
    }

    expect(() => Scrabble.applyAction(
      state,
      {
        type: 'respondTrade',
        offerId: '69f41c04-a21a-4c10-a8fd-d6c4ced43f14',
        accept: false,
      },
      'user2',
      threePlayers,
      0,
      2
    )).toThrow(expect.objectContaining({ code: 'STALE_TRADE_OFFER', statusCode: 409 }))
  })

  it('allows a missing offer ID only for a legacy pending trade without one', () => {
    const state = stateWithPlayers()
    state.pendingTrade = {
      fromUserId: 'user1',
      targetUserId: 'user2',
      offeredTiles: [state.racks.user1[0]],
    }

    const declined = Scrabble.applyAction(
      state,
      { type: 'respondTrade', accept: false },
      'user2',
      players,
      0,
      2
    )
    expect(declined.state.pendingTrade).toBeNull()

    expect(() => Scrabble.applyAction(
      state,
      { type: 'respondTrade', offerId: '69f41c04-a21a-4c10-a8fd-d6c4ced43f14', accept: false },
      'user2',
      players,
      0,
      2
    )).toThrow('no longer active')
  })

  it('allows the offerer or host to cancel, but rejects another player', () => {
    const threePlayers = [
      { userId: 'user1', username: 'One', isConnected: true },
      { userId: 'user2', username: 'Two', isConnected: true },
      { userId: 'user3', username: 'Three', isConnected: true },
    ]
    let state = Scrabble.addPlayer(stateWithPlayers(), 'user3')
    state.racks.user3 = [tile('x1', 'X', 8), tile('y1', 'Y', 4)]
    state = Scrabble.applyAction(
      state,
      { type: 'offerTrade', targetUserId: 'user3', rackTileIds: ['e1'] },
      'user2',
      threePlayers,
      1,
      1,
      'user1'
    ).state
    const offerId = state.pendingTrade?.offerId

    expect(() => Scrabble.applyAction(
      state,
      { type: 'cancelTrade', offerId },
      'user3',
      threePlayers,
      1,
      2,
      'user1'
    )).toThrow('Only the offerer or room host')

    const hostCancelled = Scrabble.applyAction(
      state,
      { type: 'cancelTrade', offerId },
      'user1',
      threePlayers,
      1,
      2,
      'user1'
    )
    expect(hostCancelled.state.pendingTrade).toBeNull()

    const offeredAgain = Scrabble.applyAction(
      state,
      { type: 'cancelTrade', offerId },
      'user2',
      threePlayers,
      1,
      2,
      'user1'
    )
    expect(offeredAgain.state.pendingTrade).toBeNull()
  })

  it('ends finite games after bag exhaustion and a full active-player pass cycle', () => {
    let state = stateWithPlayers()
    state.bag = []

    const firstPass = Scrabble.applyAction(state, { type: 'pass' }, 'user1', players, 0, 1)
    state = firstPass.state
    const secondPass = Scrabble.applyAction(state, { type: 'pass' }, 'user2', players, 1, 2)

    expect(secondPass.completed).toBe(true)
    expect(secondPass.winnerUserId).toBe('user1')
  })

  it('does not end infinite games because the finite bag is empty', () => {
    let state = stateWithPlayers(true)
    state.bag = []

    const firstPass = Scrabble.applyAction(state, { type: 'pass' }, 'user1', players, 0, 1)
    state = firstPass.state
    const secondPass = Scrabble.applyAction(state, { type: 'pass' }, 'user2', players, 1, 2)

    expect(secondPass.completed).toBe(false)
  })

  it('can toggle infinite letters before play starts', () => {
    const state = stateWithPlayers()
    const next = Scrabble.setInfiniteLetters(state, true)

    expect(next.infiniteLetters).toBe(true)
    expect(state.infiniteLetters).toBe(false)
  })
})
