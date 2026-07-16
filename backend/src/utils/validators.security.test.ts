import {
  joinGameSchema,
  joinRoomEventSchema,
  makeMoveEventSchema,
  sendChatMessageEventSchema,
  singlePlayerReplaySchema,
} from './validators'
import { MAX_REPLAY_INPUTS, MAX_REPLAY_TICKS } from '@games-arena/game-engine'

const gameId = '0123456789abcdef01234567'

describe('security-sensitive socket validators', () => {
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
    expect(makeMoveEventSchema.safeParse({ gameId, move: { type: 'submitAnswers', answers: ['x'.repeat(161)] } }).success).toBe(false)
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
