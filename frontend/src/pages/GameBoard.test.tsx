import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../components/ThemeProvider'
import type { Game } from '../types/game'
import GameBoard from './GameBoard'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  emitWithAck: vi.fn(),
  on: vi.fn(() => vi.fn()),
  applySnapshot: vi.fn(() => true),
  appendChatMessage: vi.fn(),
  updatePlayerPresence: vi.fn(),
  refetch: vi.fn(),
  apiPost: vi.fn(),
  game: {
    _id: 'tic-game',
    revision: 1,
    gameType: 'ticTacToe' as const,
    status: 'active' as const,
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
    metadata: { mode: 'multiplayer' as const },
  } as Game,
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => mocks.navigate,
  useParams: () => ({ gameId: 'tic-game' }),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { _id: 'host', username: 'Host' } }),
}))

vi.mock('../hooks/useGameState', () => ({
  useGameState: () => ({
    game: mocks.game,
    loading: false,
    error: null,
    refetch: mocks.refetch,
    applySnapshot: mocks.applySnapshot,
    appendChatMessage: mocks.appendChatMessage,
    updatePlayerPresence: mocks.updatePlayerPresence,
  }),
}))

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    emitWithAck: mocks.emitWithAck,
    on: mocks.on,
    connected: true,
    connectionError: null,
  }),
}))

vi.mock('../lib/api', () => ({
  default: { post: mocks.apiPost },
}))

describe('GameBoard live-action reliability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.on.mockImplementation(() => vi.fn())
    mocks.applySnapshot.mockReturnValue(true)
    Object.assign(mocks.game, {
      revision: 1,
      status: 'active',
      currentTurnIndex: 0,
      gameState: { board: Array(9).fill(null), currentSymbol: 'X' },
      moveHistory: [],
      chatMessages: [],
      result: undefined,
    } satisfies Partial<Game>)
  })

  it('keeps game actions disabled until the room authorization acknowledgement arrives', async () => {
    let resolveJoin: ((value: unknown) => void) | undefined
    const joinAcknowledgement = new Promise((resolve) => { resolveJoin = resolve })
    mocks.emitWithAck.mockImplementation((event: string) => {
      if (event === 'joinRoom') return joinAcknowledgement
      return Promise.resolve({
        ok: true,
        data: { gameId: 'tic-game', revision: 2, game: { ...mocks.game, revision: 2 } },
      })
    })

    render(<ThemeProvider><GameBoard /></ThemeProvider>)

    const cell = await screen.findByRole('button', { name: 'Row 1, column 1, empty' })
    expect(cell).toBeDisabled()
    fireEvent.click(cell)
    expect(mocks.emitWithAck.mock.calls.filter(([event]) => event === 'makeMove')).toHaveLength(0)

    await act(async () => {
      resolveJoin?.({
        ok: true,
        data: { gameId: 'tic-game', revision: 1, game: mocks.game },
      })
      await joinAcknowledgement
    })

    await waitFor(() => expect(cell).toBeEnabled())
    fireEvent.click(cell)
    await waitFor(() => {
      expect(mocks.emitWithAck.mock.calls.filter(([event]) => event === 'makeMove')).toHaveLength(1)
    })
  })

  it('submits only one move when two Tic Tac Toe cells are clicked synchronously', async () => {
    let resolveMove: ((value: unknown) => void) | undefined
    const moveAcknowledgement = new Promise((resolve) => { resolveMove = resolve })
    mocks.emitWithAck.mockImplementation((event: string) => {
      if (event === 'joinRoom') {
        return Promise.resolve({
          ok: true,
          data: { gameId: 'tic-game', revision: 1, game: mocks.game },
        })
      }
      return moveAcknowledgement
    })

    render(<ThemeProvider><GameBoard /></ThemeProvider>)

    const firstCell = await screen.findByRole('button', { name: 'Row 1, column 1, empty' })
    const secondCell = screen.getByRole('button', { name: 'Row 1, column 2, empty' })
    fireEvent.click(firstCell)
    fireEvent.click(secondCell)

    await waitFor(() => {
      const moveCalls = mocks.emitWithAck.mock.calls.filter(([event]) => event === 'makeMove')
      expect(moveCalls).toEqual([['makeMove', { gameId: 'tic-game', move: '0' }]])
    })

    await act(async () => {
      resolveMove?.({
        ok: true,
        data: { gameId: 'tic-game', revision: 2, game: { ...mocks.game, revision: 2 } },
      })
      await moveAcknowledgement
    })
  })

  it('submits only one replay when Play Again is clicked twice synchronously', async () => {
    Object.assign(mocks.game, {
      status: 'completed',
      result: {
        winner: 'host',
        winnerName: 'Host',
        isDraw: false,
        winType: 'line',
      },
    } satisfies Partial<Game>)
    mocks.emitWithAck.mockResolvedValue({
      ok: true,
      data: { gameId: 'tic-game', revision: 1, game: mocks.game },
    })
    let resolveReplay: ((value: unknown) => void) | undefined
    const replayResponse = new Promise((resolve) => { resolveReplay = resolve })
    mocks.apiPost.mockReturnValue(replayResponse)

    render(<ThemeProvider><GameBoard /></ThemeProvider>)

    const playAgain = (await screen.findAllByRole('button', { name: 'Play Again' }))[0]
    fireEvent.click(playAgain)
    fireEvent.click(playAgain)

    expect(mocks.apiPost).toHaveBeenCalledTimes(1)
    expect(mocks.apiPost).toHaveBeenCalledWith('/api/games/tic-game/replay')

    await act(async () => {
      resolveReplay?.({ data: { game: { _id: 'replay-game' } } })
      await replayResponse
    })
    expect(mocks.navigate).toHaveBeenCalledWith('/game/replay-game', { replace: true })
  })

  it('shows fatal move errors only in the global modal, not a duplicate inline alert', async () => {
    mocks.emitWithAck.mockImplementation((event: string) => {
      if (event === 'joinRoom') {
        return Promise.resolve({
          ok: true,
          data: { gameId: 'tic-game', revision: 1, game: mocks.game },
        })
      }
      return Promise.resolve({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'You cannot make a move in this game.' },
      })
    })

    render(<ThemeProvider><GameBoard /></ThemeProvider>)

    const cell = await screen.findByRole('button', { name: 'Row 1, column 1, empty' })
    await waitFor(() => expect(cell).toBeEnabled())
    fireEvent.click(cell)

    expect(await screen.findByRole('dialog', { name: 'Game access denied' })).toBeInTheDocument()
    expect(screen.getAllByText('You cannot make a move in this game.')).toHaveLength(1)
    expect(screen.queryAllByRole('alert').filter((alert) => alert.textContent?.includes('You cannot make a move in this game.'))).toHaveLength(0)
  })
})
