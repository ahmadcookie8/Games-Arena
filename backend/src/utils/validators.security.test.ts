import {
  joinGameSchema,
  joinRoomEventSchema,
  makeMoveEventSchema,
  sendChatMessageEventSchema,
  singlePlayerReplaySchema,
} from './validators'
import { MAX_REPLAY_INPUTS, MAX_REPLAY_TICKS } from '@games-arena/game-engine'
import { multiplayerActions } from '../../../frontend/src/lib/multiplayerActions'

const gameId = '0123456789abcdef01234567'

describe('security-sensitive socket validators', () => {
  const tileId = 'A-1700000000000-abc123'
  const offerId = 'da4ba04b-336d-45f5-a764-b7456c82d7bd'

  it.each([
    ['ticTacToe.place', multiplayerActions.ticTacToe.place('4')],
    ['wisecracker.startMatch', multiplayerActions.wisecracker.startMatch(3)],
    ['wisecracker.refreshPrompt', multiplayerActions.wisecracker.refreshPrompt()],
    ['wisecracker.setPrompt', multiplayerActions.wisecracker.setPrompt('A _ needs _.')],
    ['wisecracker.submitAnswers', multiplayerActions.wisecracker.submitAnswers(['first', 'second'])],
    ['wisecracker.revealNextAnswer', multiplayerActions.wisecracker.revealNextAnswer()],
    ['wisecracker.selectRoundWinner', multiplayerActions.wisecracker.selectRoundWinner('a'.repeat(32))],
    ['wisecracker.startNextRound', multiplayerActions.wisecracker.startNextRound()],
    ['scrabble.placeTiles', multiplayerActions.scrabble.placeTiles([{ rackTileId: tileId, row: 7, col: 7 }])],
    ['scrabble.exchangeWithBag', multiplayerActions.scrabble.exchangeWithBag([tileId])],
    ['scrabble.offerTrade', multiplayerActions.scrabble.offerTrade(gameId, [tileId])],
    ['scrabble.acceptTrade', multiplayerActions.scrabble.acceptTrade(offerId, [tileId])],
    ['scrabble.declineTrade', multiplayerActions.scrabble.declineTrade(offerId)],
    ['scrabble.cancelTrade', multiplayerActions.scrabble.cancelTrade(offerId)],
    ['scrabble.pass', multiplayerActions.scrabble.pass()],
    ['scrabble.giveUp', multiplayerActions.scrabble.giveUp()],
    ['propertyManagement.startGame', multiplayerActions.propertyManagement.startGame()],
    ['propertyManagement.rollDice', multiplayerActions.propertyManagement.rollDice()],
    ['propertyManagement.buyProperty', multiplayerActions.propertyManagement.buyProperty()],
    ['propertyManagement.declineProperty', multiplayerActions.propertyManagement.declineProperty()],
    ['propertyManagement.auctionBid', multiplayerActions.propertyManagement.auctionBid(125)],
    ['propertyManagement.auctionPass', multiplayerActions.propertyManagement.auctionPass()],
    ['propertyManagement.payJailFine', multiplayerActions.propertyManagement.payJailFine()],
    ['propertyManagement.useGetOutOfJailCard', multiplayerActions.propertyManagement.useGetOutOfJailCard()],
    ['propertyManagement.buildHouse', multiplayerActions.propertyManagement.buildHouse(1)],
    ['propertyManagement.sellHouse', multiplayerActions.propertyManagement.sellHouse(1)],
    ['propertyManagement.mortgageProperty', multiplayerActions.propertyManagement.mortgageProperty(1)],
    ['propertyManagement.unmortgageProperty', multiplayerActions.propertyManagement.unmortgageProperty(1)],
    ['propertyManagement.declareBankruptcy', multiplayerActions.propertyManagement.declareBankruptcy()],
    ['propertyManagement.endTurn', multiplayerActions.propertyManagement.endTurn()],
    ['propertyManagement.acknowledgeCard', multiplayerActions.propertyManagement.acknowledgeCard()],
  ])('accepts the rendered frontend action contract for %s', (_name, move) => {
    expect(makeMoveEventSchema.safeParse({ gameId, move }).success).toBe(true)
  })

  it.each([
    null,
    [],
    { gameId: { $ne: null } },
    { gameId: gameId.toUpperCase() },
    { gameId, unexpected: true },
  ])('rejects malformed joinRoom payload %#', (payload) => {
    expect(joinRoomEventSchema.safeParse(payload).success).toBe(false)
  })

  it('accepts only exact Tic Tac Toe cells', () => {
    expect(makeMoveEventSchema.safeParse({ gameId, move: '8' }).success).toBe(true)
    expect(makeMoveEventSchema.safeParse({ gameId, move: '9' }).success).toBe(false)
    expect(makeMoveEventSchema.safeParse({ gameId, move: { $ne: null } }).success).toBe(false)
  })

  it('rejects unsafe Property Management bids', () => {
    expect(makeMoveEventSchema.safeParse({ gameId, move: { type: 'auctionBid', amount: 100 } }).success).toBe(true)
    expect(makeMoveEventSchema.safeParse({ gameId, move: { type: 'auctionBid', amount: Number.POSITIVE_INFINITY } }).success).toBe(false)
    expect(makeMoveEventSchema.safeParse({ gameId, move: { type: 'auctionBid', amount: 1.5 } }).success).toBe(false)
    expect(makeMoveEventSchema.safeParse({ gameId, move: { type: 'auctionBid', amount: Number.MAX_SAFE_INTEGER + 1 } }).success).toBe(false)
  })

  it('bounds Wisecracker prompts and answers', () => {
    expect(makeMoveEventSchema.safeParse({ gameId, move: { type: 'setPrompt', prompt: 'x'.repeat(240) } }).success).toBe(true)
    expect(makeMoveEventSchema.safeParse({ gameId, move: { type: 'setPrompt', prompt: 'x'.repeat(241) } }).success).toBe(false)
    expect(makeMoveEventSchema.safeParse({ gameId, move: { type: 'submitAnswers', answers: ['x'.repeat(160)] } }).success).toBe(true)
    expect(makeMoveEventSchema.safeParse({ gameId, move: { type: 'submitAnswers', answers: ['x'.repeat(161)] } }).success).toBe(false)
  })

  it('accepts UUID and legacy Scrabble tile IDs, including blank tiles', () => {
    const uuidTileId = 'b3fdd5f9-92bb-4efe-8f8e-9122d2f307df'
    const legacyTileId = 'A-1700000000000-abc123'
    const legacyBlankTileId = '?-1700000000001-def456'

    expect(makeMoveEventSchema.safeParse({
      gameId,
      move: { type: 'placeTiles', placements: [{ rackTileId: legacyBlankTileId, row: 7, col: 7, blankLetter: 'Q' }] },
    }).success).toBe(true)
    expect(makeMoveEventSchema.safeParse({
      gameId,
      move: { type: 'exchangeWithBag', rackTileIds: [uuidTileId, legacyTileId, legacyBlankTileId] },
    }).success).toBe(true)
    expect(makeMoveEventSchema.safeParse({
      gameId,
      move: { type: 'offerTrade', targetUserId: gameId, rackTileIds: [legacyBlankTileId] },
    }).success).toBe(true)
  })

  it('validates Scrabble trade references without accepting arbitrary identifiers', () => {
    const tileId = 'A-1700000000000-abc123'
    const offerId = 'da4ba04b-336d-45f5-a764-b7456c82d7bd'
    const legacyOfferId = '1700000000000-abc123'

    expect(makeMoveEventSchema.safeParse({
      gameId,
      move: { type: 'respondTrade', offerId, accept: true, rackTileIds: [tileId] },
    }).success).toBe(true)
    expect(makeMoveEventSchema.safeParse({
      gameId,
      move: { type: 'cancelTrade', offerId: legacyOfferId },
    }).success).toBe(true)
    expect(makeMoveEventSchema.safeParse({
      gameId,
      move: { type: 'respondTrade', accept: false },
    }).success).toBe(true)
    expect(makeMoveEventSchema.safeParse({
      gameId,
      move: { type: 'exchangeWithBag', rackTileIds: ['q1'] },
    }).success).toBe(false)
    expect(makeMoveEventSchema.safeParse({
      gameId,
      move: { type: 'cancelTrade', offerId: { $ne: null } },
    }).success).toBe(false)
  })

  it('bounds and trims chat without coercing values', () => {
    const parsed = sendChatMessageEventSchema.parse({ gameId, text: '  hello  ' })
    expect(parsed.text).toBe('hello')
    expect(sendChatMessageEventSchema.safeParse({ gameId, text: 'x'.repeat(501) }).success).toBe(false)
    expect(sendChatMessageEventSchema.safeParse({ gameId, text: 12 }).success).toBe(false)
  })

  it('accepts legacy six-character and new eight-character invite codes only', () => {
    expect(joinGameSchema.parse({ gameCode: 'abc123' }).gameCode).toBe('ABC123')
    expect(joinGameSchema.parse({ gameCode: 'abcd2345' }).gameCode).toBe('ABCD2345')
    expect(joinGameSchema.safeParse({ gameCode: 'ABCDE' }).success).toBe(false)
    expect(joinGameSchema.safeParse({ gameCode: 'ABCDEFGHI' }).success).toBe(false)
  })

  it('accepts only bounded, ordered replay inputs and no client-derived state', () => {
    expect(singlePlayerReplaySchema.safeParse({
      version: 1,
      tickCount: 4,
      inputs: [{ tick: 1, direction: 'up' }, { tick: 3, direction: 'left' }],
    }).success).toBe(true)

    expect(singlePlayerReplaySchema.safeParse({
      version: 1,
      tickCount: 4,
      inputs: [{ tick: 2, direction: 'up' }, { tick: 1, direction: 'left' }],
    }).success).toBe(false)
    expect(singlePlayerReplaySchema.safeParse({
      version: 1,
      tickCount: 4,
      inputs: [{ tick: 4, direction: 'up' }],
    }).success).toBe(false)
    expect(singlePlayerReplaySchema.safeParse({
      version: 1,
      tickCount: MAX_REPLAY_TICKS + 1,
      inputs: [],
    }).success).toBe(false)
    expect(singlePlayerReplaySchema.safeParse({
      version: 1,
      tickCount: MAX_REPLAY_INPUTS + 1,
      inputs: Array.from({ length: MAX_REPLAY_INPUTS + 1 }, (_, tick) => ({ tick, direction: 'up' })),
    }).success).toBe(false)
    expect(singlePlayerReplaySchema.safeParse({
      version: 1,
      tickCount: 4,
      inputs: [],
      seed: 'attacker-controlled',
      score: 999999,
      gameState: { isGameOver: true },
    }).success).toBe(false)
  })
})
