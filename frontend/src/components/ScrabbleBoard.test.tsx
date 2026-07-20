import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import type { Game, ScrabbleState, ScrabbleTile } from '../types/game'
import type { User } from '../types/user'
import ScrabbleBoard from './ScrabbleBoard'

const host = { _id: 'host', username: 'Host' } as User
const blankTile: ScrabbleTile = {
  id: '?-1712345678901-blank01',
  letter: '?',
  value: 0,
  isBlank: true,
}
const normalTile: ScrabbleTile = {
  id: '1b63f9d1-6e14-4f3d-84ef-76468cb29d1a',
  letter: 'A',
  value: 1,
  isBlank: false,
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  })
})

function useDesktopLayoutForTest() {
  vi.mocked(window.matchMedia).mockImplementation((query: string): MediaQueryList => ({
    matches: query === '(min-width: 1120px)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

function makeState(overrides: Partial<ScrabbleState> = {}): ScrabbleState {
  return {
    board: Array.from({ length: 15 }, () => Array(15).fill(null)),
    racks: {
      host: [blankTile, normalTile],
      guest: [{ id: 'G-1712345678901-guest01', letter: 'G', value: 2, isBlank: false }],
    },
    rackCounts: { host: 2, guest: 1 },
    scores: { host: 0, guest: 0 },
    bagCount: 10,
    infiniteLetters: false,
    usedPremiumSquares: [],
    pendingTrade: null,
    consecutivePasses: 0,
    givenUpUserIds: [],
    lastScoreEvent: null,
    ...overrides,
  }
}

function makeGame(state = makeState()): Game {
  return {
    _id: 'scrabble-game',
    revision: 4,
    gameType: 'scrabble',
    status: 'active',
    gameCode: 'SCRABBLE',
    players: [
      { userId: 'host', username: 'Host', index: 0, isConnected: true },
      { userId: 'guest', username: 'Guest', index: 1, isConnected: true },
    ],
    currentTurnIndex: 0,
    gameState: state as unknown as Record<string, unknown>,
    moveHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    lastMoveAt: '2026-01-01T00:00:00.000Z',
    metadata: { mode: 'multiplayer' },
  }
}

function renderBoard(
  onMove: ComponentProps<typeof ScrabbleBoard>['onMove'],
  state = makeState(),
  onActionError = vi.fn(),
) {
  return render(
    <ScrabbleBoard
      game={makeGame(state)}
      user={host}
      isMyTurn
      onMove={onMove}
      onSendChat={vi.fn().mockResolvedValue({ success: true })}
      onActionError={onActionError}
    />,
  )
}

describe('Scrabble rendered action reliability', () => {
  it('submits a legacy blank-tile placement and preserves it after a failed action', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn().mockResolvedValue({ success: false, error: 'That word is not valid.' })
    const onActionError = vi.fn()
    renderBoard(onMove, makeState(), onActionError)

    await user.click(screen.getAllByRole('button', { name: 'Blank tile' })[0])
    await user.click(screen.getByRole('button', { name: /^H8, center star; activate to place/ }))

    const dialog = screen.getByRole('dialog', { name: 'Choose Blank Letter' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Letter' }), 'q')
    await user.click(within(dialog).getByRole('button', { name: 'Place' }))
    await user.click(screen.getAllByRole('button', { name: 'Play tiles' })[0])

    await waitFor(() => expect(onMove).toHaveBeenCalledWith({
      type: 'placeTiles',
      placements: [{ rackTileId: blankTile.id, row: 7, col: 7, blankLetter: 'Q' }],
    }))
    expect(onActionError).toHaveBeenCalledWith('That word is not valid.', expect.any(HTMLElement))
    expect(screen.getByRole('button', { name: /^H8, pending Q/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Play tiles' })[0]).toBeEnabled()
  })

  it('keeps a selected legacy blank tile after a rejected bag exchange', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn().mockResolvedValue({ success: false, error: 'The bag changed. Try again.' })
    const onActionError = vi.fn()
    renderBoard(onMove, makeState(), onActionError)

    await user.click(screen.getAllByRole('button', { name: 'Swap tiles' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Blank tile' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Exchange (1)' })[0])

    await waitFor(() => expect(onMove).toHaveBeenCalledWith({
      type: 'exchangeWithBag',
      rackTileIds: [blankTile.id],
    }))
    expect(onActionError).toHaveBeenCalledWith('The bag changed. Try again.', expect.any(HTMLElement))
    expect(screen.getAllByRole('button', { name: 'Blank tile, selected' })[0]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { name: 'Exchange (1)' })[0]).toBeEnabled()
  })

  it('includes the current offer id and a blank tile id when accepting a trade', async () => {
    useDesktopLayoutForTest()
    const user = userEvent.setup()
    const onMove = vi.fn().mockResolvedValue({ success: true })
    renderBoard(onMove, makeState({
      pendingTrade: {
        offerId: '2c5b4930-c103-40a0-9bcc-990ced4bff34',
        fromUserId: 'guest',
        targetUserId: 'host',
        offeredTileCount: 1,
        offeredTiles: [{ id: 'T-1712345678901-trade01', letter: 'T', value: 1, isBlank: false }],
      },
    }))

    await user.click(screen.getByRole('button', { name: 'Review trade' }))
    await user.click(screen.getAllByRole('button', { name: 'Blank tile' })[0])
    await user.click(await screen.findByRole('button', { name: 'Accept trade' }))

    expect(onMove).toHaveBeenCalledWith({
      type: 'respondTrade',
      offerId: '2c5b4930-c103-40a0-9bcc-990ced4bff34',
      accept: true,
      rackTileIds: [blankTile.id],
    })
  })

  it('keeps a chat draft and focus through an unrelated game rerender', async () => {
    useDesktopLayoutForTest()
    const user = userEvent.setup()
    const onMove = vi.fn().mockResolvedValue({ success: true })
    const onSendChat = vi.fn().mockResolvedValue({ success: true })
    const game = makeGame()
    const view = render(
      <ScrabbleBoard game={game} user={host} isMyTurn onMove={onMove} onSendChat={onSendChat} />,
    )

    expect(screen.getAllByRole('button', { name: 'Blank tile' })).toHaveLength(1)
    await user.click(screen.getByRole('tab', { name: 'Chat' }))
    const chatInput = await screen.findByRole('textbox', { name: 'Message this lobby' })
    await user.type(chatInput, 'Keep this message')
    expect(chatInput).toHaveFocus()

    view.rerender(
      <ScrabbleBoard
        game={{
          ...game,
          revision: (game.revision ?? 0) + 1,
          players: game.players.map((player) => player.userId === 'guest' ? { ...player, isConnected: false } : player),
        }}
        user={host}
        isMyTurn
        onMove={onMove}
        onSendChat={onSendChat}
      />,
    )

    expect(chatInput).toHaveValue('Keep this message')
    expect(chatInput).toHaveFocus()
  })
})
