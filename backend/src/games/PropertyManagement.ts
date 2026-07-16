import { GameBase } from './GameBase'
import { Player, ValidationResult, GameOverResult } from '../types/game'
import { BadRequestError } from '../utils/errors'

export type PMPhase = 'lobby' | 'playing' | 'completed'
export type PMTurnPhase = 'preRoll' | 'postRoll' | 'buyOrAuction' | 'auction' | 'card'
export type PMSquareType = 'go' | 'property' | 'railroad' | 'utility' | 'tax' | 'chance' | 'communityChest' | 'jail' | 'freeParking' | 'goToJail'
export type PMColorGroup = 'brown' | 'lightBlue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'darkBlue' | 'railroad' | 'utility' | null

export interface PMSquare {
  index: number
  name: string
  type: PMSquareType
  colorGroup: PMColorGroup
  price: number | null
  houseCost: number | null
  mortgageValue: number | null
  rent: number[]
}

export interface PMPlayerState {
  userId: string
  username: string
  position: number
  money: number
  inJail: boolean
  jailRollCount: number
  getOutOfJailFreeCards: number
  /**
   * Deck provenance for cards created by the corrected engine. Older games only
   * persisted the aggregate count; those cards are normalized to `legacy` and
   * remain usable without guessing which deck they came from.
   */
  getOutOfJailFreeCardDecks?: PMJailCardDeck[]
  isBankrupt: boolean
}

export type PMJailCardDeck = 'chance' | 'communityChest' | 'legacy'

export interface PMPropertyOwnership {
  ownerId: string | null
  mortgaged: boolean
  houses: number
}

export interface PMAuctionState {
  squareIndex: number
  currentBid: number
  highBidderUserId: string | null
  passedUserIds: string[]
  activeUserIds: string[]
  currentBidderIndex: number
}

export type PMCardEffect =
  | { type: 'collectMoney'; amount: number }
  | { type: 'payMoney'; amount: number }
  | { type: 'collectFromEachPlayer'; amount: number }
  | { type: 'payEachPlayer'; amount: number }
  | { type: 'advanceTo'; squareIndex: number; collectGoIfPassed: boolean }
  | { type: 'goToJail' }
  | { type: 'getOutOfJailFree'; cardDeck: 'chance' | 'communityChest' }
  | { type: 'payPerHouseAndHotel'; houseCost: number; hotelCost: number }
  | { type: 'advanceToNearest'; squareType: 'railroad' | 'utility' }
  | { type: 'goBack'; spaces: number }

export type PMPendingAction =
  | { type: 'buyOrAuction'; squareIndex: number }
  | { type: 'auction'; auction: PMAuctionState }
  | { type: 'card'; cardText: string; cardEffect: PMCardEffect }

export interface PropertyManagementState {
  phase: PMPhase
  hostUserId: string
  currentPlayerUserId: string
  turnPhase: PMTurnPhase
  dice: [number, number] | null
  doublesCount: number
  /** A doubles roll waiting for any landing/card/auction flow to finish. */
  extraRollPending?: boolean
  playerOrder: string[]
  playerStates: Record<string, PMPlayerState>
  properties: Record<string, PMPropertyOwnership>
  chanceCardIndex: number
  communityChestCardIndex: number
  chanceCardOrder: number[]
  communityChestCardOrder: number[]
  chanceFreeCardReturned: boolean
  communityChestFreeCardReturned: boolean
  pendingAction: PMPendingAction | null
  lastEventMessage: string | null
  bankruptPlayerIds: string[]
  winnerId: string | null
}

export type PMAction =
  | { type: 'startGame' }
  | { type: 'rollDice' }
  | { type: 'buyProperty' }
  | { type: 'declineProperty' }
  | { type: 'auctionBid'; amount: number }
  | { type: 'auctionPass' }
  | { type: 'payJailFine' }
  | { type: 'useGetOutOfJailCard' }
  | { type: 'buildHouse'; squareIndex: number }
  | { type: 'sellHouse'; squareIndex: number }
  | { type: 'mortgageProperty'; squareIndex: number }
  | { type: 'unmortgageProperty'; squareIndex: number }
  | { type: 'declareBankruptcy' }
  | { type: 'endTurn' }
  | { type: 'acknowledgeCard' }

// ─── Board Data ────────────────────────────────────────────────────────────────

export const BOARD_SQUARES: PMSquare[] = [
  { index: 0,  name: 'GO',                  type: 'go',             colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 1,  name: 'Elm Street',           type: 'property',       colorGroup: 'brown',     price: 60,   houseCost: 50,   mortgageValue: 30,   rent: [2,10,30,90,160,250] },
  { index: 2,  name: 'Community Chest',      type: 'communityChest', colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 3,  name: 'Oak Avenue',           type: 'property',       colorGroup: 'brown',     price: 60,   houseCost: 50,   mortgageValue: 30,   rent: [4,20,60,180,320,450] },
  { index: 4,  name: 'Income Tax',           type: 'tax',            colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [200] },
  { index: 5,  name: 'Transit Line 1',       type: 'railroad',       colorGroup: 'railroad',  price: 200,  houseCost: null, mortgageValue: 100,  rent: [25,50,100,200] },
  { index: 6,  name: 'Cedar Lane',           type: 'property',       colorGroup: 'lightBlue', price: 100,  houseCost: 50,   mortgageValue: 50,   rent: [6,30,90,270,400,550] },
  { index: 7,  name: 'Chance',               type: 'chance',         colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 8,  name: 'Maple Drive',          type: 'property',       colorGroup: 'lightBlue', price: 100,  houseCost: 50,   mortgageValue: 50,   rent: [6,30,90,270,400,550] },
  { index: 9,  name: 'Birch Boulevard',      type: 'property',       colorGroup: 'lightBlue', price: 120,  houseCost: 50,   mortgageValue: 60,   rent: [8,40,100,300,450,600] },
  { index: 10, name: 'Jail / Just Visiting', type: 'jail',           colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 11, name: 'Rose Road',            type: 'property',       colorGroup: 'pink',      price: 140,  houseCost: 100,  mortgageValue: 70,   rent: [10,50,150,450,625,750] },
  { index: 12, name: 'Power Co.',            type: 'utility',        colorGroup: 'utility',   price: 150,  houseCost: null, mortgageValue: 75,   rent: [4,10] },
  { index: 13, name: 'Violet Way',           type: 'property',       colorGroup: 'pink',      price: 140,  houseCost: 100,  mortgageValue: 70,   rent: [10,50,150,450,625,750] },
  { index: 14, name: 'Lavender Lane',        type: 'property',       colorGroup: 'pink',      price: 160,  houseCost: 100,  mortgageValue: 80,   rent: [12,60,180,500,700,900] },
  { index: 15, name: 'Transit Line 2',       type: 'railroad',       colorGroup: 'railroad',  price: 200,  houseCost: null, mortgageValue: 100,  rent: [25,50,100,200] },
  { index: 16, name: 'Amber Court',          type: 'property',       colorGroup: 'orange',    price: 180,  houseCost: 100,  mortgageValue: 90,   rent: [14,70,200,550,750,950] },
  { index: 17, name: 'Community Chest',      type: 'communityChest', colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 18, name: 'Tangerine Terrace',    type: 'property',       colorGroup: 'orange',    price: 180,  houseCost: 100,  mortgageValue: 90,   rent: [14,70,200,550,750,950] },
  { index: 19, name: 'Sienna Square',        type: 'property',       colorGroup: 'orange',    price: 200,  houseCost: 100,  mortgageValue: 100,  rent: [16,80,220,600,800,1000] },
  { index: 20, name: 'Free Parking',         type: 'freeParking',    colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 21, name: 'Crimson Close',        type: 'property',       colorGroup: 'red',       price: 220,  houseCost: 150,  mortgageValue: 110,  rent: [18,90,250,700,875,1050] },
  { index: 22, name: 'Chance',               type: 'chance',         colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 23, name: 'Scarlet Street',       type: 'property',       colorGroup: 'red',       price: 220,  houseCost: 150,  mortgageValue: 110,  rent: [18,90,250,700,875,1050] },
  { index: 24, name: 'Ruby Rise',            type: 'property',       colorGroup: 'red',       price: 240,  houseCost: 150,  mortgageValue: 120,  rent: [20,100,300,750,925,1100] },
  { index: 25, name: 'Transit Line 3',       type: 'railroad',       colorGroup: 'railroad',  price: 200,  houseCost: null, mortgageValue: 100,  rent: [25,50,100,200] },
  { index: 26, name: 'Gold Gate',            type: 'property',       colorGroup: 'yellow',    price: 260,  houseCost: 150,  mortgageValue: 130,  rent: [22,110,330,800,975,1150] },
  { index: 27, name: 'Amber Heights',        type: 'property',       colorGroup: 'yellow',    price: 260,  houseCost: 150,  mortgageValue: 130,  rent: [22,110,330,800,975,1150] },
  { index: 28, name: 'Water Co.',            type: 'utility',        colorGroup: 'utility',   price: 150,  houseCost: null, mortgageValue: 75,   rent: [4,10] },
  { index: 29, name: 'Canary Crescent',      type: 'property',       colorGroup: 'yellow',    price: 280,  houseCost: 150,  mortgageValue: 140,  rent: [24,120,360,850,1025,1200] },
  { index: 30, name: 'Go To Jail',           type: 'goToJail',       colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 31, name: 'Emerald Estate',       type: 'property',       colorGroup: 'green',     price: 300,  houseCost: 200,  mortgageValue: 150,  rent: [26,130,390,900,1100,1275] },
  { index: 32, name: 'Jade Junction',        type: 'property',       colorGroup: 'green',     price: 300,  houseCost: 200,  mortgageValue: 150,  rent: [26,130,390,900,1100,1275] },
  { index: 33, name: 'Community Chest',      type: 'communityChest', colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 34, name: 'Fern Field',           type: 'property',       colorGroup: 'green',     price: 320,  houseCost: 200,  mortgageValue: 160,  rent: [28,150,450,1000,1200,1400] },
  { index: 35, name: 'Transit Line 4',       type: 'railroad',       colorGroup: 'railroad',  price: 200,  houseCost: null, mortgageValue: 100,  rent: [25,50,100,200] },
  { index: 36, name: 'Chance',               type: 'chance',         colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 37, name: 'Sapphire Street',      type: 'property',       colorGroup: 'darkBlue',  price: 350,  houseCost: 200,  mortgageValue: 175,  rent: [35,175,500,1100,1300,1500] },
  { index: 38, name: 'Luxury Tax',           type: 'tax',            colorGroup: null,        price: null, houseCost: null, mortgageValue: null, rent: [100] },
  { index: 39, name: 'Indigo Place',         type: 'property',       colorGroup: 'darkBlue',  price: 400,  houseCost: 200,  mortgageValue: 200,  rent: [50,200,600,1400,1700,2000] },
]

