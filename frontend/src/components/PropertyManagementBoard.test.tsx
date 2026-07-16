import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  it('blocks malformed bids and preserves a valid bid when the server rejects it', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn().mockResolvedValue({ success: false, error: 'The auction changed. Bid again.' })
    render(
      <PropertyManagementBoard
        game={makeGame()}
        user={host}
        onMove={onMove}
        onSendChat={vi.fn().mockResolvedValue({ success: true })}
      />,
    )

    const getBidInput = () => screen.getAllByRole('spinbutton', { name: /Your bid/ })[0]
    const getBidButton = () => screen.getAllByRole('button', { name: 'Bid' })[0]

    fireEvent.change(getBidInput(), { target: { value: '100.5' } })
    expect(getBidButton()).toBeDisabled()
    expect(screen.getAllByText('Your bid must be a whole dollar amount.')[0]).toBeInTheDocument()
    expect(onMove).not.toHaveBeenCalled()

    fireEvent.change(getBidInput(), { target: { value: '501' } })
    expect(getBidButton()).toBeDisabled()
    expect(screen.getAllByText('You do not have enough cash for that bid.')[0]).toBeInTheDocument()
    expect(onMove).not.toHaveBeenCalled()

    fireEvent.change(getBidInput(), { target: { value: '125' } })
    expect(getBidButton()).toBeEnabled()
    await user.click(getBidButton())

    await waitFor(() => expect(onMove).toHaveBeenCalledWith({ type: 'auctionBid', amount: 125 }))
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('The auction changed. Bid again.')
    expect(getBidInput()).toHaveValue(125)
  })
})
