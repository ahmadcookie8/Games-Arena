import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  userId: 'host',
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
  useAuth: () => ({ user: { _id: mocks.userId, username: mocks.userId === 'host' ? 'Host' : 'Guest' } }),
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
    mocks.userId = 'host'
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

    const playAgain = await screen.findByRole('button', { name: 'Play Again' })
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

  it('releases its active room lease when the game route unmounts', async () => {
    mocks.emitWithAck.mockResolvedValue({
      ok: true,
      data: { gameId: 'tic-game', revision: 1, game: mocks.game },
    })

    const { unmount } = render(<ThemeProvider><GameBoard /></ThemeProvider>)

    await waitFor(() => {
      expect(mocks.emitWithAck).toHaveBeenCalledWith('joinRoom', { gameId: 'tic-game' })
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Row 1, column 1, empty' })).toBeEnabled())

    unmount()

    expect(mocks.emitWithAck.mock.calls.filter(([event]) => event === 'leaveRoom')).toEqual([
      ['leaveRoom', { gameId: 'tic-game' }],
    ])
  })

  it('releases a room again when its join acknowledgement arrives after unmount', async () => {
    let resolveJoin: ((value: unknown) => void) | undefined
    const joinAcknowledgement = new Promise((resolve) => { resolveJoin = resolve })
    mocks.emitWithAck.mockImplementation((event: string) => event === 'joinRoom'
      ? joinAcknowledgement
      : Promise.resolve({ ok: true, data: {} }))

    const { unmount } = render(<ThemeProvider><GameBoard /></ThemeProvider>)
    await waitFor(() => expect(mocks.emitWithAck).toHaveBeenCalledWith('joinRoom', { gameId: 'tic-game' }))
    unmount()

    expect(mocks.emitWithAck.mock.calls.filter(([event]) => event === 'leaveRoom')).toHaveLength(1)

    await act(async () => {
      resolveJoin?.({
        ok: true,
        data: { gameId: 'tic-game', revision: 1, game: mocks.game },
      })
      await joinAcknowledgement
    })

    expect(mocks.emitWithAck.mock.calls.filter(([event]) => event === 'leaveRoom')).toHaveLength(2)
  })

  it('explains an active-room connection-limit rejection without disconnecting the shared socket', async () => {
    mocks.emitWithAck.mockResolvedValue({
      ok: false,
      error: {
        code: 'SOCKET_CONNECTION_LIMIT',
        message: 'Too many active game connections.',
      },
    })

    render(<ThemeProvider><GameBoard /></ThemeProvider>)

    expect(await screen.findByRole('dialog', { name: 'Connection limit reached' })).toBeInTheDocument()
    expect(screen.getByText(/already has 10 active game connections/i)).toBeInTheDocument()
    expect(screen.getByText(/leave another active game tab/i)).toBeInTheDocument()
  })

  it('shows rejected nonfatal actions in the global modal', async () => {
    mocks.emitWithAck.mockImplementation((event: string) => {
      if (event === 'joinRoom') {
        return Promise.resolve({
          ok: true,
          data: { gameId: 'tic-game', revision: 1, game: mocks.game },
        })
      }
      return Promise.resolve({
        ok: false,
        error: { code: 'INVALID_MOVE', message: 'That square is no longer available.' },
      })
    })

    render(<ThemeProvider><GameBoard /></ThemeProvider>)

    const cell = await screen.findByRole('button', { name: 'Row 1, column 1, empty' })
    await waitFor(() => expect(cell).toBeEnabled())
    fireEvent.click(cell)

    expect(await screen.findByRole('dialog', { name: 'Action not available' })).toBeInTheDocument()
    expect(screen.getByText('That square is no longer available.')).toBeInTheDocument()
  })

  it('keeps the active invite code in the masthead and routes clipboard failures to one modal', async () => {
    mocks.emitWithAck.mockResolvedValue({
      ok: true,
      data: { gameId: 'tic-game', revision: 1, game: mocks.game },
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
    })

    render(<ThemeProvider><GameBoard /></ThemeProvider>)

    const copyButton = await screen.findByRole('button', { name: /copy invite code tictacto/i })
    copyButton.focus()
    fireEvent.click(copyButton)

    expect(await screen.findByRole('dialog', { name: 'Action not available' })).toBeInTheDocument()
    expect(screen.getAllByText(/invite code could not be copied/i)).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(copyButton).toHaveFocus())
  })

  it('shows completed guests a host-waiting state without a Play Again action', async () => {
    mocks.userId = 'guest'
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

    render(<ThemeProvider><GameBoard /></ThemeProvider>)

    expect(await screen.findByText(/waiting for the host to start another game/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play Again' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy invite code/i })).not.toBeInTheDocument()
    expect(screen.getByText('TICTACTO')).toBeInTheDocument()
  })

  it('lets a non-host participant close an active game for everyone', async () => {
    mocks.userId = 'guest'
    mocks.emitWithAck.mockResolvedValue({
      ok: true,
      data: { gameId: 'tic-game', revision: 1, game: mocks.game },
    })
    mocks.apiPost.mockResolvedValue({ data: {} })

    render(<ThemeProvider><GameBoard /></ThemeProvider>)

    const closeTrigger = await screen.findByRole('button', { name: 'Close game' })
    fireEvent.click(closeTrigger)

    const dialog = await screen.findByRole('dialog', { name: 'Close this game for everyone?' })
    expect(within(dialog).getByText(/no result or player statistics will be recorded/i)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close game' }))

    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledWith('/api/games/tic-game/close'))
    expect(mocks.navigate).toHaveBeenCalledWith('/?tab=multiplayer', { replace: true })
  })

  it('does not show the close action to a nonparticipant', async () => {
    mocks.userId = 'stranger'
    mocks.emitWithAck.mockResolvedValue({
      ok: true,
      data: { gameId: 'tic-game', revision: 1, game: mocks.game },
    })

    render(<ThemeProvider><GameBoard /></ThemeProvider>)

    await waitFor(() => expect(screen.getByText("Host's turn")).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Close game' })).not.toBeInTheDocument()
  })
})