export const COLOR_GROUPS: Record<string, number[]> = {
  brown:     [1, 3],
  lightBlue: [6, 8, 9],
  pink:      [11, 13, 14],
  orange:    [16, 18, 19],
  red:       [21, 23, 24],
  yellow:    [26, 27, 29],
  green:     [31, 32, 34],
  darkBlue:  [37, 39],
  railroad:  [5, 15, 25, 35],
  utility:   [12, 28],
}

const RAILROAD_INDICES = [5, 15, 25, 35]
const UTILITY_INDICES = [12, 28]

// ─── Card Decks ────────────────────────────────────────────────────────────────

export const CHANCE_CARDS: Array<{ text: string; effect: PMCardEffect }> = [
  { text: 'Advance to GO. Collect $200.',                                              effect: { type: 'advanceTo', squareIndex: 0,  collectGoIfPassed: false } },
  { text: 'Advance to Sapphire Street. If you pass GO, collect $200.',                effect: { type: 'advanceTo', squareIndex: 37, collectGoIfPassed: true } },
  { text: 'Advance to Indigo Place. If you pass GO, collect $200.',                   effect: { type: 'advanceTo', squareIndex: 39, collectGoIfPassed: true } },
  { text: 'Advance to Transit Line 1. If you pass GO, collect $200.',                 effect: { type: 'advanceTo', squareIndex: 5,  collectGoIfPassed: true } },
  { text: 'Advance to the nearest Transit Line. If unowned, you may buy it.',         effect: { type: 'advanceToNearest', squareType: 'railroad' } },
  { text: 'Advance to the nearest Utility. If unowned, you may buy it.',              effect: { type: 'advanceToNearest', squareType: 'utility' } },
  { text: 'Bank pays you a dividend of $50.',                                          effect: { type: 'collectMoney', amount: 50 } },
  { text: 'Get Out of Jail Free. Keep this card until needed.',                        effect: { type: 'getOutOfJailFree', cardDeck: 'chance' } },
  { text: 'Go back 3 spaces.',                                                         effect: { type: 'goBack', spaces: 3 } },
  { text: 'Go to Jail. Do not pass GO, do not collect $200.',                         effect: { type: 'goToJail' } },
  { text: 'Make general repairs. Pay $25 per house and $100 per hotel.',              effect: { type: 'payPerHouseAndHotel', houseCost: 25, hotelCost: 100 } },
  { text: 'Pay poor tax of $15.',                                                      effect: { type: 'payMoney', amount: 15 } },
  { text: 'Advance to Amber Heights. If you pass GO, collect $200.',                  effect: { type: 'advanceTo', squareIndex: 27, collectGoIfPassed: true } },
  { text: 'You are elected Chairman of the Board. Pay each player $50.',              effect: { type: 'payEachPlayer', amount: 50 } },
  { text: 'Your building and loan matures. Collect $150.',                             effect: { type: 'collectMoney', amount: 150 } },
]

export const COMMUNITY_CHEST_CARDS: Array<{ text: string; effect: PMCardEffect }> = [
  { text: 'Advance to GO. Collect $200.',                                              effect: { type: 'advanceTo', squareIndex: 0, collectGoIfPassed: false } },
  { text: 'Bank error in your favor. Collect $200.',                                   effect: { type: 'collectMoney', amount: 200 } },
  { text: "Doctor's fees. Pay $50.",                                                   effect: { type: 'payMoney', amount: 50 } },
  { text: 'From sale of stock you get $50.',                                            effect: { type: 'collectMoney', amount: 50 } },
  { text: 'Get Out of Jail Free. Keep this card until needed.',                        effect: { type: 'getOutOfJailFree', cardDeck: 'communityChest' } },
  { text: 'Go to Jail. Do not pass GO, do not collect $200.',                         effect: { type: 'goToJail' } },
  { text: 'Grand Opera Night — Collect $50 from every player for opening night.',     effect: { type: 'collectFromEachPlayer', amount: 50 } },
  { text: 'Holiday Fund matures. Collect $100.',                                       effect: { type: 'collectMoney', amount: 100 } },
  { text: 'Income tax refund. Collect $20.',                                            effect: { type: 'collectMoney', amount: 20 } },
  { text: "It's your birthday! Collect $10 from every player.",                       effect: { type: 'collectFromEachPlayer', amount: 10 } },
  { text: 'Life insurance matures. Collect $100.',                                     effect: { type: 'collectMoney', amount: 100 } },
  { text: 'Pay hospital fees of $100.',                                                 effect: { type: 'payMoney', amount: 100 } },
  { text: 'Pay school fees of $150.',                                                   effect: { type: 'payMoney', amount: 150 } },
  { text: 'Receive $25 consultancy fee.',                                               effect: { type: 'collectMoney', amount: 25 } },
  { text: 'Street repairs: pay $40 per house and $115 per hotel.',                    effect: { type: 'payPerHouseAndHotel', houseCost: 40, hotelCost: 115 } },
]

// ─── Pure Helper Functions ─────────────────────────────────────────────────────

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T
}

/**
 * Upgrade persisted states lazily so games created by older releases remain
 * playable. In particular, legacy jail cards keep their value without
 * inventing a deck identity that was never persisted.
 */
