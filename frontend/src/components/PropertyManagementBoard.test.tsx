import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Game, PropertyManagementState } from '../types/game'
import type { User } from '../types/user'
import PropertyManagementBoard from './PropertyManagementBoard'

const host = { _id: 'host', username: 'Host' } as User

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  })
})

function makeAuctionState(): PropertyManagementState {
  return {
    phase: 'playing',
    hostUserId: 'host',
    currentPlayerUserId: 'host',
    turnPhase: 'auction',
    dice: [3, 4],
    doublesCount: 0,
    extraRollPending: false,
    playerOrder: ['host', 'guest'],
    playerStates: {
      host: {
        userId: 'host', username: 'Host', position: 3, money: 500,
        inJail: false, jailRollCount: 0, getOutOfJailFreeCards: 0, isBankrupt: false,
      },
      guest: {
        userId: 'guest', username: 'Guest', position: 5, money: 400,
        inJail: false, jailRollCount: 0, getOutOfJailFreeCards: 0, isBankrupt: false,
      },
    },
    properties: {},
    chanceCardIndex: 0,
    communityChestCardIndex: 0,
    chanceFreeCardReturned: true,
    communityChestFreeCardReturned: true,
    pendingAction: {
      type: 'auction',
      auction: {
        squareIndex: 3,
        currentBid: 100,
        highBidderUserId: 'guest',
        passedUserIds: [],
        activeUserIds: ['host', 'guest'],
        currentBidderIndex: 0,
      },
    },
    lastEventMessage: 'Auction in progress',
    bankruptPlayerIds: [],
    winnerId: null,
  }
}

function makeGame(): Game {
  return {
    _id: 'property-game',
    revision: 8,
    gameType: 'propertyManagement',
    status: 'active',
    gameCode: 'PROPERTY',
    players: [
      { userId: 'host', username: 'Host', index: 0, isConnected: true },
      { userId: 'guest', username: 'Guest', index: 1, isConnected: true },
    ],
    currentTurnIndex: 0,
    gameState: makeAuctionState() as unknown as Record<string, unknown>,
    moveHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    lastMoveAt: '2026-01-01T00:00:00.000Z',
    metadata: { mode: 'multiplayer' },
  }
}

describe('Property Management rendered auction reliability', () => {
  it('accepts a multi-digit bid without remounting and preserves it when the server rejects it', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn().mockResolvedValue({ success: false, error: 'The auction changed. Bid again.' })
    const onSendChat = vi.fn().mockResolvedValue({ success: true })
    const onActionError = vi.fn()
    const game = makeGame()
    const view = render(
      <PropertyManagementBoard
        game={game}
        user={host}
        onMove={onMove}
        onSendChat={onSendChat}
        onActionError={onActionError}
      />,
    )

    const bidInput = screen.getByRole('textbox', { name: /Your bid/ })
    const bidButton = screen.getByRole('button', { name: 'Bid' })

    expect(view.container.querySelectorAll('.pm-map-token.player-avatar')).toHaveLength(2)
    expect(screen.getAllByRole('textbox', { name: /Your bid/ })).toHaveLength(1)
    expect(bidInput).toHaveAttribute('inputmode', 'numeric')
    expect(bidInput).toHaveAttribute('pattern', '[0-9]*')
    expect(bidInput).toHaveAttribute('enterkeyhint', 'done')

    await user.type(bidInput, '125')
    expect(bidInput).toHaveValue('125')
    expect(bidInput).toHaveFocus()
    expect(bidButton).toBeEnabled()

    view.rerender(
      <PropertyManagementBoard
        game={{ ...game, revision: (game.revision ?? 0) + 1 }}
        user={host}
        onMove={onMove}
        onSendChat={onSendChat}
        onActionError={onActionError}
      />,
    )
    expect(bidInput).toHaveValue('125')
    expect(bidInput).toHaveFocus()

    await user.click(bidButton)

    await waitFor(() => expect(onMove).toHaveBeenCalledWith({ type: 'auctionBid', amount: 125 }))
    expect(onActionError).toHaveBeenCalledWith('The auction changed. Bid again.', bidButton)
    expect(bidInput).toHaveValue('125')
  })

  it('clears a bid after a successful pass and when the active bidder changes', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn().mockResolvedValue({ success: true })
    const onSendChat = vi.fn().mockResolvedValue({ success: true })
    const game = makeGame()
    const view = render(
      <PropertyManagementBoard game={game} user={host} onMove={onMove} onSendChat={onSendChat} />,
    )

    const bidInput = screen.getByRole('textbox', { name: /Your bid/ })
    await user.type(bidInput, '125')
    await user.click(screen.getByRole('button', { name: 'Pass' }))
    await waitFor(() => expect(bidInput).toHaveValue(''))

    await user.type(bidInput, '140')
    const guestTurn = makeAuctionState()
    if (guestTurn.pendingAction?.type !== 'auction') throw new Error('Expected auction state')
    guestTurn.pendingAction.auction.currentBidderIndex = 1
    view.rerender(
      <PropertyManagementBoard
        game={{ ...game, revision: (game.revision ?? 0) + 1, gameState: guestTurn as unknown as Record<string, unknown> }}
        user={host}
        onMove={onMove}
        onSendChat={onSendChat}
      />,
    )

    const hostTurn = makeAuctionState()
    view.rerender(
      <PropertyManagementBoard
        game={{ ...game, revision: (game.revision ?? 0) + 2, gameState: hostTurn as unknown as Record<string, unknown> }}
        user={host}
        onMove={onMove}
        onSendChat={onSendChat}
      />,
    )
    expect(screen.getByRole('textbox', { name: /Your bid/ })).toHaveValue('')
  })
})
