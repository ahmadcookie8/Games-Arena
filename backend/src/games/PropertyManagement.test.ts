import {
  BOARD_SQUARES,
  COLOR_GROUPS,
  getPropertyManagementInvariantViolations,
  normalizePropertyManagementState,
  PMCardEffect,
  PropertyManagement,
  PropertyManagementState,
} from './PropertyManagement'

const HOST = 'host'
const SECOND = 'second'
const THIRD = 'third'

function lobbyState(playerCount = 2): PropertyManagementState {
  let state = PropertyManagement.createInitialState(HOST, 'Host')
  if (playerCount >= 2) state = PropertyManagement.addPlayer(state, SECOND, 'Second')
  if (playerCount >= 3) state = PropertyManagement.addPlayer(state, THIRD, 'Third')
  return state
}

function playingState(playerCount = 2): PropertyManagementState {
  return PropertyManagement.applyAction(lobbyState(playerCount), { type: 'startGame' }, HOST)
}

function putPropertyUpForSale(
  state: PropertyManagementState,
  squareIndex = 1,
  extraRollPending = false
): PropertyManagementState {
  return {
    ...state,
    turnPhase: 'buyOrAuction',
    pendingAction: { type: 'buyOrAuction', squareIndex },
    extraRollPending,
    dice: [2, 2],
  }
}

function mockDice(dieOne: number, dieTwo: number): void {
  jest.spyOn(Math, 'random')
    .mockReturnValueOnce((dieOne - 1) / 6)
    .mockReturnValueOnce((dieTwo - 1) / 6)
}

function withPendingCard(
  state: PropertyManagementState,
  cardEffect: PMCardEffect,
  cardText = 'Test card',
): PropertyManagementState {
  return {
    ...state,
    turnPhase: 'card',
    pendingAction: { type: 'card', cardText, cardEffect },
    dice: [3, 4],
  }
}

function expectValid(state: PropertyManagementState): void {
  expect(getPropertyManagementInvariantViolations(state)).toEqual([])
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x1_0000_0000
  }
}