export function normalizePropertyManagementState(state: PropertyManagementState): PropertyManagementState {
  const expectedPendingType: Partial<Record<PMTurnPhase, PMPendingAction['type']>> = {
    buyOrAuction: 'buyOrAuction',
    auction: 'auction',
    card: 'card',
  }
  const expected = expectedPendingType[state.turnPhase]
  const pendingActionIsCoherent = expected
    ? state.pendingAction?.type === expected
    : state.pendingAction === null
  const persistedDecks = Object.values(state.playerStates).flatMap(
    player => player.getOutOfJailFreeCardDecks ?? []
  )
  const hasNormalizedShape = typeof state.extraRollPending === 'boolean'
    && typeof state.chanceFreeCardReturned === 'boolean'
    && typeof state.communityChestFreeCardReturned === 'boolean'
    && Object.values(state.playerStates).every(player => {
      const decks = player.getOutOfJailFreeCardDecks
      return Array.isArray(decks)
        && decks.length === player.getOutOfJailFreeCards
        && decks.every(deck => deck === 'chance' || deck === 'communityChest' || deck === 'legacy')
    })
    && persistedDecks.filter(deck => deck === 'chance').length <= 1
    && persistedDecks.filter(deck => deck === 'communityChest').length <= 1

  const chanceCardIsHeld = Object.values(state.playerStates).some(
    player => player.getOutOfJailFreeCardDecks?.includes('chance')
  )

  const communityChestCardIsHeld = Object.values(state.playerStates).some(
    player => player.getOutOfJailFreeCardDecks?.includes('communityChest')
  )

  if (
    hasNormalizedShape
    && pendingActionIsCoherent
    && state.chanceFreeCardReturned === !chanceCardIsHeld
    && state.communityChestFreeCardReturned === !communityChestCardIsHeld
  ) return state

  const s = clone(state)
  s.extraRollPending = s.extraRollPending === true
  const unavailableLegacyDecks: DrawableCardDeck[] = []
  if (s.chanceFreeCardReturned === false) unavailableLegacyDecks.push('chance')
  if (s.communityChestFreeCardReturned === false) unavailableLegacyDecks.push('communityChest')

  const orderedPlayerIds = [
    ...s.playerOrder,
    ...Object.keys(s.playerStates).filter(id => !s.playerOrder.includes(id)),
  ]
  const targetCounts = new Map<string, number>()
  const assignedKnownDecks = new Set<DrawableCardDeck>()

  for (const playerId of orderedPlayerIds) {
    const player = s.playerStates[playerId]
    if (!player) continue
    const rawDecks = Array.isArray(player.getOutOfJailFreeCardDecks)
      ? player.getOutOfJailFreeCardDecks
      : []
    const sanitizedDecks: PMJailCardDeck[] = []
    for (const rawDeck of rawDecks) {
      if (rawDeck === 'legacy') {
        sanitizedDecks.push('legacy')
      } else if ((rawDeck === 'chance' || rawDeck === 'communityChest') && !assignedKnownDecks.has(rawDeck)) {
        sanitizedDecks.push(rawDeck)
        assignedKnownDecks.add(rawDeck)
      } else if (rawDeck === 'chance' || rawDeck === 'communityChest') {
        // A deck has only one such card. Preserve corrupt duplicates as unknown
        // usable cards instead of discarding player value.
        sanitizedDecks.push('legacy')
      }
    }
    const persistedCount = Number.isSafeInteger(player.getOutOfJailFreeCards) && player.getOutOfJailFreeCards > 0
      ? player.getOutOfJailFreeCards
      : 0
    targetCounts.set(playerId, Math.max(persistedCount, sanitizedDecks.length))
    player.getOutOfJailFreeCardDecks = sanitizedDecks
  }

  for (const deck of unavailableLegacyDecks) {
    if (assignedKnownDecks.has(deck)) continue
    let assigned = false
    for (const playerId of orderedPlayerIds) {
      const player = s.playerStates[playerId]
      if (!player) continue
      const decks = player.getOutOfJailFreeCardDecks ?? []
      const legacyIndex = decks.indexOf('legacy')
      if (legacyIndex !== -1) {
        decks[legacyIndex] = deck
        assignedKnownDecks.add(deck)
        assigned = true
        break
      }
      if (decks.length < (targetCounts.get(playerId) ?? 0)) {
        decks.push(deck)
        assignedKnownDecks.add(deck)
        assigned = true
        break
      }
    }
    if (!assigned) {
      // A stale unavailable flag with no corresponding aggregate card is safer
      // to repair as available than to leave the deck permanently locked.
      assignedKnownDecks.delete(deck)
    }
  }

  for (const playerId of orderedPlayerIds) {
    const player = s.playerStates[playerId]
    if (!player) continue
    const decks = player.getOutOfJailFreeCardDecks ?? []
    while (decks.length < (targetCounts.get(playerId) ?? 0)) decks.push('legacy')
    player.getOutOfJailFreeCardDecks = decks
    player.getOutOfJailFreeCards = decks.length
  }

  s.chanceFreeCardReturned = !assignedKnownDecks.has('chance')
  s.communityChestFreeCardReturned = !assignedKnownDecks.has('communityChest')

  if (s.phase === 'playing') {
    const normalizedExpected = expectedPendingType[s.turnPhase]
    if (normalizedExpected && s.pendingAction?.type !== normalizedExpected) {
      const player = s.playerStates[s.currentPlayerUserId]
      const square = player ? BOARD_SQUARES[player.position] : null
      const ownership = player ? s.properties[String(player.position)] : null
      const canReconstructPurchase = square
        && (square.type === 'property' || square.type === 'railroad' || square.type === 'utility')
        && ownership?.ownerId === null

      if (canReconstructPurchase && player) {
        s.turnPhase = 'buyOrAuction'
        s.pendingAction = { type: 'buyOrAuction', squareIndex: player.position }
      } else {
        s.turnPhase = 'postRoll'
        s.pendingAction = null
        return resolveDeferredExtraRoll(s, s.currentPlayerUserId)
      }
    } else if (!normalizedExpected && s.pendingAction !== null) {
      s.pendingAction = null
    }
  } else {
    s.pendingAction = null
    s.extraRollPending = false
  }

  return s
}

function shuffleDeck(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1
}

function movePlayerBy(state: PropertyManagementState, playerId: string, spaces: number): PropertyManagementState {
  const s = clone(state)
  const player = s.playerStates[playerId]
  const destination = player.position + spaces
  if (destination >= BOARD_SQUARES.length) player.money += 200
  player.position = destination % BOARD_SQUARES.length
  return s
}

function movePlayerTo(
  state: PropertyManagementState,
  playerId: string,
  target: number,
  collectGo: boolean
): PropertyManagementState {
  const s = clone(state)
  const player = s.playerStates[playerId]
  if (collectGo && (target === 0 || target < player.position)) player.money += 200
  player.position = target
  return s
}

function resolveDeferredExtraRoll(state: PropertyManagementState, playerId: string): PropertyManagementState {
  const s = clone(state)
  if (
    s.turnPhase === 'postRoll'
    && s.extraRollPending
    && s.currentPlayerUserId === playerId
    && !s.playerStates[playerId]?.inJail
  ) {
    s.extraRollPending = false
    s.turnPhase = 'preRoll'
    s.dice = null
    const playerName = s.playerStates[playerId]?.username ?? playerId
    s.lastEventMessage = `${s.lastEventMessage ?? ''} ${playerName} rolled doubles and rolls again.`.trim()
  }
  return s
}

type DrawableCardDeck = Exclude<PMJailCardDeck, 'legacy'>

function drawNextAvailableCard(
  state: PropertyManagementState,
  deck: DrawableCardDeck
): { text: string; effect: PMCardEffect } | null {
  const isChance = deck === 'chance'
  const cards = isChance ? CHANCE_CARDS : COMMUNITY_CHEST_CARDS
  const orderKey = isChance ? 'chanceCardOrder' : 'communityChestCardOrder'
  const indexKey = isChance ? 'chanceCardIndex' : 'communityChestCardIndex'
  const freeCardIndex = isChance ? 7 : 4
  const order = state[orderKey]
  if (!Array.isArray(order) || order.length === 0) return null

  for (let inspected = 0; inspected < order.length; inspected++) {
    const orderIndex = state[indexKey] % order.length
    const cardIndex = order[orderIndex]
    state[indexKey] = (orderIndex + 1) % order.length
    const freeCardAvailable = isChance ? state.chanceFreeCardReturned : state.communityChestFreeCardReturned
    if (cardIndex === freeCardIndex && !freeCardAvailable) continue
    return cards[cardIndex] ?? null
  }
  return null
}

function addJailCard(state: PropertyManagementState, playerId: string, deck: DrawableCardDeck): void {
  const player = state.playerStates[playerId]
  const decks = player.getOutOfJailFreeCardDecks ?? []
  decks.push(deck)
  player.getOutOfJailFreeCardDecks = decks
  player.getOutOfJailFreeCards = decks.length
  if (deck === 'chance') state.chanceFreeCardReturned = false
  else state.communityChestFreeCardReturned = false
}

function refreshJailCardAvailability(state: PropertyManagementState, deck: DrawableCardDeck): void {
  const isHeld = Object.values(state.playerStates).some(
    player => player.getOutOfJailFreeCardDecks?.includes(deck)
  )
  if (deck === 'chance') state.chanceFreeCardReturned = !isHeld
  else state.communityChestFreeCardReturned = !isHeld
}

