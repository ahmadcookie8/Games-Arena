import { presentGameForUser } from './gamePresenter'

describe('presentGameForUser', () => {
  it('redacts other Scrabble racks while preserving the current user rack', () => {
    const game = {
      gameType: 'scrabble',
      gameState: {
        racks: {
          user1: [{ id: 'a', letter: 'A' }],
          user2: [{ id: 'z', letter: 'Z' }],
        },
        pendingTrade: {
          fromUserId: 'user1',
          targetUserId: 'user2',
          offeredTiles: [{ id: 'a', letter: 'A' }],
        },
      },
    }

    const presented = presentGameForUser(game, 'user1')
    const state = presented.gameState as { racks: Record<string, unknown[]>; pendingTrade: { offeredTiles: unknown[] } }

    expect(state.racks.user1).toHaveLength(1)
    expect(state.racks.user2).toHaveLength(0)
    expect(state.pendingTrade.offeredTiles).toHaveLength(1)
  })

  it('hides offered trade tiles from uninvolved players', () => {
    const game = {
      gameType: 'scrabble',
      gameState: {
        racks: {
          user1: [{ id: 'a', letter: 'A' }],
          user2: [{ id: 'z', letter: 'Z' }],
          user3: [{ id: 'e', letter: 'E' }],
        },
        pendingTrade: {
          fromUserId: 'user1',
          targetUserId: 'user2',
          offeredTiles: [{ id: 'a', letter: 'A' }],
        },
      },
    }

    const presented = presentGameForUser(game, 'user3')
    const state = presented.gameState as { pendingTrade: { offeredTiles: unknown[] } }

    expect(state.pendingTrade.offeredTiles).toHaveLength(0)
  })
})