function takeRandomLegalAction(state: PropertyManagementState, random: () => number): PropertyManagementState {
  const currentId = state.currentPlayerUserId
  const currentPlayer = state.playerStates[currentId]

  switch (state.turnPhase) {
    case 'buyOrAuction': {
      const pending = state.pendingAction
      if (!pending || pending.type !== 'buyOrAuction') throw new Error('deadlocked buyOrAuction phase')
      const price = BOARD_SQUARES[pending.squareIndex]?.price ?? Number.POSITIVE_INFINITY
      const action = currentPlayer.money >= price && random() < 0.6
        ? { type: 'buyProperty' as const }
        : { type: 'declineProperty' as const }
      return PropertyManagement.applyAction(state, action, currentId)
    }

    case 'auction': {
      const pending = state.pendingAction
      if (!pending || pending.type !== 'auction') throw new Error('deadlocked auction phase')
      const auction = pending.auction
      const bidderId = auction.activeUserIds[auction.currentBidderIndex]
      const minimumBid = auction.currentBid + 1
      const bidderMoney = state.playerStates[bidderId].money
      if (minimumBid <= bidderMoney && random() < 0.55) {
        const increment = Math.floor(random() * Math.min(50, bidderMoney - minimumBid + 1))
        return PropertyManagement.applyAction(
          state,
          { type: 'auctionBid', amount: minimumBid + increment },
          bidderId
        )
      }
      return PropertyManagement.applyAction(state, { type: 'auctionPass' }, bidderId)
    }

    case 'card':
      return PropertyManagement.applyAction(state, { type: 'acknowledgeCard' }, currentId)

    case 'preRoll':
      if (currentPlayer.inJail && currentPlayer.getOutOfJailFreeCards > 0 && random() < 0.5) {
        return PropertyManagement.applyAction(state, { type: 'useGetOutOfJailCard' }, currentId)
      }
      if (currentPlayer.inJail && currentPlayer.money >= 50 && random() < 0.25) {
        return PropertyManagement.applyAction(state, { type: 'payJailFine' }, currentId)
      }
      return PropertyManagement.applyAction(state, { type: 'rollDice' }, currentId)

    case 'postRoll': {
      const ownedSquares = Object.entries(state.properties)
        .filter(([, ownership]) => ownership.ownerId === currentId)
        .map(([index]) => Number(index))

      if (random() < 0.12) {
        const buildable = ownedSquares.find((index) => {
          const square = BOARD_SQUARES[index]
          const ownership = state.properties[String(index)]
          if (square.type !== 'property' || !square.colorGroup || ownership.mortgaged || ownership.houses >= 5) return false
          const group = COLOR_GROUPS[square.colorGroup] ?? []
          const ownsGroup = group.every(groupIndex => {
            const sibling = state.properties[String(groupIndex)]
            return sibling.ownerId === currentId && !sibling.mortgaged
          })
          const minHouses = Math.min(...group.map(groupIndex => state.properties[String(groupIndex)].houses))
          return ownsGroup && ownership.houses <= minHouses && currentPlayer.money >= (square.houseCost ?? 0)
        })
        if (buildable !== undefined) {
          return PropertyManagement.applyAction(state, { type: 'buildHouse', squareIndex: buildable }, currentId)
        }
      }

      if (random() < 0.08) {
        const sellable = ownedSquares.find((index) => {
          const square = BOARD_SQUARES[index]
          const ownership = state.properties[String(index)]
          if (!square.colorGroup || ownership.houses <= 0) return false
          const group = COLOR_GROUPS[square.colorGroup] ?? []
          const maxHouses = Math.max(...group.map(groupIndex => state.properties[String(groupIndex)].houses))
          return ownership.houses >= maxHouses
        })
        if (sellable !== undefined) {
          return PropertyManagement.applyAction(state, { type: 'sellHouse', squareIndex: sellable }, currentId)
        }
      }

      if (random() < 0.06) {
        const mortgageable = ownedSquares.find((index) => {
          const square = BOARD_SQUARES[index]
          const ownership = state.properties[String(index)]
          if (ownership.mortgaged || ownership.houses > 0) return false
          const group = square.colorGroup ? COLOR_GROUPS[square.colorGroup] ?? [] : []
          return group.every(groupIndex => state.properties[String(groupIndex)].houses === 0)
        })
        if (mortgageable !== undefined) {
          return PropertyManagement.applyAction(state, { type: 'mortgageProperty', squareIndex: mortgageable }, currentId)
        }
      }

      if (random() < 0.06) {
        const unmortgageable = ownedSquares.find((index) => {
          const square = BOARD_SQUARES[index]
          const ownership = state.properties[String(index)]
          const cost = Math.floor((square.mortgageValue ?? 0) * 1.1)
          return ownership.mortgaged && currentPlayer.money >= cost
        })
        if (unmortgageable !== undefined) {
          return PropertyManagement.applyAction(state, { type: 'unmortgageProperty', squareIndex: unmortgageable }, currentId)
        }
      }

      return PropertyManagement.applyAction(state, { type: 'endTurn' }, currentId)
    }
  }
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('PropertyManagement reliability invariants', () => {
  it('creates valid lobby and playing states with explicit compatibility fields', () => {
    const lobby = lobbyState()
    expect(lobby.extraRollPending).toBe(false)
    expect(lobby.playerStates[HOST].getOutOfJailFreeCardDecks).toEqual([])
    expectValid(lobby)

    const playing = PropertyManagement.applyAction(lobby, { type: 'startGame' }, HOST)
    expectValid(playing)
  })

  it('reports deadlocked phase/pending-action combinations', () => {
    const state = playingState()
    state.turnPhase = 'card'
    state.pendingAction = null

    expect(getPropertyManagementInvariantViolations(state)).toContain(
      'card phase requires a card pending action'
    )
  })

  it('reconstructs a missing purchase action from a safe unowned landing', () => {
    const state = playingState()
    state.playerStates[HOST].position = 1
    state.turnPhase = 'auction'
    state.pendingAction = null
    state.extraRollPending = true

    const repaired = normalizePropertyManagementState(state)

    expect(repaired.turnPhase).toBe('buyOrAuction')
    expect(repaired.pendingAction).toEqual({ type: 'buyOrAuction', squareIndex: 1 })
    expect(repaired.extraRollPending).toBe(true)
    expectValid(repaired)
  })

  it('recovers an unreconstructable hard lock and resolves its deferred extra roll', () => {
    const state = playingState()
    state.playerStates[HOST].position = 4
    state.turnPhase = 'card'
    state.pendingAction = null
    state.extraRollPending = true
    state.dice = [3, 3]

    const repaired = normalizePropertyManagementState(state)

    expect(repaired.turnPhase).toBe('preRoll')
    expect(repaired.pendingAction).toBeNull()
    expect(repaired.extraRollPending).toBe(false)
    expect(repaired.dice).toBeNull()
    expectValid(repaired)
  })

})

describe('PropertyManagement movement and deferred actions', () => {
  it('applies direct card collections and payments exactly once', () => {
    const collected = PropertyManagement.applyAction(
      withPendingCard(playingState(), { type: 'collectMoney', amount: 125 }),
      { type: 'acknowledgeCard' },
      HOST,
    )

    expect(collected.playerStates[HOST].money).toBe(1625)
    expect(collected.pendingAction).toBeNull()
    expect(collected.turnPhase).toBe('postRoll')
    expectValid(collected)

    const paid = PropertyManagement.applyAction(
      withPendingCard(collected, { type: 'payMoney', amount: 80 }),
      { type: 'acknowledgeCard' },
      HOST,
    )

    expect(paid.playerStates[HOST].money).toBe(1545)
    expect(paid.pendingAction).toBeNull()
    expectValid(paid)
  })

  it('applies collect-from-each and pay-each cards to every active opponent', () => {
    const collected = PropertyManagement.applyAction(
      withPendingCard(playingState(3), { type: 'collectFromEachPlayer', amount: 50 }),
      { type: 'acknowledgeCard' },
      HOST,
    )

    expect(collected.playerStates[HOST].money).toBe(1600)
    expect(collected.playerStates[SECOND].money).toBe(1450)
    expect(collected.playerStates[THIRD].money).toBe(1450)
    expectValid(collected)

    const paid = PropertyManagement.applyAction(
      withPendingCard(collected, { type: 'payEachPlayer', amount: 25 }),
      { type: 'acknowledgeCard' },
      HOST,
    )

    expect(paid.playerStates[HOST].money).toBe(1550)
    expect(paid.playerStates[SECOND].money).toBe(1475)
    expect(paid.playerStates[THIRD].money).toBe(1475)
    expectValid(paid)
  })

  it('charges repair cards per house and per hotel', () => {
    const state = playingState()
    state.properties['1'] = { ownerId: HOST, mortgaged: false, houses: 2 }
    state.properties['3'] = { ownerId: HOST, mortgaged: false, houses: 5 }

    const repaired = PropertyManagement.applyAction(
      withPendingCard(state, { type: 'payPerHouseAndHotel', houseCost: 25, hotelCost: 100 }),
      { type: 'acknowledgeCard' },
      HOST,
    )

    expect(repaired.playerStates[HOST].money).toBe(1350)
    expect(repaired.pendingAction).toBeNull()
    expectValid(repaired)
  })

  it.each([
    ['railroad', 36, 5],
    ['utility', 36, 12],
  ] as const)('advances to the nearest %s and pays GO once when wrapping', (squareType, start, destination) => {
    const state = playingState()
    state.playerStates[HOST].position = start

    const moved = PropertyManagement.applyAction(
      withPendingCard(state, { type: 'advanceToNearest', squareType }),
      { type: 'acknowledgeCard' },
      HOST,
    )

    expect(moved.playerStates[HOST].position).toBe(destination)
    expect(moved.playerStates[HOST].money).toBe(1700)
    expect(moved.turnPhase).toBe('buyOrAuction')
    expect(moved.pendingAction).toEqual({ type: 'buyOrAuction', squareIndex: destination })
    expectValid(moved)
  })

  it('sends a player to jail from a card and advances the turn', () => {
    const state = playingState()
    state.playerStates[HOST].position = 7
    state.extraRollPending = true

    const jailed = PropertyManagement.applyAction(
      withPendingCard(state, { type: 'goToJail' }),
      { type: 'acknowledgeCard' },
      HOST,
    )

    expect(jailed.playerStates[HOST]).toMatchObject({ position: 10, inJail: true, jailRollCount: 0 })
    expect(jailed.currentPlayerUserId).toBe(SECOND)
    expect(jailed.turnPhase).toBe('preRoll')
    expect(jailed.pendingAction).toBeNull()
    expect(jailed.extraRollPending).toBe(false)
    expectValid(jailed)
  })

  it('charges property rent to the visitor and credits the owner', () => {
    const state = playingState()
    state.properties['3'].ownerId = SECOND
    mockDice(1, 2)

    const landed = PropertyManagement.applyAction(state, { type: 'rollDice' }, HOST)

    expect(landed.playerStates[HOST].position).toBe(3)
    expect(landed.playerStates[HOST].money).toBe(1496)
    expect(landed.playerStates[SECOND].money).toBe(1504)
    expect(landed.turnPhase).toBe('postRoll')
    expectValid(landed)
  })

  it('charges tax exactly once when landing on a tax square', () => {
    const state = playingState()
    mockDice(1, 3)

    const landed = PropertyManagement.applyAction(state, { type: 'rollDice' }, HOST)

    expect(landed.playerStates[HOST].position).toBe(4)
    expect(landed.playerStates[HOST].money).toBe(1300)
    expect(landed.turnPhase).toBe('postRoll')
    expectValid(landed)
  })

  it('pays exactly $200 when a card advances a player to GO', () => {
    const state = playingState()
    state.playerStates[HOST].position = 22
    state.turnPhase = 'card'
    state.pendingAction = {
      type: 'card',
      cardText: 'Advance to GO.',
      cardEffect: { type: 'advanceTo', squareIndex: 0, collectGoIfPassed: false },
    }

    const next = PropertyManagement.applyAction(state, { type: 'acknowledgeCard' }, HOST)

    expect(next.playerStates[HOST].position).toBe(0)
    expect(next.playerStates[HOST].money).toBe(1700)
    expect(next.turnPhase).toBe('postRoll')
    expect(next.pendingAction).toBeNull()
    expectValid(next)
  })

  it('pays exactly $200 when dice land on GO', () => {
    const state = playingState()
    state.playerStates[HOST].position = 38
    mockDice(1, 1)

    const next = PropertyManagement.applyAction(state, { type: 'rollDice' }, HOST)

    expect(next.playerStates[HOST].position).toBe(0)
    expect(next.playerStates[HOST].money).toBe(1700)
    expect(next.turnPhase).toBe('preRoll')
    expect(next.extraRollPending).toBe(false)
    expectValid(next)
  })

  it('keeps a destination purchase pending after acknowledging a movement card', () => {
    const state = playingState()
    state.playerStates[HOST].position = 7
    state.turnPhase = 'card'
    state.dice = [4, 4]
    state.extraRollPending = true
    state.pendingAction = {
      type: 'card',
      cardText: 'Advance to Sapphire Street.',
      cardEffect: { type: 'advanceTo', squareIndex: 37, collectGoIfPassed: true },
    }

    const landed = PropertyManagement.applyAction(state, { type: 'acknowledgeCard' }, HOST)

    expect(landed.turnPhase).toBe('buyOrAuction')
    expect(landed.pendingAction).toEqual({ type: 'buyOrAuction', squareIndex: 37 })
    expect(landed.extraRollPending).toBe(true)
    expect(landed.playerStates[HOST].money).toBe(1500)
    expectValid(landed)

    const bought = PropertyManagement.applyAction(landed, { type: 'buyProperty' }, HOST)
    expect(bought.properties['37'].ownerId).toBe(HOST)
    expect(bought.turnPhase).toBe('preRoll')
    expect(bought.extraRollPending).toBe(false)
    expectValid(bought)
  })

  it('keeps a newly drawn nested card pending', () => {
    const state = playingState()
    state.playerStates[HOST].position = 36
    state.turnPhase = 'card'
    state.communityChestCardOrder = [1]
    state.communityChestCardIndex = 0
    state.pendingAction = {
      type: 'card',
      cardText: 'Go back 3 spaces.',
      cardEffect: { type: 'goBack', spaces: 3 },
    }

    const next = PropertyManagement.applyAction(state, { type: 'acknowledgeCard' }, HOST)

    expect(next.playerStates[HOST].position).toBe(33)
    expect(next.turnPhase).toBe('card')
    expect(next.pendingAction?.type).toBe('card')
    expectValid(next)
  })

  it('preserves a doubles extra roll across a direct purchase', () => {
    const state = playingState()
    state.playerStates[HOST].position = 39
    mockDice(1, 1)

    const landed = PropertyManagement.applyAction(state, { type: 'rollDice' }, HOST)
    expect(landed.playerStates[HOST].position).toBe(1)
    expect(landed.playerStates[HOST].money).toBe(1700)
    expect(landed.turnPhase).toBe('buyOrAuction')
    expect(landed.extraRollPending).toBe(true)

    const bought = PropertyManagement.applyAction(landed, { type: 'buyProperty' }, HOST)
    expect(bought.turnPhase).toBe('preRoll')
    expect(bought.extraRollPending).toBe(false)
    expect(bought.properties['1'].ownerId).toBe(HOST)
    expectValid(bought)
  })

  it('preserves a doubles extra roll until a card is acknowledged', () => {
    const state = playingState()
    state.playerStates[HOST].position = 5
    state.chanceCardOrder = [6]
    state.chanceCardIndex = 0
    mockDice(1, 1)

    const drewCard = PropertyManagement.applyAction(state, { type: 'rollDice' }, HOST)
    expect(drewCard.turnPhase).toBe('card')
    expect(drewCard.extraRollPending).toBe(true)

    const acknowledged = PropertyManagement.applyAction(drewCard, { type: 'acknowledgeCard' }, HOST)
    expect(acknowledged.playerStates[HOST].money).toBe(1550)
    expect(acknowledged.turnPhase).toBe('preRoll')
    expect(acknowledged.extraRollPending).toBe(false)
    expectValid(acknowledged)
  })

  it('lets jail and triple-doubles transitions override an otherwise pending extra roll', () => {
    const goToJail = playingState()
    goToJail.playerStates[HOST].position = 28
    mockDice(1, 1)

    const jailedBySquare = PropertyManagement.applyAction(goToJail, { type: 'rollDice' }, HOST)
    expect(jailedBySquare.playerStates[HOST]).toMatchObject({ position: 10, inJail: true })
    expect(jailedBySquare.currentPlayerUserId).toBe(SECOND)
    expect(jailedBySquare.extraRollPending).toBe(false)
    expectValid(jailedBySquare)

    jest.restoreAllMocks()
    const thirdDouble = playingState()
    thirdDouble.doublesCount = 2
    mockDice(2, 2)
    const jailedByDoubles = PropertyManagement.applyAction(thirdDouble, { type: 'rollDice' }, HOST)
    expect(jailedByDoubles.playerStates[HOST]).toMatchObject({ position: 10, inJail: true })
    expect(jailedByDoubles.currentPlayerUserId).toBe(SECOND)
    expect(jailedByDoubles.extraRollPending).toBe(false)
    expectValid(jailedByDoubles)
  })

  it('releases a jailed player on doubles without granting another roll', () => {
    const state = playingState()
    state.playerStates[HOST].position = 10
    state.playerStates[HOST].inJail = true
    state.playerStates[HOST].jailRollCount = 1
    state.properties['16'].ownerId = HOST
    mockDice(3, 3)

    const released = PropertyManagement.applyAction(state, { type: 'rollDice' }, HOST)

    expect(released.playerStates[HOST]).toMatchObject({ position: 16, inJail: false, jailRollCount: 0 })
    expect(released.turnPhase).toBe('postRoll')
    expect(released.extraRollPending).toBe(false)
    expectValid(released)
  })
})

describe('PropertyManagement auctions', () => {
  it('reports an auction whose target is already owned', () => {
    let state = putPropertyUpForSale(playingState())
    state = PropertyManagement.applyAction(state, { type: 'declineProperty' }, HOST)
    state.properties['1'].ownerId = SECOND

    expect(getPropertyManagementInvariantViolations(state)).toContain('auction property is not available')
  })

  it('lets every bidder act before ending a no-bid auction', () => {
    let state = putPropertyUpForSale(playingState())
    state = PropertyManagement.applyAction(state, { type: 'declineProperty' }, HOST)

    expect((state.pendingAction as { type: 'auction'; auction: { activeUserIds: string[] } }).auction.activeUserIds)
      .toEqual([SECOND, HOST])

    state = PropertyManagement.applyAction(state, { type: 'auctionPass' }, SECOND)
    expect(state.turnPhase).toBe('auction')
    expect((state.pendingAction as { type: 'auction'; auction: { currentBidderIndex: number; activeUserIds: string[] } }).auction.activeUserIds[
      (state.pendingAction as { type: 'auction'; auction: { currentBidderIndex: number } }).auction.currentBidderIndex
    ]).toBe(HOST)
    expectValid(state)

    state = PropertyManagement.applyAction(state, { type: 'auctionPass' }, HOST)
    expect(state.turnPhase).toBe('postRoll')
    expect(state.pendingAction).toBeNull()
    expect(state.properties['1'].ownerId).toBeNull()
    expectValid(state)
  })

  it('finalizes when all players other than the high bidder have passed', () => {
    let state = putPropertyUpForSale(playingState(), 1, true)
    state = PropertyManagement.applyAction(state, { type: 'declineProperty' }, HOST)
    state = PropertyManagement.applyAction(state, { type: 'auctionBid', amount: 100 }, SECOND)
    state = PropertyManagement.applyAction(state, { type: 'auctionPass' }, HOST)

    expect(state.properties['1'].ownerId).toBe(SECOND)
    expect(state.playerStates[SECOND].money).toBe(1400)
    expect(state.pendingAction).toBeNull()
    expect(state.turnPhase).toBe('preRoll')
    expect(state.extraRollPending).toBe(false)
    expectValid(state)
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN])(
    'rejects unsafe auction amount %p',
    (amount) => {
      let state = putPropertyUpForSale(playingState())
      state = PropertyManagement.applyAction(state, { type: 'declineProperty' }, HOST)

      expect(() => PropertyManagement.applyAction(state, { type: 'auctionBid', amount }, SECOND))
        .toThrow('positive whole number')
    }
  )
})

describe('PropertyManagement bankruptcy and jail cards', () => {
  it('allows bankruptcy only for the current player with no deferred action', () => {
    expect(() => PropertyManagement.applyAction(lobbyState(), { type: 'declareBankruptcy' }, HOST))
      .toThrow('Game is not active')

    const state = playingState(3)
    expect(() => PropertyManagement.applyAction(state, { type: 'declareBankruptcy' }, SECOND))
      .toThrow('Not your turn')

    const pending = putPropertyUpForSale(state)
    expect(() => PropertyManagement.applyAction(pending, { type: 'declareBankruptcy' }, HOST))
      .toThrow('action is pending')

    state.properties['1'].ownerId = HOST
    const next = PropertyManagement.applyAction(state, { type: 'declareBankruptcy' }, HOST)
    expect(next.playerStates[HOST].isBankrupt).toBe(true)
    expect(next.properties['1'].ownerId).toBeNull()
    expect(next.currentPlayerUserId).toBe(SECOND)
    expect(next.turnPhase).toBe('preRoll')
    expectValid(next)
  })

  it('completes the game when bankruptcy leaves one active player', () => {
    const completed = PropertyManagement.applyAction(
      playingState(),
      { type: 'declareBankruptcy' },
      HOST,
    )

    expect(completed.phase).toBe('completed')
    expect(completed.winnerId).toBe(SECOND)
    expect(completed.pendingAction).toBeNull()
    expect(completed.extraRollPending).toBe(false)
    expectValid(completed)
  })

  it('returns only the known deck card that was consumed', () => {
    const state = playingState()
    state.playerStates[HOST].inJail = true
    state.playerStates[HOST].position = 10
    state.playerStates[HOST].getOutOfJailFreeCards = 1
    state.playerStates[HOST].getOutOfJailFreeCardDecks = ['chance']
    state.playerStates[SECOND].getOutOfJailFreeCards = 1
    state.playerStates[SECOND].getOutOfJailFreeCardDecks = ['communityChest']
    state.chanceFreeCardReturned = false
    state.communityChestFreeCardReturned = false

    const next = PropertyManagement.applyAction(state, { type: 'useGetOutOfJailCard' }, HOST)

    expect(next.playerStates[HOST].getOutOfJailFreeCards).toBe(0)
    expect(next.playerStates[HOST].getOutOfJailFreeCardDecks).toEqual([])
    expect(next.chanceFreeCardReturned).toBe(true)
    expect(next.communityChestFreeCardReturned).toBe(false)
    expectValid(next)
  })

  it('maps known unavailable legacy decks first and keeps only surplus cards unknown', () => {
    const state = playingState()
    state.playerStates[HOST].inJail = true
    state.playerStates[HOST].position = 10
    state.playerStates[HOST].getOutOfJailFreeCards = 3
    delete state.playerStates[HOST].getOutOfJailFreeCardDecks
    state.chanceFreeCardReturned = false
    state.communityChestFreeCardReturned = false

    const next = PropertyManagement.applyAction(state, { type: 'useGetOutOfJailCard' }, HOST)

    expect(next.playerStates[HOST].getOutOfJailFreeCards).toBe(2)
    expect(next.playerStates[HOST].getOutOfJailFreeCardDecks).toEqual(['communityChest', 'legacy'])
    expect(next.chanceFreeCardReturned).toBe(true)
    expect(next.communityChestFreeCardReturned).toBe(false)
    expectValid(next)
  })

  it('re-enables only the source deck after consuming the last normalized legacy card from it', () => {
    const state = playingState()
    state.playerStates[HOST].inJail = true
    state.playerStates[HOST].position = 10
    state.playerStates[HOST].getOutOfJailFreeCards = 1
    delete state.playerStates[HOST].getOutOfJailFreeCardDecks
    state.playerStates[SECOND].getOutOfJailFreeCards = 1
    delete state.playerStates[SECOND].getOutOfJailFreeCardDecks
    state.chanceFreeCardReturned = false
    state.communityChestFreeCardReturned = false

    const next = PropertyManagement.applyAction(state, { type: 'useGetOutOfJailCard' }, HOST)

    expect(next.playerStates[HOST].getOutOfJailFreeCardDecks).toEqual([])
    expect(next.playerStates[SECOND].getOutOfJailFreeCardDecks).toEqual(['communityChest'])
    expect(next.chanceFreeCardReturned).toBe(true)
    expect(next.communityChestFreeCardReturned).toBe(false)
    expectValid(next)
  })

  it('skips a held Get Out of Jail Free card while drawing from its deck', () => {
    const state = playingState()
    state.playerStates[HOST].position = 5
    state.chanceCardOrder = [7, 6]
    state.chanceCardIndex = 0
    state.playerStates[SECOND].getOutOfJailFreeCards = 1
    state.playerStates[SECOND].getOutOfJailFreeCardDecks = ['chance']
    state.chanceFreeCardReturned = false
    mockDice(1, 1)

    const next = PropertyManagement.applyAction(state, { type: 'rollDice' }, HOST)

    expect(next.playerStates[HOST].position).toBe(7)
    expect(next.pendingAction).toEqual({
      type: 'card',
      cardText: 'Bank pays you a dividend of $50.',
      cardEffect: { type: 'collectMoney', amount: 50 },
    })
    expectValid(next)
  })

  it('records newly drawn jail cards by deck and returns them when used', () => {
    const state = playingState()
    state.playerStates[HOST].position = 5
    state.chanceCardOrder = [7]
    state.chanceCardIndex = 0
    mockDice(1, 1)

    const drew = PropertyManagement.applyAction(state, { type: 'rollDice' }, HOST)
    const received = PropertyManagement.applyAction(drew, { type: 'acknowledgeCard' }, HOST)
    expect(received.playerStates[HOST].getOutOfJailFreeCardDecks).toEqual(['chance'])
    expect(received.chanceFreeCardReturned).toBe(false)

    received.playerStates[HOST].inJail = true
    received.playerStates[HOST].position = 10
    const used = PropertyManagement.applyAction(received, { type: 'useGetOutOfJailCard' }, HOST)
    expect(used.playerStates[HOST].getOutOfJailFreeCardDecks).toEqual([])
    expect(used.chanceFreeCardReturned).toBe(true)
    expectValid(used)
  })
})

describe('PropertyManagement board completeness', () => {
  it('keeps every purchasable board square represented in ownership state', () => {
    const state = lobbyState()
    const purchasable = BOARD_SQUARES.filter(
      square => square.type === 'property' || square.type === 'railroad' || square.type === 'utility'
    )

    for (const square of purchasable) {
      expect(state.properties[String(square.index)]).toEqual({ ownerId: null, mortgaged: false, houses: 0 })
    }
  })

  it('enforces even building and the mortgage lifecycle', () => {
    let state = playingState()
    state.turnPhase = 'postRoll'
    state.properties['1'].ownerId = HOST
    state.properties['3'].ownerId = HOST

    state = PropertyManagement.applyAction(state, { type: 'buildHouse', squareIndex: 1 }, HOST)
    expect(state.properties['1'].houses).toBe(1)
    expect(() => PropertyManagement.applyAction(state, { type: 'buildHouse', squareIndex: 1 }, HOST))
      .toThrow('Cannot build')

    state = PropertyManagement.applyAction(state, { type: 'buildHouse', squareIndex: 3 }, HOST)
    expect(() => PropertyManagement.applyAction(state, { type: 'mortgageProperty', squareIndex: 1 }, HOST))
      .toThrow('Sell all houses')

    state = PropertyManagement.applyAction(state, { type: 'sellHouse', squareIndex: 1 }, HOST)
    state = PropertyManagement.applyAction(state, { type: 'sellHouse', squareIndex: 3 }, HOST)
    const moneyBeforeMortgage = state.playerStates[HOST].money
    state = PropertyManagement.applyAction(state, { type: 'mortgageProperty', squareIndex: 1 }, HOST)
    expect(state.properties['1'].mortgaged).toBe(true)
    expect(state.playerStates[HOST].money).toBe(moneyBeforeMortgage + 30)

    state = PropertyManagement.applyAction(state, { type: 'unmortgageProperty', squareIndex: 1 }, HOST)
    expect(state.properties['1'].mortgaged).toBe(false)
    expect(state.playerStates[HOST].money).toBe(moneyBeforeMortgage - 3)
    expectValid(state)
  })

  it('[stress] survives 500 seeded games of 1,000 legal actions without a deadlock or invariant violation', () => {
    for (let gameNumber = 0; gameNumber < 500; gameNumber++) {
      const random = seededRandom(gameNumber + 1)
      const randomSpy = jest.spyOn(Math, 'random').mockImplementation(random)
      let state = playingState(3)

      for (let actionNumber = 0; actionNumber < 1000; actionNumber++) {
        state = takeRandomLegalAction(state, random)
        const violations = getPropertyManagementInvariantViolations(state)
        if (violations.length > 0) {
          throw new Error(
            `game ${gameNumber}, action ${actionNumber}: ${violations.join('; ')}`
          )
        }
      }

      randomSpy.mockRestore()
    }
  }, 120_000)
})