function consumeJailCard(state: PropertyManagementState, playerId: string): PMJailCardDeck | null {
  const player = state.playerStates[playerId]
  const decks = player.getOutOfJailFreeCardDecks ?? []
  if (decks.length === 0) return null
  const [consumed] = decks.splice(0, 1)
  player.getOutOfJailFreeCardDecks = decks
  player.getOutOfJailFreeCards = decks.length
  if (consumed === 'chance' || consumed === 'communityChest') refreshJailCardAvailability(state, consumed)
  return consumed
}

function getNextActivePlayer(state: PropertyManagementState, currentId: string): string | null {
  const currentIndex = state.playerOrder.indexOf(currentId)
  for (let offset = 1; offset <= state.playerOrder.length; offset++) {
    const nextId = state.playerOrder[(currentIndex + offset) % state.playerOrder.length]
    if (!state.bankruptPlayerIds.includes(nextId)) return nextId
  }
  return null
}

function ownsMonopoly(state: PropertyManagementState, colorGroup: string, ownerId: string): boolean {
  const indices = COLOR_GROUPS[colorGroup]
  if (!indices) return false
  return indices.every(i => {
    const o = state.properties[String(i)]
    return o && o.ownerId === ownerId && !o.mortgaged
  })
}

function countOwnedRailroads(state: PropertyManagementState, ownerId: string): number {
  return RAILROAD_INDICES.filter(i => state.properties[String(i)]?.ownerId === ownerId).length
}

function countOwnedUtilities(state: PropertyManagementState, ownerId: string): number {
  return UTILITY_INDICES.filter(i => state.properties[String(i)]?.ownerId === ownerId).length
}

function calculateRent(state: PropertyManagementState, squareIndex: number, diceTotal: number, ownerId: string): number {
  const square = BOARD_SQUARES[squareIndex]
  if (!square) return 0
  if (square.type === 'utility') {
    const count = countOwnedUtilities(state, ownerId)
    return diceTotal * (count >= 2 ? 10 : 4)
  }
  if (square.type === 'railroad') {
    const count = countOwnedRailroads(state, ownerId)
    return square.rent[count - 1] ?? 0
  }
  if (square.type === 'property') {
    const ownership = state.properties[String(squareIndex)]
    const houses = ownership?.houses ?? 0
    if (houses > 0) return square.rent[houses] ?? 0
    if (square.colorGroup && ownsMonopoly(state, square.colorGroup, ownerId)) {
      return (square.rent[0] ?? 0) * 2
    }
    return square.rent[0] ?? 0
  }
  return 0
}

function sendToJail(state: PropertyManagementState, playerId: string): PropertyManagementState {
  const s = clone(state)
  s.playerStates[playerId].position = 10
  s.playerStates[playerId].inJail = true
  s.playerStates[playerId].jailRollCount = 0
  s.doublesCount = 0
  s.extraRollPending = false
  s.pendingAction = null
  return s
}

function checkBankruptcy(state: PropertyManagementState): PropertyManagementState {
  const s = clone(state)
  const active = s.playerOrder.filter(id => !s.bankruptPlayerIds.includes(id))
  if (active.length <= 1) {
    s.phase = 'completed'
    s.winnerId = active[0] ?? null
    s.pendingAction = null
    s.extraRollPending = false
    s.lastEventMessage = active[0]
      ? `${s.playerStates[active[0]]?.username ?? active[0]} wins!`
      : 'Game over!'
  }
  return s
}

function applyLanding(state: PropertyManagementState, playerId: string, squareIndex: number, diceTotal: number): PropertyManagementState {
  const s = clone(state)
  const square = BOARD_SQUARES[squareIndex]
  const playerName = s.playerStates[playerId]?.username ?? playerId

  switch (square.type) {
    case 'go':
      s.lastEventMessage = `${playerName} landed on GO and collected $200!`
      s.turnPhase = 'postRoll'
      break

    case 'property':
    case 'railroad':
    case 'utility': {
      const ownership = s.properties[String(squareIndex)]
      if (!ownership || ownership.ownerId === null) {
        s.pendingAction = { type: 'buyOrAuction', squareIndex }
        s.turnPhase = 'buyOrAuction'
        s.lastEventMessage = `${playerName} landed on ${square.name} — buy or auction?`
      } else if (ownership.ownerId === playerId) {
        s.lastEventMessage = `${playerName} landed on their own property (${square.name}).`
        s.turnPhase = 'postRoll'
      } else if (ownership.mortgaged) {
        s.lastEventMessage = `${playerName} landed on ${square.name} (mortgaged — no rent).`
        s.turnPhase = 'postRoll'
      } else {
        const rent = calculateRent(s, squareIndex, diceTotal, ownership.ownerId)
        const ownerName = s.playerStates[ownership.ownerId]?.username ?? ownership.ownerId
        s.playerStates[playerId].money -= rent
        s.playerStates[ownership.ownerId].money += rent
        s.lastEventMessage = `${playerName} paid $${rent} rent to ${ownerName} for ${square.name}.`
        s.turnPhase = 'postRoll'
      }
      break
    }

    case 'tax': {
      const amount = square.rent[0] ?? 0
      s.playerStates[playerId].money -= amount
      s.lastEventMessage = `${playerName} paid $${amount} in taxes.`
      s.turnPhase = 'postRoll'
      break
    }

    case 'chance': {
      const card = drawNextAvailableCard(s, 'chance')
      if (!card) { s.turnPhase = 'postRoll'; break }
      s.pendingAction = { type: 'card', cardText: card.text, cardEffect: card.effect }
      s.turnPhase = 'card'
      s.lastEventMessage = `${playerName} drew a Chance card.`
      break
    }

    case 'communityChest': {
      const card = drawNextAvailableCard(s, 'communityChest')
      if (!card) { s.turnPhase = 'postRoll'; break }
      s.pendingAction = { type: 'card', cardText: card.text, cardEffect: card.effect }
      s.turnPhase = 'card'
      s.lastEventMessage = `${playerName} drew a Community Chest card.`
      break
    }

    case 'goToJail': {
      const next = sendToJail(s, playerId)
      next.lastEventMessage = `${playerName} was sent to Jail!`
      next.turnPhase = 'preRoll'
      next.currentPlayerUserId = getNextActivePlayer(next, playerId) ?? playerId
      return next
    }

    case 'jail':
    case 'freeParking':
    default:
      s.lastEventMessage = `${playerName} landed on ${square.name}.`
      s.turnPhase = 'postRoll'
      break
  }

  return s
}

function applyCardEffect(state: PropertyManagementState, playerId: string, effect: PMCardEffect, diceTotal: number): PropertyManagementState {
  let s = clone(state)
  const playerName = s.playerStates[playerId]?.username ?? playerId
  // The acknowledged card is consumed first. A movement effect may create a
  // different pending action at the destination; that replacement must live.
  s.pendingAction = null

  switch (effect.type) {
    case 'collectMoney':
      s.playerStates[playerId].money += effect.amount
      s.lastEventMessage = `${playerName} collected $${effect.amount}.`
      s.turnPhase = 'postRoll'
      break

    case 'payMoney':
      s.playerStates[playerId].money -= effect.amount
      s.lastEventMessage = `${playerName} paid $${effect.amount}.`
      s.turnPhase = 'postRoll'
      break

    case 'collectFromEachPlayer': {
      let total = 0
      for (const id of s.playerOrder) {
        if (id !== playerId && !s.bankruptPlayerIds.includes(id)) {
          s.playerStates[id].money -= effect.amount
          total += effect.amount
        }
      }
      s.playerStates[playerId].money += total
      s.lastEventMessage = `${playerName} collected $${effect.amount} from each player.`
      s.turnPhase = 'postRoll'
      break
    }

    case 'payEachPlayer': {
      for (const id of s.playerOrder) {
        if (id !== playerId && !s.bankruptPlayerIds.includes(id)) {
          s.playerStates[playerId].money -= effect.amount
          s.playerStates[id].money += effect.amount
        }
      }
      s.lastEventMessage = `${playerName} paid $${effect.amount} to each player.`
      s.turnPhase = 'postRoll'
      break
    }

    case 'advanceTo': {
      const target = effect.squareIndex
      s = movePlayerTo(s, playerId, target, target === 0 || effect.collectGoIfPassed)
      s = applyLanding(s, playerId, target, diceTotal)
      break
    }

    case 'advanceToNearest': {
      const indices = effect.squareType === 'railroad' ? RAILROAD_INDICES : UTILITY_INDICES
      const pos = s.playerStates[playerId].position
      let nearest = indices[0]
      let minDist = 40
      for (const idx of indices) {
        const dist = (idx - pos + 40) % 40
        if (dist < minDist) { minDist = dist; nearest = idx }
      }
      if (minDist === 0) { nearest = indices[(indices.indexOf(pos) + 1) % indices.length] }
      s = movePlayerTo(s, playerId, nearest, true)
      s = applyLanding(s, playerId, nearest, diceTotal)
      break
    }

    case 'goToJail': {
      s = sendToJail(s, playerId)
      s.lastEventMessage = `${playerName} was sent to Jail by a card!`
      s.turnPhase = 'preRoll'
      s.currentPlayerUserId = getNextActivePlayer(s, playerId) ?? playerId
      break
    }

    case 'getOutOfJailFree':
      addJailCard(s, playerId, effect.cardDeck)
      s.lastEventMessage = `${playerName} received a Get Out of Jail Free card!`
      s.turnPhase = 'postRoll'
      break

    case 'payPerHouseAndHotel': {
      let total = 0
      for (const key of Object.keys(s.properties)) {
        const o = s.properties[key]
        if (o.ownerId === playerId) {
          if (o.houses === 5) total += effect.hotelCost
          else total += o.houses * effect.houseCost
        }
      }
      s.playerStates[playerId].money -= total
      s.lastEventMessage = `${playerName} paid $${total} for property repairs.`
      s.turnPhase = 'postRoll'
      break
    }

    case 'goBack': {
      const newPos = (s.playerStates[playerId].position - effect.spaces + 40) % 40
      s.playerStates[playerId].position = newPos
      s = applyLanding(s, playerId, newPos, diceTotal)
      break
    }
  }

  return s
}

