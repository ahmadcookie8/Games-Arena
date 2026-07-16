import { multiplayerActions } from '../../../frontend/src/lib/multiplayerActions'
import { makeMoveEventSchema } from '../utils/validators'
import { Player } from '../types/game'
import { TicTacToe } from './TicTacToe'
import { Wisecracker, WisecrackerAction, WisecrackerPlayerView, WisecrackerState } from './Wisecracker'
import { Scrabble, ScrabbleAction, ScrabblePlayerView, ScrabbleState, ScrabbleTile } from './Scrabble'
import { PMAction, PMCardEffect, PropertyManagement, PropertyManagementState } from './PropertyManagement'

const GAME_ID = '0123456789abcdef01234567'
const HOST_ID = '111111111111111111111111'
const SECOND_ID = '222222222222222222222222'
const THIRD_ID = '333333333333333333333333'

interface ContractExercise {
  action: unknown
  dispatch(validatedAction: unknown): void
}

interface ContractCase {
  name: string
  arrange(): ContractExercise
}

const wisePlayers: WisecrackerPlayerView[] = [
  { userId: HOST_ID, username: 'Host' },
  { userId: SECOND_ID, username: 'Second' },
  { userId: THIRD_ID, username: 'Third' },
]

function wiseLobby(): WisecrackerState {
  let state = Wisecracker.createInitialState(HOST_ID)
  state = Wisecracker.addPlayer(state, SECOND_ID)
  return Wisecracker.addPlayer(state, THIRD_ID)
}

function wisePrompt(): WisecrackerState {
  return Wisecracker.applyAction(
    wiseLobby(),
    multiplayerActions.wisecracker.startMatch(3),
    HOST_ID,
    wisePlayers,
  )
}

function wiseAnswering(): WisecrackerState {
  return Wisecracker.applyAction(
    wisePrompt(),
    multiplayerActions.wisecracker.setPrompt('A _ needs _.'),
    HOST_ID,
    wisePlayers,
  )
}

function wiseRevealing(): WisecrackerState {
  let state = wiseAnswering()
  state = Wisecracker.applyAction(
    state,
    multiplayerActions.wisecracker.submitAnswers(['one', 'two']),
    SECOND_ID,
    wisePlayers,
  )
  return Wisecracker.applyAction(
    state,
    multiplayerActions.wisecracker.submitAnswers(['three', 'four']),
    THIRD_ID,
    wisePlayers,
  )
}

const scrabblePlayers: ScrabblePlayerView[] = [
  { userId: HOST_ID, username: 'Host', isConnected: true },
  { userId: SECOND_ID, username: 'Second', isConnected: true },
]

function scrabbleGame(): ScrabbleState {
  const state = Scrabble.createInitialState(HOST_ID)
  return Scrabble.addPlayer(state, SECOND_ID)
}

function applyScrabble(state: ScrabbleState, action: unknown, userId = HOST_ID) {
  return Scrabble.applyAction(
    state,
    action as ScrabbleAction,
    userId,
    scrabblePlayers,
    0,
    1,
    HOST_ID,
  )
}

function scrabbleTrade(): { state: ScrabbleState; offerId: string; offeredTile: ScrabbleTile } {
  const state = scrabbleGame()
  const offeredTile = state.racks[HOST_ID][0]
  const offered = applyScrabble(
    state,
    multiplayerActions.scrabble.offerTrade(SECOND_ID, [offeredTile.id]),
  ).state
  const offerId = offered.pendingTrade?.offerId
  if (!offerId) throw new Error('Modern Scrabble trade did not receive an offer ID')
  return { state: offered, offerId, offeredTile }
}

function propertyLobby(): PropertyManagementState {
  let state = PropertyManagement.createInitialState(HOST_ID, 'Host')
  state = PropertyManagement.addPlayer(state, SECOND_ID, 'Second')
  return state
}

function propertyPlaying(): PropertyManagementState {
  return PropertyManagement.applyAction(
    propertyLobby(),
    multiplayerActions.propertyManagement.startGame(),
    HOST_ID,
  )
}

function propertyPurchase(): PropertyManagementState {
  const state = propertyPlaying()
  return {
    ...state,
    turnPhase: 'buyOrAuction',
    pendingAction: { type: 'buyOrAuction', squareIndex: 1 },
    dice: [2, 3],
  }
}

