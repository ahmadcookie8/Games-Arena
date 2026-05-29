import { Scrabble, ScrabbleState, ScrabbleTile } from './Scrabble'

const players = [
  { userId: 'user1', username: 'One' },
  { userId: 'user2', username: 'Two' },
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

describe('Scrabble', () => {
  it('creates a persistent 15x15 game state with racks and weighted finite bag', () => {
    const state = Scrabble.createInitialState('user1')

    expect(state.board).toHaveLength(15)
    expect(state.board[0]).toHaveLength(15)
    expect(state.racks.user1).toHaveLength(7)
    expect(state.bag.length).toBe(93)
    expect(state.infiniteLetters).toBe(false)
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

    const accepted = Scrabble.applyAction(
      state,
      { type: 'respondTrade', accept: true, rackTileIds: ['e1', 'r1'] },
      'user2',
      players,
      0,
      2
    )

    expect(accepted.state.pendingTrade).toBeNull()
    expect(accepted.state.racks.user1.map((rackTile) => rackTile.id)).toContain('e1')
    expect(accepted.state.racks.user2.map((rackTile) => rackTile.id)).toContain('q1')
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