function isAuctionComplete(auction: PMAuctionState): boolean {
  if (auction.highBidderUserId) {
    return auction.activeUserIds.every(
      id => id === auction.highBidderUserId || auction.passedUserIds.includes(id)
    )
  }
  return auction.activeUserIds.every(id => auction.passedUserIds.includes(id))
}

function advanceAuctionBidder(auction: PMAuctionState): void {
  for (let offset = 1; offset <= auction.activeUserIds.length; offset++) {
    const candidateIndex = (auction.currentBidderIndex + offset) % auction.activeUserIds.length
    const candidate = auction.activeUserIds[candidateIndex]
    if (!auction.passedUserIds.includes(candidate) && candidate !== auction.highBidderUserId) {
      auction.currentBidderIndex = candidateIndex
      return
    }
  }
}

function finalizeAuction(state: PropertyManagementState, auction: PMAuctionState): PropertyManagementState {
  const s = clone(state)
  if (auction.highBidderUserId && auction.currentBid > 0) {
    s.playerStates[auction.highBidderUserId].money -= auction.currentBid
    s.properties[String(auction.squareIndex)].ownerId = auction.highBidderUserId
    const winnerName = s.playerStates[auction.highBidderUserId]?.username ?? auction.highBidderUserId
    const squareName = BOARD_SQUARES[auction.squareIndex]?.name ?? String(auction.squareIndex)
    s.lastEventMessage = `${winnerName} won the auction for ${squareName} at $${auction.currentBid}.`
  } else {
    const squareName = BOARD_SQUARES[auction.squareIndex]?.name ?? String(auction.squareIndex)
    s.lastEventMessage = `${squareName} auction ended with no bids — property stays unsold.`
  }
  s.pendingAction = null
  s.turnPhase = 'postRoll'
  return resolveDeferredExtraRoll(s, s.currentPlayerUserId)
}

function canBuildHouse(state: PropertyManagementState, playerId: string, squareIndex: number): boolean {
  const square = BOARD_SQUARES[squareIndex]
  const ownership = state.properties[String(squareIndex)]
  if (!square || !ownership) return false
  if (square.type !== 'property') return false
  if (ownership.ownerId !== playerId) return false
  if (ownership.mortgaged) return false
  if (ownership.houses >= 5) return false
  if (!square.colorGroup) return false
  if (!ownsMonopoly(state, square.colorGroup, playerId)) return false
  // Even building: this property's houses cannot exceed any sibling by more than 1
  const groupIndices = COLOR_GROUPS[square.colorGroup] ?? []
  const minHouses = Math.min(...groupIndices.map(i => state.properties[String(i)]?.houses ?? 0))
  if (ownership.houses > minHouses) return false
  const houseCost = square.houseCost ?? 0
  if (state.playerStates[playerId].money < houseCost) return false
  return true
}

function canSellHouse(state: PropertyManagementState, playerId: string, squareIndex: number): boolean {
  const square = BOARD_SQUARES[squareIndex]
  const ownership = state.properties[String(squareIndex)]
  if (!square || !ownership) return false
  if (ownership.ownerId !== playerId) return false
  if (ownership.houses <= 0) return false
  if (!square.colorGroup) return false
  // Even selling: cannot drop more than 1 below the max in the group
  const groupIndices = COLOR_GROUPS[square.colorGroup] ?? []
  const maxHouses = Math.max(...groupIndices.map(i => state.properties[String(i)]?.houses ?? 0))
  if (ownership.houses < maxHouses) return false
  return true
}

/** Returns every actionable state-machine invariant violation in a state. */
export function getPropertyManagementInvariantViolations(state: PropertyManagementState): string[] {
  const s = state
  const errors: string[] = []
  const order = s.playerOrder
  const orderSet = new Set(order)
  const active = order.filter(id => !s.bankruptPlayerIds.includes(id))
  const heldCardDecks = Object.values(s.playerStates).flatMap(
    player => player.getOutOfJailFreeCardDecks ?? []
  )

  if (orderSet.size !== order.length) errors.push('playerOrder contains duplicate users')
  if (!orderSet.has(s.hostUserId)) errors.push('hostUserId is not in playerOrder')
  for (const id of order) {
    const player = s.playerStates[id]
    if (!player) {
      errors.push(`playerStates is missing ${id}`)
      continue
    }
    if (player.userId !== id) errors.push(`playerStates.${id}.userId does not match its key`)
    if (!Number.isInteger(player.position) || player.position < 0 || player.position >= BOARD_SQUARES.length) {
      errors.push(`player ${id} has an invalid board position`)
    }
    if (!Number.isFinite(player.money)) errors.push(`player ${id} has invalid money`)
    if (player.isBankrupt !== s.bankruptPlayerIds.includes(id)) {
      errors.push(`player ${id} bankruptcy flags disagree`)
    }
    if (player.getOutOfJailFreeCards !== (player.getOutOfJailFreeCardDecks?.length ?? 0)) {
      errors.push(`player ${id} jail-card count disagrees with provenance`)
    }
  }
  if (heldCardDecks.filter(deck => deck === 'chance').length > 1) {
    errors.push('multiple players hold the Chance jail card')
  }
  if (heldCardDecks.filter(deck => deck === 'communityChest').length > 1) {
    errors.push('multiple players hold the Community Chest jail card')
  }
  if (s.chanceFreeCardReturned !== !heldCardDecks.includes('chance')) {
    errors.push('Chance jail-card availability disagrees with player holdings')
  }
  if (s.communityChestFreeCardReturned !== !heldCardDecks.includes('communityChest')) {
    errors.push('Community Chest jail-card availability disagrees with player holdings')
  }

  if (s.phase === 'lobby') {
    if (s.currentPlayerUserId !== s.hostUserId) errors.push('lobby current player must be the host')
    if (s.turnPhase !== 'preRoll') errors.push('lobby turnPhase must be preRoll')
    if (s.pendingAction !== null) errors.push('lobby cannot have a pending action')
    if (s.extraRollPending) errors.push('lobby cannot have a pending extra roll')
  }

  if (s.phase === 'playing') {
    if (!active.includes(s.currentPlayerUserId)) errors.push('current player is not active')
    if (active.length < 2) errors.push('playing state must have at least two active players')

    const expectedPendingType: Partial<Record<PMTurnPhase, PMPendingAction['type']>> = {
      buyOrAuction: 'buyOrAuction',
      auction: 'auction',
      card: 'card',
    }
    const expected = expectedPendingType[s.turnPhase]
    if (expected && s.pendingAction?.type !== expected) {
      errors.push(`${s.turnPhase} phase requires a ${expected} pending action`)
    }
    if (!expected && s.pendingAction !== null) {
      errors.push(`${s.turnPhase} phase cannot have a pending action`)
    }
    if (s.extraRollPending && !expected) {
      errors.push('extraRollPending must be resolved outside a deferred action phase')
    }
  }

  if (s.phase === 'completed') {
    if (active.length > 1) errors.push('completed state has multiple active players')
    if (s.winnerId !== (active[0] ?? null)) errors.push('winnerId does not match the last active player')
    if (s.pendingAction !== null) errors.push('completed state cannot have a pending action')
    if (s.extraRollPending) errors.push('completed state cannot have a pending extra roll')
  }

  if (s.pendingAction?.type === 'buyOrAuction') {
    const ownership = s.properties[String(s.pendingAction.squareIndex)]
    if (!ownership || ownership.ownerId !== null) errors.push('buyOrAuction property is not available')
  }

  if (s.pendingAction?.type === 'auction') {
    const auction = s.pendingAction.auction
    const auctionOwnership = s.properties[String(auction.squareIndex)]
    if (!auctionOwnership || auctionOwnership.ownerId !== null) {
      errors.push('auction property is not available')
    }
    const auctionUsers = new Set(auction.activeUserIds)
    if (auctionUsers.size !== auction.activeUserIds.length) errors.push('auction contains duplicate users')
    if (auction.activeUserIds.length === 0) errors.push('auction has no active users')
    if (!Number.isSafeInteger(auction.currentBid) || auction.currentBid < 0) errors.push('auction bid is invalid')
    if (auction.currentBidderIndex < 0 || auction.currentBidderIndex >= auction.activeUserIds.length) {
      errors.push('auction currentBidderIndex is out of range')
    }
    for (const id of auction.activeUserIds) {
      if (!active.includes(id)) errors.push(`auction includes inactive player ${id}`)
    }
    for (const id of auction.passedUserIds) {
      if (!auctionUsers.has(id)) errors.push(`auction passed player ${id} is not eligible`)
    }
    if (auction.highBidderUserId) {
      if (!auctionUsers.has(auction.highBidderUserId)) errors.push('auction high bidder is not eligible')
      if (auction.passedUserIds.includes(auction.highBidderUserId)) errors.push('auction high bidder has passed')
      if (auction.currentBid <= 0) errors.push('auction high bidder has no positive bid')
    } else if (auction.currentBid !== 0) {
      errors.push('auction has a bid without a high bidder')
    }
    const currentBidder = auction.activeUserIds[auction.currentBidderIndex]
    if (currentBidder && auction.passedUserIds.includes(currentBidder)) errors.push('auction current bidder has passed')
    if (currentBidder && currentBidder === auction.highBidderUserId) errors.push('auction current bidder is already high bidder')
    if (isAuctionComplete(auction)) errors.push('completed auction was not finalized')
  }

  for (const [squareIndex, ownership] of Object.entries(s.properties)) {
    if (ownership.ownerId !== null && !active.includes(ownership.ownerId)) {
      errors.push(`property ${squareIndex} is owned by an inactive player`)
    }
    if (!Number.isInteger(ownership.houses) || ownership.houses < 0 || ownership.houses > 5) {
      errors.push(`property ${squareIndex} has an invalid building count`)
    }
  }

  return errors
}