function propertyAuction(): PropertyManagementState {
  return PropertyManagement.applyAction(
    propertyPurchase(),
    multiplayerActions.propertyManagement.declineProperty(),
    HOST_ID,
  )
}

function withPropertyCard(effect: PMCardEffect): PropertyManagementState {
  return {
    ...propertyPlaying(),
    turnPhase: 'card',
    pendingAction: { type: 'card', cardText: 'Contract fixture card', cardEffect: effect },
    dice: [2, 3],
  }
}

const contractCases: ContractCase[] = [
  {
    name: 'ticTacToe.place',
    arrange: () => {
      const players: Player[] = [
        { userId: HOST_ID, username: 'Host', index: 0 },
        { userId: SECOND_ID, username: 'Second', index: 1 },
      ]
      const engine = new TicTacToe(players)
      const state = TicTacToe.createInitialState()
      return {
        action: multiplayerActions.ticTacToe.place('4'),
        dispatch: (action) => {
          expect(engine.validateMove(state, action as string)).toEqual({ isValid: true })
          expect(engine.applyMove(state, action as string).board[4]).toBe('X')
        },
      }
    },
  },
  {
    name: 'wisecracker.startMatch',
    arrange: () => ({
      action: multiplayerActions.wisecracker.startMatch(3),
      dispatch: (action) => {
        const next = Wisecracker.applyAction(wiseLobby(), action as WisecrackerAction, HOST_ID, wisePlayers)
        expect(next.phase).toBe('prompt')
        expect(next.maxScore).toBe(3)
      },
    }),
  },
  {
    name: 'wisecracker.refreshPrompt',
    arrange: () => ({
      action: multiplayerActions.wisecracker.refreshPrompt(),
      dispatch: (action) => {
        const next = Wisecracker.applyAction(wisePrompt(), action as WisecrackerAction, HOST_ID, wisePlayers)
        expect(next.phase).toBe('prompt')
        expect(next.prompt.length).toBeGreaterThan(0)
      },
    }),
  },
  {
    name: 'wisecracker.setPrompt',
    arrange: () => ({
      action: multiplayerActions.wisecracker.setPrompt('A _ needs _.'),
      dispatch: (action) => {
        const next = Wisecracker.applyAction(wisePrompt(), action as WisecrackerAction, HOST_ID, wisePlayers)
        expect(next.phase).toBe('answering')
        expect(next.answerSlots).toBe(2)
      },
    }),
  },
  {
    name: 'wisecracker.submitAnswers',
    arrange: () => ({
      action: multiplayerActions.wisecracker.submitAnswers(['one', 'two']),
      dispatch: (action) => {
        const next = Wisecracker.applyAction(wiseAnswering(), action as WisecrackerAction, SECOND_ID, wisePlayers)
        expect(next.submittedAnswers[SECOND_ID]).toEqual(['one', 'two'])
      },
    }),
  },
  {
    name: 'wisecracker.revealNextAnswer',
    arrange: () => ({
      action: multiplayerActions.wisecracker.revealNextAnswer(),
      dispatch: (action) => {
        const next = Wisecracker.applyAction(wiseRevealing(), action as WisecrackerAction, HOST_ID, wisePlayers)
        expect(next.revealedCount).toBe(1)
      },
    }),
  },
  {
    name: 'wisecracker.selectRoundWinner',
    arrange: () => {
      let state = wiseRevealing()
      while (state.revealedCount < state.answerOrder.length) {
        state = Wisecracker.applyAction(
          state,
          multiplayerActions.wisecracker.revealNextAnswer(),
          HOST_ID,
          wisePlayers,
        )
      }
      const winningUserId = state.answerOrder[0]
      const responseId = state.responseIds[winningUserId]
      return {
        action: multiplayerActions.wisecracker.selectRoundWinner(responseId),
        dispatch: (action) => {
          const next = Wisecracker.applyAction(state, action as WisecrackerAction, HOST_ID, wisePlayers)
          expect(next.phase).toBe('roundResult')
          expect(next.roundWinnerUserId).toBe(winningUserId)
        },
      }
    },
  },
  {
    name: 'wisecracker.startNextRound',
    arrange: () => {
      let state = wiseRevealing()
      while (state.revealedCount < state.answerOrder.length) {
        state = Wisecracker.applyAction(
          state,
          multiplayerActions.wisecracker.revealNextAnswer(),
          HOST_ID,
          wisePlayers,
        )
      }
      state = Wisecracker.applyAction(
        state,
        multiplayerActions.wisecracker.selectRoundWinner(state.responseIds[state.answerOrder[0]]),
        HOST_ID,
        wisePlayers,
      )
      return {
        action: multiplayerActions.wisecracker.startNextRound(),
        dispatch: (action) => {
          const next = Wisecracker.applyAction(state, action as WisecrackerAction, HOST_ID, wisePlayers)
          expect(next.phase).toBe('prompt')
          expect(next.roundWinnerUserId).toBeNull()
        },
      }
    },
  },
  {
    name: 'scrabble.placeTiles (legacy blank)',
    arrange: () => {
      const state = scrabbleGame()
      const blank: ScrabbleTile = { id: '?-1700000000001-def456', letter: '?', value: 0, isBlank: true }
      const tee: ScrabbleTile = { id: '0e27ccf0-2c47-4ec2-90e4-30d666e22e00', letter: 'T', value: 1, isBlank: false }
      state.racks[HOST_ID] = [blank, tee]
      return {
        action: multiplayerActions.scrabble.placeTiles([
          { rackTileId: blank.id, row: 7, col: 7, blankLetter: 'A' },
          { rackTileId: tee.id, row: 7, col: 8 },
        ]),
        dispatch: (action) => {
          const next = applyScrabble(state, action).state
          expect(next.board[7][7]?.tile.letter).toBe('A')
          expect(next.board[7][8]?.tile.letter).toBe('T')
        },
      }
    },
  },
  {
    name: 'scrabble.exchangeWithBag',
    arrange: () => {
      const state = scrabbleGame()
      const tileId = state.racks[HOST_ID][0].id
      return {
        action: multiplayerActions.scrabble.exchangeWithBag([tileId]),
        dispatch: (action) => {
          const next = applyScrabble(state, action).state
          expect(next.racks[HOST_ID].some((tile) => tile.id === tileId)).toBe(false)
        },
      }
    },
  },
  {
    name: 'scrabble.offerTrade',
    arrange: () => {
      const state = scrabbleGame()
      const tileId = state.racks[HOST_ID][0].id
      return {
        action: multiplayerActions.scrabble.offerTrade(SECOND_ID, [tileId]),
        dispatch: (action) => {
          const next = applyScrabble(state, action).state
          expect(next.pendingTrade).toMatchObject({ fromUserId: HOST_ID, targetUserId: SECOND_ID })
          expect(next.pendingTrade?.offerId).toMatch(/^[0-9a-f-]{36}$/)
        },
      }
    },
  },
  {
    name: 'scrabble.acceptTrade',
    arrange: () => {
      const trade = scrabbleTrade()
      const responseTile = trade.state.racks[SECOND_ID][0]
      return {
        action: multiplayerActions.scrabble.acceptTrade(trade.offerId, [responseTile.id]),
        dispatch: (action) => {
          const next = applyScrabble(trade.state, action, SECOND_ID).state
          expect(next.pendingTrade).toBeNull()
          expect(next.racks[SECOND_ID].some((tile) => tile.id === trade.offeredTile.id)).toBe(true)
        },
      }
    },
  },
  {
    name: 'scrabble.declineTrade',
    arrange: () => {
      const trade = scrabbleTrade()
      return {
        action: multiplayerActions.scrabble.declineTrade(trade.offerId),
        dispatch: (action) => {
          const next = applyScrabble(trade.state, action, SECOND_ID).state
          expect(next.pendingTrade).toBeNull()
          expect(next.racks[HOST_ID].some((tile) => tile.id === trade.offeredTile.id)).toBe(true)
        },
      }
    },
  },
  {
    name: 'scrabble.cancelTrade',
    arrange: () => {
      const trade = scrabbleTrade()
      return {
        action: multiplayerActions.scrabble.cancelTrade(trade.offerId),
        dispatch: (action) => {
          const next = applyScrabble(trade.state, action, HOST_ID).state
          expect(next.pendingTrade).toBeNull()
        },
      }
    },
  },
  {
    name: 'scrabble.pass',
    arrange: () => ({
      action: multiplayerActions.scrabble.pass(),
      dispatch: (action) => {
        const next = applyScrabble(scrabbleGame(), action)
        expect(next.description).toContain('passed')
        expect(next.state.consecutivePasses).toBe(1)
      },
    }),
  },
  {
    name: 'scrabble.giveUp',
    arrange: () => ({
      action: multiplayerActions.scrabble.giveUp(),
      dispatch: (action) => {
        const next = applyScrabble(scrabbleGame(), action)
        expect(next.description).toContain('gave up')
        expect(next.state.givenUpUserIds).toContain(HOST_ID)
      },
    }),
  },
  {
    name: 'propertyManagement.startGame',
    arrange: () => ({
      action: multiplayerActions.propertyManagement.startGame(),
      dispatch: (action) => {
        const next = PropertyManagement.applyAction(propertyLobby(), action as PMAction, HOST_ID)
        expect(next.phase).toBe('playing')
      },
    }),
  },
  {
    name: 'propertyManagement.rollDice',
    arrange: () => {
      const state = propertyPlaying()
      return {
        action: multiplayerActions.propertyManagement.rollDice(),
        dispatch: (action) => {
          jest.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5)
          const next = PropertyManagement.applyAction(state, action as PMAction, HOST_ID)
          expect(next.dice).toEqual([1, 4])
          expect(next.playerStates[HOST_ID].position).toBe(5)
        },
      }
    },
  },
  {
    name: 'propertyManagement.buyProperty',
    arrange: () => ({
      action: multiplayerActions.propertyManagement.buyProperty(),
      dispatch: (action) => {
        const next = PropertyManagement.applyAction(propertyPurchase(), action as PMAction, HOST_ID)
        expect(next.properties['1'].ownerId).toBe(HOST_ID)
      },
    }),
  },
  {
    name: 'propertyManagement.declineProperty',
    arrange: () => ({
      action: multiplayerActions.propertyManagement.declineProperty(),
      dispatch: (action) => {
        const next = PropertyManagement.applyAction(propertyPurchase(), action as PMAction, HOST_ID)
        expect(next.turnPhase).toBe('auction')
        expect(next.pendingAction?.type).toBe('auction')
      },
    }),
  },
  {
    name: 'propertyManagement.auctionBid',
    arrange: () => ({
      action: multiplayerActions.propertyManagement.auctionBid(125),
      dispatch: (action) => {
        const next = PropertyManagement.applyAction(propertyAuction(), action as PMAction, SECOND_ID)
        expect(next.pendingAction?.type).toBe('auction')
        if (next.pendingAction?.type === 'auction') expect(next.pendingAction.auction.currentBid).toBe(125)
      },
    }),
  },
  {
    name: 'propertyManagement.auctionPass',
    arrange: () => ({
      action: multiplayerActions.propertyManagement.auctionPass(),
      dispatch: (action) => {
        const next = PropertyManagement.applyAction(propertyAuction(), action as PMAction, SECOND_ID)
        expect(next.pendingAction?.type).toBe('auction')
        if (next.pendingAction?.type === 'auction') expect(next.pendingAction.auction.passedUserIds).toContain(SECOND_ID)
      },
    }),
  },
  {
    name: 'propertyManagement.payJailFine',
    arrange: () => {
      const state = propertyPlaying()
      state.playerStates[HOST_ID].inJail = true
      return {
        action: multiplayerActions.propertyManagement.payJailFine(),
        dispatch: (action) => {
          const next = PropertyManagement.applyAction(state, action as PMAction, HOST_ID)
          expect(next.playerStates[HOST_ID]).toMatchObject({ inJail: false, money: 1450 })
        },
      }
    },
  },
  {
    name: 'propertyManagement.useGetOutOfJailCard',
    arrange: () => {
      const state = propertyPlaying()
      state.playerStates[HOST_ID].inJail = true
      state.playerStates[HOST_ID].getOutOfJailFreeCards = 1
      state.playerStates[HOST_ID].getOutOfJailFreeCardDecks = ['legacy']
      return {
        action: multiplayerActions.propertyManagement.useGetOutOfJailCard(),
        dispatch: (action) => {
          const next = PropertyManagement.applyAction(state, action as PMAction, HOST_ID)
          expect(next.playerStates[HOST_ID]).toMatchObject({ inJail: false, getOutOfJailFreeCards: 0 })
        },
      }
    },
  },
  {
    name: 'propertyManagement.buildHouse',
    arrange: () => {
      const state = propertyPlaying()
      state.properties['1'].ownerId = HOST_ID
      state.properties['3'].ownerId = HOST_ID
      return {
        action: multiplayerActions.propertyManagement.buildHouse(1),
        dispatch: (action) => {
          const next = PropertyManagement.applyAction(state, action as PMAction, HOST_ID)
          expect(next.properties['1'].houses).toBe(1)
        },
      }
    },
  },
  {
    name: 'propertyManagement.sellHouse',
    arrange: () => {
      const state = propertyPlaying()
      state.properties['1'] = { ownerId: HOST_ID, mortgaged: false, houses: 1 }
      state.properties['3'] = { ownerId: HOST_ID, mortgaged: false, houses: 1 }
      return {
        action: multiplayerActions.propertyManagement.sellHouse(1),
        dispatch: (action) => {
          const next = PropertyManagement.applyAction(state, action as PMAction, HOST_ID)
          expect(next.properties['1'].houses).toBe(0)
        },
      }
    },
  },
  {
    name: 'propertyManagement.mortgageProperty',
    arrange: () => {
      const state = propertyPlaying()
      state.properties['1'].ownerId = HOST_ID
      return {
        action: multiplayerActions.propertyManagement.mortgageProperty(1),
        dispatch: (action) => {
          const next = PropertyManagement.applyAction(state, action as PMAction, HOST_ID)
          expect(next.properties['1'].mortgaged).toBe(true)
        },
      }
    },
  },
  {
    name: 'propertyManagement.unmortgageProperty',
    arrange: () => {
      const state = propertyPlaying()
      state.properties['1'] = { ownerId: HOST_ID, mortgaged: true, houses: 0 }
      return {
        action: multiplayerActions.propertyManagement.unmortgageProperty(1),
        dispatch: (action) => {
          const next = PropertyManagement.applyAction(state, action as PMAction, HOST_ID)
          expect(next.properties['1'].mortgaged).toBe(false)
        },
      }
    },
  },
  {
    name: 'propertyManagement.declareBankruptcy',
    arrange: () => ({
      action: multiplayerActions.propertyManagement.declareBankruptcy(),
      dispatch: (action) => {
        const next = PropertyManagement.applyAction(propertyPlaying(), action as PMAction, HOST_ID)
        expect(next.playerStates[HOST_ID].isBankrupt).toBe(true)
        expect(next.phase).toBe('completed')
      },
    }),
  },
  {
    name: 'propertyManagement.endTurn',
    arrange: () => {
      const state = propertyPlaying()
      state.turnPhase = 'postRoll'
      state.dice = [2, 3]
      return {
        action: multiplayerActions.propertyManagement.endTurn(),
        dispatch: (action) => {
          const next = PropertyManagement.applyAction(state, action as PMAction, HOST_ID)
          expect(next.currentPlayerUserId).toBe(SECOND_ID)
          expect(next.turnPhase).toBe('preRoll')
        },
      }
    },
  },
  {
    name: 'propertyManagement.acknowledgeCard',
    arrange: () => ({
      action: multiplayerActions.propertyManagement.acknowledgeCard(),
      dispatch: (action) => {
        const next = PropertyManagement.applyAction(
          withPropertyCard({ type: 'collectMoney', amount: 25 }),
          action as PMAction,
          HOST_ID,
        )
        expect(next.playerStates[HOST_ID].money).toBe(1525)
        expect(next.pendingAction).toBeNull()
      },
    }),
  },
]

describe('rendered multiplayer action contract', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each(contractCases)('$name passes the socket schema and reaches the real engine action', ({ arrange }) => {
    const exercise = arrange()
    const validated = makeMoveEventSchema.parse({ gameId: GAME_ID, move: exercise.action }).move
    exercise.dispatch(validated)
  })
})
