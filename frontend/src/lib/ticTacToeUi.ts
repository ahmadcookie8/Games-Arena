import { GameMode, GameStatus, MoveRecord, Player, TicTacToeDifficulty } from '../types/game'

export type TicTacToeSymbol = 'X' | 'O'
export type TicTacToeCell = TicTacToeSymbol | null
export type TicTacToeWinningLine = readonly [number, number, number]

export const TIC_TAC_TOE_WINNING_LINES: readonly TicTacToeWinningLine[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

export interface TicTacToeParticipant {
  id: string
  name: string
  symbol: TicTacToeSymbol
  isComputer: boolean
  isConnected: boolean
}

export type TicTacToeActionMode =
  | 'closed'
  | 'complete'
  | 'waitingForPlayer'
  | 'computerThinking'
  | 'play'
  | 'waitingTurn'

interface ResolveTicTacToeActionOptions {
  status: GameStatus
  mode: GameMode
  playerCount: number
  isMyTurn: boolean
  isMoving?: boolean
}

export function normalizeTicTacToeBoard(value: unknown): TicTacToeCell[] {
  if (!Array.isArray(value)) return Array<TicTacToeCell>(9).fill(null)

  return Array.from({ length: 9 }, (_, index) => {
    const cell = value[index]
    return cell === 'X' || cell === 'O' ? cell : null
  })
}

export function getTicTacToeWinningLine(board: readonly TicTacToeCell[]): TicTacToeWinningLine | null {
  for (const line of TIC_TAC_TOE_WINNING_LINES) {
    const [first, second, third] = line
    if (board[first] && board[first] === board[second] && board[first] === board[third]) {
      return line
    }
  }

  return null
}

export function getLatestTicTacToeMoveIndex(moves: readonly Pick<MoveRecord, 'move'>[]): number | null {
  for (let index = moves.length - 1; index >= 0; index -= 1) {
    const move = moves[index].move.trim()
    if (!/^[0-8]$/.test(move)) continue
    return Number(move)
  }

  return null
}

export function formatTicTacToeMove(move: string): string {
  const normalized = move.trim()
  if (!/^[0-8]$/.test(normalized)) return move

  const index = Number(normalized)
  const row = Math.floor(index / 3) + 1
  const column = (index % 3) + 1
  return `Row ${row}, column ${column}`
}

export function getTicTacToeParticipants(
  players: readonly Player[],
  mode: GameMode,
  difficulty: TicTacToeDifficulty = 'easy',
): TicTacToeParticipant[] {
  const humanParticipants = players.slice(0, 2).map((player, index) => ({
    id: player.userId,
    name: player.username,
    symbol: (index === 0 ? 'X' : 'O') as TicTacToeSymbol,
    isComputer: false,
    isConnected: player.isConnected !== false,
  }))

  if (mode !== 'singlePlayer') return humanParticipants

  return [
    ...humanParticipants.slice(0, 1),
    {
      id: 'computer',
      name: `Computer (${difficulty[0].toUpperCase()}${difficulty.slice(1)})`,
      symbol: 'O',
      isComputer: true,
      isConnected: true,
    },
  ]
}

export function resolveTicTacToeActionMode({
  status,
  mode,
  playerCount,
  isMyTurn,
  isMoving = false,
}: ResolveTicTacToeActionOptions): TicTacToeActionMode {
  if (status === 'completed') return 'complete'
  if (status !== 'active') return 'closed'
  if (mode === 'multiplayer' && playerCount < 2) return 'waitingForPlayer'
  if (mode === 'singlePlayer' && isMoving) return 'computerThinking'
  if (isMyTurn) return 'play'
  return 'waitingTurn'
}