// ─── Game Class ────────────────────────────────────────────────────────────────

export class PropertyManagement extends GameBase {
  protected gameType = 'propertyManagement'

  constructor(players: Player[], initialState: PropertyManagementState) {
    super(players, initialState)
  }

  static createInitialState(hostUserId: string, hostUsername?: string): PropertyManagementState {
    const properties: Record<string, PMPropertyOwnership> = {}
    for (const square of BOARD_SQUARES) {
      if (square.type === 'property' || square.type === 'railroad' || square.type === 'utility') {
        properties[String(square.index)] = { ownerId: null, mortgaged: false, houses: 0 }
      }
    }
    return {
      phase: 'lobby',
      hostUserId,
      currentPlayerUserId: hostUserId,
      turnPhase: 'preRoll',
      dice: null,
      doublesCount: 0,
      extraRollPending: false,
      playerOrder: [hostUserId],
      playerStates: {
        [hostUserId]: {
          userId: hostUserId,
          username: hostUsername ?? hostUserId,
          position: 0,
          money: 1500,
          inJail: false,
          jailRollCount: 0,
          getOutOfJailFreeCards: 0,
          getOutOfJailFreeCardDecks: [],
          isBankrupt: false,
        },
      },
      properties,
      chanceCardIndex: 0,
      communityChestCardIndex: 0,
      chanceCardOrder: shuffleDeck(15),
      communityChestCardOrder: shuffleDeck(15),
      chanceFreeCardReturned: true,
      communityChestFreeCardReturned: true,
      pendingAction: null,
      lastEventMessage: null,
      bankruptPlayerIds: [],
      winnerId: null,
    }
  }

  static addPlayer(state: PropertyManagementState, userId: string, username: string): PropertyManagementState {
    const normalized = normalizePropertyManagementState(state)
    if (normalized.phase !== 'lobby') throw new BadRequestError('Game has already started')
    if (normalized.playerStates[userId]) return normalized
    const s = clone(normalized)
    s.playerOrder.push(userId)
    s.playerStates[userId] = {
      userId,
      username,
      position: 0,
      money: 1500,
      inJail: false,
      jailRollCount: 0,
      getOutOfJailFreeCards: 0,
      getOutOfJailFreeCardDecks: [],
      isBankrupt: false,
    }
    return s
  }

  static applyAction(state: PropertyManagementState, action: PMAction, userId: string): PropertyManagementState {
    const normalized = normalizePropertyManagementState(state)
    if (normalized.phase === 'completed') throw new BadRequestError('Game is already over')
    if (action.type !== 'startGame' && normalized.phase !== 'playing') {
      throw new BadRequestError('Game is not active')
    }

    switch (action.type) {
      case 'startGame':       return PropertyManagement.applyStartGame(normalized, userId)
      case 'rollDice':        return PropertyManagement.applyRollDice(normalized, userId)
      case 'buyProperty':     return PropertyManagement.applyBuyProperty(normalized, userId)
      case 'declineProperty': return PropertyManagement.applyDeclineProperty(normalized, userId)
      case 'auctionBid':      return PropertyManagement.applyAuctionBid(normalized, userId, action.amount)
      case 'auctionPass':     return PropertyManagement.applyAuctionPass(normalized, userId)
      case 'payJailFine':     return PropertyManagement.applyPayJailFine(normalized, userId)
      case 'useGetOutOfJailCard': return PropertyManagement.applyUseGetOutOfJailCard(normalized, userId)
      case 'buildHouse':      return PropertyManagement.applyBuildHouse(normalized, userId, action.squareIndex)
      case 'sellHouse':       return PropertyManagement.applySellHouse(normalized, userId, action.squareIndex)
      case 'mortgageProperty':   return PropertyManagement.applyMortgage(normalized, userId, action.squareIndex)
      case 'unmortgageProperty': return PropertyManagement.applyUnmortgage(normalized, userId, action.squareIndex)
      case 'declareBankruptcy':  return PropertyManagement.applyDeclareBankruptcy(normalized, userId)
      case 'endTurn':         return PropertyManagement.applyEndTurn(normalized, userId)
      case 'acknowledgeCard': return PropertyManagement.applyAcknowledgeCard(normalized, userId)
      default: throw new BadRequestError('Unknown action')
    }
  }

  private static applyStartGame(state: PropertyManagementState, userId: string): PropertyManagementState {
    if (state.phase !== 'lobby') throw new BadRequestError('Game is not in lobby')
    if (userId !== state.hostUserId) throw new BadRequestError('Only the host can start the game')
    if (state.playerOrder.length < 2) throw new BadRequestError('Need at least 2 players to start')
    const s = clone(state)
    s.phase = 'playing'
    s.currentPlayerUserId = s.playerOrder[0]
    s.turnPhase = 'preRoll'
    s.lastEventMessage = 'Game started! ' + (s.playerStates[s.playerOrder[0]]?.username ?? s.playerOrder[0]) + '\'s turn.'
    return s
  }

