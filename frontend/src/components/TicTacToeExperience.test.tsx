import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Game } from '../types/game'
import TicTacToeExperience from './TicTacToeExperience'

const game: Game = {
  _id: 'tic-sheet-game',
  revision: 1,
  gameType: 'ticTacToe',
  status: 'active',
  gameCode: 'TICTACTO',
  players: [
    { userId: 'host', username: 'Host', index: 0, isConnected: true },
    { userId: 'guest', username: 'Guest', index: 1, isConnected: true },
  ],
  currentTurnIndex: 0,
  gameState: { board: Array(9).fill(null), currentSymbol: 'X' },
  moveHistory: [],
  chatMessages: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  lastMoveAt: '2026-01-01T00:00:00.000Z',
  metadata: { mode: 'multiplayer' },
}

describe('TicTacToeExperience mobile inspector', () => {
  it('uses real in-sheet tabs with a valid labelled tabpanel', async () => {
    const user = userEvent.setup()
    render(
      <TicTacToeExperience
        game={game}
        currentUserId="host"
        onMove={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Players' }))
    const dialog = await screen.findByRole('dialog', { name: 'Players' })
    const playersTab = within(dialog).getByRole('tab', { name: 'Players' })
    const historyTab = within(dialog).getByRole('tab', { name: 'History' })
    const panel = within(dialog).getByRole('tabpanel')

    expect(playersTab).toHaveAttribute('aria-selected', 'true')
    expect(panel).toHaveAttribute('aria-labelledby', playersTab.id)

    await user.click(historyTab)
    expect(historyTab).toHaveAttribute('aria-selected', 'true')
    expect(panel).toHaveAttribute('aria-labelledby', historyTab.id)
  })
})
