import { describe, expect, it } from 'vitest'
import {
  TIC_TAC_TOE_WINNING_LINES,
  formatTicTacToeMove,
  getLatestTicTacToeMoveIndex,
  getTicTacToeParticipants,
  getTicTacToeWinningLine,
  normalizeTicTacToeBoard,
  resolveTicTacToeActionMode,
} from './ticTacToeUi'

describe('Tic Tac Toe winning lines', () => {
  it.each(TIC_TAC_TOE_WINNING_LINES)('detects the winning line %j', (...line) => {
    const board = Array<'X' | 'O' | null>(9).fill(null)
    line.forEach((index) => { board[index] = 'X' })

    expect(getTicTacToeWinningLine(board)).toEqual(line)
  })

  it('does not report a full draw board as a win', () => {
    expect(getTicTacToeWinningLine([
      'X', 'O', 'X',
      'X', 'O', 'O',
      'O', 'X', 'X',
    ])).toBeNull()
  })

  it('normalizes malformed board data to a safe nine-cell board', () => {
    expect(normalizeTicTacToeBoard(['X', 'bad', 'O'])).toEqual([
      'X', null, 'O', null, null, null, null, null, null,
    ])
    expect(normalizeTicTacToeBoard(null)).toEqual(Array(9).fill(null))
  })
})

describe('Tic Tac Toe move presentation', () => {
  it('formats cell indexes as readable row and column coordinates', () => {
    expect(formatTicTacToeMove('0')).toBe('Row 1, column 1')
    expect(formatTicTacToeMove('4')).toBe('Row 2, column 2')
    expect(formatTicTacToeMove('8')).toBe('Row 3, column 3')
    expect(formatTicTacToeMove('custom')).toBe('custom')
  })

  it('finds the newest valid board move', () => {
    expect(getLatestTicTacToeMoveIndex([{ move: '2' }, { move: 'bad' }, { move: '7' }])).toBe(7)
    expect(getLatestTicTacToeMoveIndex([{ move: '9' }, { move: '1x' }])).toBeNull()
  })
})

describe('Tic Tac Toe participants and actions', () => {
  const player = { userId: 'p1', username: 'Ada', index: 0, isConnected: true }

  it('derives the computer as O without mutating the game player list', () => {
    const players = [player]
    const participants = getTicTacToeParticipants(players, 'singlePlayer', 'hard')

    expect(players).toHaveLength(1)
    expect(participants).toEqual([
      expect.objectContaining({ id: 'p1', symbol: 'X', isComputer: false }),
      expect.objectContaining({ id: 'computer', name: 'Computer (Hard)', symbol: 'O', isComputer: true }),
    ])
  })

  it('assigns multiplayer symbols in seat order', () => {
    const participants = getTicTacToeParticipants([
      player,
      { userId: 'p2', username: 'Grace', index: 1, isConnected: false },
    ], 'multiplayer')

    expect(participants.map(({ id, symbol, isConnected }) => ({ id, symbol, isConnected }))).toEqual([
      { id: 'p1', symbol: 'X', isConnected: true },
      { id: 'p2', symbol: 'O', isConnected: false },
    ])
  })

  it('resolves completion, waiting, thinking, playing, and closed modes in precedence order', () => {
    expect(resolveTicTacToeActionMode({ status: 'completed', mode: 'multiplayer', playerCount: 1, isMyTurn: false })).toBe('complete')
    expect(resolveTicTacToeActionMode({ status: 'active', mode: 'multiplayer', playerCount: 1, isMyTurn: true })).toBe('waitingForPlayer')
    expect(resolveTicTacToeActionMode({ status: 'active', mode: 'singlePlayer', playerCount: 1, isMyTurn: true, isMoving: true })).toBe('computerThinking')
    expect(resolveTicTacToeActionMode({ status: 'active', mode: 'multiplayer', playerCount: 2, isMyTurn: true })).toBe('play')
    expect(resolveTicTacToeActionMode({ status: 'active', mode: 'multiplayer', playerCount: 2, isMyTurn: false })).toBe('waitingTurn')
    expect(resolveTicTacToeActionMode({ status: 'abandoned', mode: 'singlePlayer', playerCount: 1, isMyTurn: false })).toBe('closed')
  })
})