  private static applyRollDice(state: PropertyManagementState, userId: string): PropertyManagementState {
    if (state.phase !== 'playing') throw new BadRequestError('Game is not active')
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    if (state.turnPhase !== 'preRoll') throw new BadRequestError('Cannot roll dice now')

    const s = clone(state)
    const d1 = rollDie()
    const d2 = rollDie()
    s.dice = [d1, d2]
    const diceTotal = d1 + d2
    const isDoubles = d1 === d2
    const playerName = s.playerStates[userId]?.username ?? userId
    const player = s.playerStates[userId]

    // In jail
    if (player.inJail) {
      s.extraRollPending = false
      if (isDoubles) {
        player.inJail = false
        player.jailRollCount = 0
        s.doublesCount = 0 // freed by doubles, don't get extra roll
        const moved = movePlayerBy(s, userId, diceTotal)
        moved.lastEventMessage = `${playerName} rolled doubles (${d1}+${d2}) and got out of jail!`
        return applyLanding(moved, userId, moved.playerStates[userId].position, diceTotal)
      } else if (player.jailRollCount >= 2) {
        // 3rd failed roll — forced out, pay $50
        player.money -= 50
        player.inJail = false
        player.jailRollCount = 0
        const moved = movePlayerBy(s, userId, diceTotal)
        moved.lastEventMessage = `${playerName} paid $50 jail fine and rolled ${d1}+${d2}=${diceTotal}.`
        return applyLanding(moved, userId, moved.playerStates[userId].position, diceTotal)
      } else {
        player.jailRollCount += 1
        s.lastEventMessage = `${playerName} rolled ${d1}+${d2} in jail (attempt ${player.jailRollCount}/3). Still in jail.`
        s.turnPhase = 'preRoll'
        s.currentPlayerUserId = getNextActivePlayer(s, userId) ?? userId
        s.dice = null
        s.doublesCount = 0
        return s
      }
    }

    // Not in jail
    if (isDoubles) {
      s.doublesCount += 1
      if (s.doublesCount >= 3) {
        // Third double → jail
        const next = sendToJail(s, userId)
        next.lastEventMessage = `${playerName} rolled three doubles in a row and went to Jail!`
        next.turnPhase = 'preRoll'
        next.currentPlayerUserId = getNextActivePlayer(next, userId) ?? userId
        return next
      }
    }

    s.extraRollPending = isDoubles
    const moved = movePlayerBy(s, userId, diceTotal)
    const position = moved.playerStates[userId].position
    moved.lastEventMessage = `${playerName} rolled ${d1}+${d2}=${diceTotal} and moved to ${BOARD_SQUARES[position]?.name ?? position}.`

    const landed = applyLanding(moved, userId, position, diceTotal)
    return resolveDeferredExtraRoll(landed, userId)
  }

  private static applyBuyProperty(state: PropertyManagementState, userId: string): PropertyManagementState {
    if (state.turnPhase !== 'buyOrAuction') throw new BadRequestError('Not in buy/auction phase')
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    const pending = state.pendingAction
    if (!pending || pending.type !== 'buyOrAuction') throw new BadRequestError('No property to buy')

    const squareIndex = pending.squareIndex
    const square = BOARD_SQUARES[squareIndex]
    if (!square || square.price === null) throw new BadRequestError('Property has no price')
    if (state.playerStates[userId].money < square.price) throw new BadRequestError('Not enough money')

    const s = clone(state)
    s.playerStates[userId].money -= square.price
    s.properties[String(squareIndex)].ownerId = userId
    s.pendingAction = null
    s.turnPhase = 'postRoll'
    s.lastEventMessage = `${s.playerStates[userId]?.username ?? userId} bought ${square.name} for $${square.price}.`
    return resolveDeferredExtraRoll(s, userId)
  }

  private static applyDeclineProperty(state: PropertyManagementState, userId: string): PropertyManagementState {
    if (state.turnPhase !== 'buyOrAuction') throw new BadRequestError('Not in buy/auction phase')
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    const pending = state.pendingAction
    if (!pending || pending.type !== 'buyOrAuction') throw new BadRequestError('No property pending')

    const squareIndex = pending.squareIndex
    const square = BOARD_SQUARES[squareIndex]

    const s = clone(state)
    // Start auction — all non-bankrupt players participate
    const activeUserIds = [...s.playerOrder.filter(id => !s.bankruptPlayerIds.includes(id))]
    // Decliner goes last — rotate so next player after decliner starts
    const declinerIdx = activeUserIds.indexOf(userId)
    const rotated = [...activeUserIds.slice(declinerIdx + 1), ...activeUserIds.slice(0, declinerIdx + 1)]

    const auction: PMAuctionState = {
      squareIndex,
      currentBid: 0,
      highBidderUserId: null,
      passedUserIds: [],
      activeUserIds: rotated,
      currentBidderIndex: 0,
    }
    s.pendingAction = { type: 'auction', auction }
    s.turnPhase = 'auction'
    s.lastEventMessage = `${s.playerStates[userId]?.username ?? userId} declined ${square?.name ?? String(squareIndex)} — auction started!`
    return s
  }

  private static applyAuctionBid(state: PropertyManagementState, userId: string, amount: number): PropertyManagementState {
    if (state.turnPhase !== 'auction') throw new BadRequestError('No auction in progress')
    const pending = state.pendingAction
    if (!pending || pending.type !== 'auction') throw new BadRequestError('No auction pending')

    const auction = pending.auction
    const currentBidder = auction.activeUserIds[auction.currentBidderIndex]
    if (userId !== currentBidder) throw new BadRequestError('Not your turn to bid')
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestError('Bid must be a positive whole number')
    if (amount <= auction.currentBid) throw new BadRequestError(`Bid must be more than $${auction.currentBid}`)
    if (amount > state.playerStates[userId].money) throw new BadRequestError('Not enough money')

    const s = clone(state)
    const a = (s.pendingAction as { type: 'auction'; auction: PMAuctionState }).auction
    a.currentBid = amount
    a.highBidderUserId = userId
    s.lastEventMessage = `${s.playerStates[userId]?.username ?? userId} bid $${amount}.`
    if (isAuctionComplete(a)) return finalizeAuction(s, a)
    advanceAuctionBidder(a)
    return s
  }

  private static applyAuctionPass(state: PropertyManagementState, userId: string): PropertyManagementState {
    if (state.turnPhase !== 'auction') throw new BadRequestError('No auction in progress')
    const pending = state.pendingAction
    if (!pending || pending.type !== 'auction') throw new BadRequestError('No auction pending')

    const auction = pending.auction
    const currentBidder = auction.activeUserIds[auction.currentBidderIndex]
    if (userId !== currentBidder) throw new BadRequestError('Not your turn to bid')

    const s = clone(state)
    const a = (s.pendingAction as { type: 'auction'; auction: PMAuctionState }).auction
    if (!a.passedUserIds.includes(userId)) a.passedUserIds.push(userId)

    s.lastEventMessage = `${s.playerStates[userId]?.username ?? userId} passed on the auction.`
    if (isAuctionComplete(a)) return finalizeAuction(s, a)
    advanceAuctionBidder(a)
    return s
  }

  private static applyPayJailFine(state: PropertyManagementState, userId: string): PropertyManagementState {
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    if (state.turnPhase !== 'preRoll') throw new BadRequestError('Cannot pay fine now')
    if (!state.playerStates[userId]?.inJail) throw new BadRequestError('Not in jail')
    if (state.playerStates[userId].money < 50) throw new BadRequestError('Not enough money')

    const s = clone(state)
    s.playerStates[userId].money -= 50
    s.playerStates[userId].inJail = false
    s.playerStates[userId].jailRollCount = 0
    s.lastEventMessage = `${s.playerStates[userId]?.username ?? userId} paid $50 jail fine and is free!`
    return s
  }

  private static applyUseGetOutOfJailCard(state: PropertyManagementState, userId: string): PropertyManagementState {
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    if (state.turnPhase !== 'preRoll') throw new BadRequestError('Cannot use card now')
    if (!state.playerStates[userId]?.inJail) throw new BadRequestError('Not in jail')
    if ((state.playerStates[userId]?.getOutOfJailFreeCards ?? 0) <= 0) throw new BadRequestError('No Get Out of Jail Free card')

    const s = clone(state)
    if (!consumeJailCard(s, userId)) throw new BadRequestError('No Get Out of Jail Free card')
    s.playerStates[userId].inJail = false
    s.playerStates[userId].jailRollCount = 0
    s.lastEventMessage = `${s.playerStates[userId]?.username ?? userId} used a Get Out of Jail Free card!`
    return s
  }

  private static applyBuildHouse(state: PropertyManagementState, userId: string, squareIndex: number): PropertyManagementState {
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    if (state.turnPhase !== 'preRoll' && state.turnPhase !== 'postRoll') throw new BadRequestError('Cannot build now')
    if (!canBuildHouse(state, userId, squareIndex)) throw new BadRequestError('Cannot build a house here')

    const s = clone(state)
    const square = BOARD_SQUARES[squareIndex]
    s.playerStates[userId].money -= square.houseCost!
    s.properties[String(squareIndex)].houses += 1
    const houses = s.properties[String(squareIndex)].houses
    const label = houses === 5 ? 'a hotel' : `${houses} house${houses > 1 ? 's' : ''}`
    s.lastEventMessage = `${s.playerStates[userId]?.username ?? userId} built ${label} on ${square.name}.`
    return s
  }

