import { Circle, X } from 'lucide-react'
import { multiplayerActions, type TicTacToeMove } from '../lib/multiplayerActions'
import { normalizeTicTacToeBoard, TicTacToeSymbol } from '../lib/ticTacToeUi'
import './tic-tac-toe-tabletop.css'

interface TicTacToeState {
  board?: unknown
  currentSymbol?: TicTacToeSymbol
}

export interface TicTacToeBoardProps {
  gameState: Record<string, unknown>
  isMyTurn: boolean
  onMove: (move: TicTacToeMove) => void
  latestMoveIndex?: number | null
  winningCells?: readonly number[]
  isBusy?: boolean
  isComplete?: boolean
  disabledReason?: string
}

const TIC_TAC_TOE_CELLS: TicTacToeMove[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8']

export default function TicTacToeBoard({
  gameState,
  isMyTurn,
  onMove,
  latestMoveIndex = null,
  winningCells = [],
  isBusy = false,
  isComplete = false,
  disabledReason,
}: TicTacToeBoardProps) {
  const state = gameState as TicTacToeState
  const board = normalizeTicTacToeBoard(state.board)
  const currentSymbol = state.currentSymbol === 'O' ? 'O' : 'X'
  const winningCellSet = new Set(winningCells)

  return (
    <div
      className="ttt-board"
      role="group"
      aria-label={isComplete ? 'Tic Tac Toe final board.' : `Tic Tac Toe board. ${currentSymbol} is next to play.`}
    >
      {board.map((cell, index) => {
        const row = Math.floor(index / 3) + 1
        const column = (index % 3) + 1
        const isLatest = latestMoveIndex === index
        const isWinning = winningCellSet.has(index)
        const disabled = !isMyTurn || Boolean(cell) || isBusy
        const unavailableReason = cell
          ? `occupied by ${cell}`
          : disabledReason || (isBusy ? 'move in progress' : 'not available')

        return (
          <button
            key={index}
            type="button"
            onClick={() => onMove(multiplayerActions.ticTacToe.place(TIC_TAC_TOE_CELLS[index]))}
            disabled={disabled}
            aria-label={`Row ${row}, column ${column}, ${cell || 'empty'}${isLatest ? ', latest move' : ''}${isWinning ? ', winning square' : ''}`}
            title={disabled ? unavailableReason : `Play ${currentSymbol} at row ${row}, column ${column}`}
            className={`ttt-board__cell${isLatest ? ' ttt-board__cell--latest' : ''}${isWinning ? ' ttt-board__cell--winning' : ''}`}
            data-symbol={cell || undefined}
          >
            {cell && (
              <span className="ttt-board__mark" aria-hidden="true">
                <TicTacToeMark symbol={cell} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TicTacToeMark({
  symbol,
  size = 'large',
}: {
  symbol: TicTacToeSymbol
  size?: 'small' | 'large'
}) {
  const className = `ttt-mark ttt-mark--${symbol.toLowerCase()} ttt-mark--${size}`
  return symbol === 'X'
    ? <X className={className} strokeWidth={2.6} aria-label="X" role="img" />
    : <Circle className={className} strokeWidth={2.65} aria-label="O" role="img" />
}