  private static applySellHouse(state: PropertyManagementState, userId: string, squareIndex: number): PropertyManagementState {
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    if (state.turnPhase !== 'preRoll' && state.turnPhase !== 'postRoll') throw new BadRequestError('Cannot sell now')
    if (!canSellHouse(state, userId, squareIndex)) throw new BadRequestError('Cannot sell a house here')

    const s = clone(state)
    const square = BOARD_SQUARES[squareIndex]
    const refund = Math.floor((square.houseCost ?? 0) / 2)
    s.playerStates[userId].money += refund
    s.properties[String(squareIndex)].houses -= 1
    s.lastEventMessage = `${s.playerStates[userId]?.username ?? userId} sold a house on ${square.name} for $${refund}.`
    return s
  }

  private static applyMortgage(state: PropertyManagementState, userId: string, squareIndex: number): PropertyManagementState {
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    if (state.turnPhase !== 'preRoll' && state.turnPhase !== 'postRoll') throw new BadRequestError('Cannot mortgage now')

    const square = BOARD_SQUARES[squareIndex]
    const ownership = state.properties[String(squareIndex)]
    if (!ownership || ownership.ownerId !== userId) throw new BadRequestError('You do not own this property')
    if (ownership.mortgaged) throw new BadRequestError('Already mortgaged')
    if (ownership.houses > 0) throw new BadRequestError('Sell all houses first')

    // Cannot mortgage if any sibling has houses
    if (square.colorGroup) {
      const groupIndices = COLOR_GROUPS[square.colorGroup] ?? []
      const anyHouses = groupIndices.some(i => (state.properties[String(i)]?.houses ?? 0) > 0)
      if (anyHouses) throw new BadRequestError('Sell all houses in this color group first')
    }

    const s = clone(state)
    s.properties[String(squareIndex)].mortgaged = true
    s.playerStates[userId].money += square.mortgageValue ?? 0
    s.lastEventMessage = `${s.playerStates[userId]?.username ?? userId} mortgaged ${square.name} for $${square.mortgageValue}.`
    return s
  }

  private static applyUnmortgage(state: PropertyManagementState, userId: string, squareIndex: number): PropertyManagementState {
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    if (state.turnPhase !== 'preRoll' && state.turnPhase !== 'postRoll') throw new BadRequestError('Cannot unmortgage now')

    const square = BOARD_SQUARES[squareIndex]
    const ownership = state.properties[String(squareIndex)]
    if (!ownership || ownership.ownerId !== userId) throw new BadRequestError('You do not own this property')
    if (!ownership.mortgaged) throw new BadRequestError('Not mortgaged')

    const cost = Math.floor((square.mortgageValue ?? 0) * 1.1)
    if (state.playerStates[userId].money < cost) throw new BadRequestError('Not enough money')

    const s = clone(state)
    s.properties[String(squareIndex)].mortgaged = false
    s.playerStates[userId].money -= cost
    s.lastEventMessage = `${s.playerStates[userId]?.username ?? userId} unmortgaged ${square.name} for $${cost}.`
    return s
  }

  private static applyDeclareBankruptcy(state: PropertyManagementState, userId: string): PropertyManagementState {
    if (state.phase !== 'playing') throw new BadRequestError('Game is not active')
    if (!state.playerStates[userId]) throw new BadRequestError('Not in game')
    if (state.playerStates[userId].isBankrupt) throw new BadRequestError('Already bankrupt')
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    if (state.turnPhase !== 'preRoll' && state.turnPhase !== 'postRoll') {
      throw new BadRequestError('Cannot declare bankruptcy while an action is pending')
    }
    if (state.pendingAction !== null) throw new BadRequestError('Cannot declare bankruptcy while an action is pending')

    const s = clone(state)
    const returnedDecks = new Set(s.playerStates[userId].getOutOfJailFreeCardDecks ?? [])
    s.playerStates[userId].getOutOfJailFreeCardDecks = []
    s.playerStates[userId].getOutOfJailFreeCards = 0
    if (returnedDecks.has('chance')) refreshJailCardAvailability(s, 'chance')
    if (returnedDecks.has('communityChest')) refreshJailCardAvailability(s, 'communityChest')
    s.playerStates[userId].isBankrupt = true
    s.bankruptPlayerIds.push(userId)
    const name = s.playerStates[userId]?.username ?? userId

    // Return all properties to bank
    for (const key of Object.keys(s.properties)) {
      if (s.properties[key].ownerId === userId) {
        s.properties[key] = { ownerId: null, mortgaged: false, houses: 0 }
      }
    }

    s.lastEventMessage = `${name} declared bankruptcy and left the game!`

    // Check if game over
    const checked = checkBankruptcy(s)
    if (checked.phase === 'completed') return checked

    const next = getNextActivePlayer(s, userId)
    s.currentPlayerUserId = next ?? userId
    s.turnPhase = 'preRoll'
    s.dice = null
    s.doublesCount = 0
    s.extraRollPending = false
    s.pendingAction = null

    return s
  }

  private static applyEndTurn(state: PropertyManagementState, userId: string): PropertyManagementState {
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    if (state.turnPhase !== 'postRoll') throw new BadRequestError('Cannot end turn now')

    const s = clone(state)
    const nextPlayer = getNextActivePlayer(s, userId)
    s.currentPlayerUserId = nextPlayer ?? userId
    s.turnPhase = 'preRoll'
    s.dice = null
    s.doublesCount = 0
    s.extraRollPending = false
    s.pendingAction = null
    const nextName = s.playerStates[s.currentPlayerUserId]?.username ?? s.currentPlayerUserId
    s.lastEventMessage = `It's ${nextName}'s turn.`
    return s
  }

  private static applyAcknowledgeCard(state: PropertyManagementState, userId: string): PropertyManagementState {
    if (userId !== state.currentPlayerUserId) throw new BadRequestError('Not your turn')
    if (state.turnPhase !== 'card') throw new BadRequestError('No card to acknowledge')
    const pending = state.pendingAction
    if (!pending || pending.type !== 'card') throw new BadRequestError('No card pending')

    const s = clone(state)
    const diceTotal = s.dice ? s.dice[0] + s.dice[1] : 7
    const resolved = applyCardEffect(s, userId, pending.cardEffect, diceTotal)
    return resolveDeferredExtraRoll(resolved, userId)
  }

  static getMoveDescription(action: PMAction): string {
    switch (action.type) {
      case 'startGame':         return 'Started the game'
      case 'rollDice':          return 'Rolled dice'
      case 'buyProperty':       return 'Bought property'
      case 'declineProperty':   return 'Declined property (auction)'
      case 'auctionBid':        return `Bid $${action.amount} in auction`
      case 'auctionPass':       return 'Passed in auction'
      case 'payJailFine':       return 'Paid $50 jail fine'
      case 'useGetOutOfJailCard': return 'Used Get Out of Jail Free card'
      case 'buildHouse':        return `Built house on square ${action.squareIndex}`
      case 'sellHouse':         return `Sold house on square ${action.squareIndex}`
      case 'mortgageProperty':  return `Mortgaged square ${action.squareIndex}`
      case 'unmortgageProperty': return `Unmortgaged square ${action.squareIndex}`
      case 'declareBankruptcy': return 'Declared bankruptcy'
      case 'endTurn':           return 'Ended turn'
      case 'acknowledgeCard':   return 'Acknowledged card'
    }
  }

  // ─── GameBase stubs (logic handled via applyAction) ──────────────────────────

  validateMove(_gameState: unknown, _move: string): ValidationResult {
    return { isValid: true }
  }

  applyMove(_gameState: unknown, _move: string): unknown {
    throw new BadRequestError('Use PropertyManagement.applyAction directly')
  }

  isGameOver(gameState: unknown): GameOverResult {
    const state = gameState as PropertyManagementState
    if (state.phase !== 'playing') return { isGameOver: false }
    const active = state.playerOrder.filter(id => !state.bankruptPlayerIds.includes(id))
    if (active.length <= 1) {
      return {
        isGameOver: true,
        winner: state.playerOrder.indexOf(active[0] ?? ''),
        isDraw: false,
        reason: 'lastStanding',
      }
    }
    return { isGameOver: false }
  }

  getPossibleMoves(_gameState: unknown, _playerIndex: number): string[] {
    return []
  }

  serializeState(): string {
    return JSON.stringify(this.gameState)
  }

  deserializeState(state: string): void {
    this.gameState = JSON.parse(state) as PropertyManagementState
  }
}
