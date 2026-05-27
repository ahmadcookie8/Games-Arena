import { useState } from 'react'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

const PIECE_SYMBOLS: Record<string, string> = {
  'white-king': '♔',
  'white-queen': '♕',
  'white-rook': '♖',
  'white-bishop': '♗',
  'white-knight': '♘',
  'white-pawn': '♙',
  'black-king': '♚',
  'black-queen': '♛',
  'black-rook': '♜',
  'black-bishop': '♝',
  'black-knight': '♞',
  'black-pawn': '♟',
}

interface Piece { type: string; color: string }
interface ChessState { board: Record<string, Piece | null> }

interface Props {
  gameState: Record<string, unknown>
  isMyTurn: boolean
  playerColor?: string
  onMove: (move: string) => void
}

export default function ChessBoard({ gameState, isMyTurn, playerColor, onMove }: Props) {
  const state = gameState as unknown as ChessState
  const [selected, setSelected] = useState<string | null>(null)

  function handleSquareClick(square: string) {
    if (!isMyTurn) return
    const piece = state.board?.[square]

    if (selected) {
      if (selected !== square) onMove(`${selected}-${square}`)
      setSelected(null)
    } else if (piece?.color === playerColor) {
      setSelected(square)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[28rem] overflow-hidden rounded-xl border border-border-strong shadow-md">
      {RANKS.map((rank) => (
        <div key={rank} className="grid grid-cols-8">
          {FILES.map((file) => {
            const square = `${file}${rank}`
            const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0
            const piece = state.board?.[square]
            const isSelected = selected === square

            return (
              <button
                key={square}
                type="button"
                onClick={() => handleSquareClick(square)}
                aria-label={`Square ${square}${piece ? `, ${piece.color} ${piece.type}` : ', empty'}`}
                className={`aspect-square text-3xl transition-all duration-150 hover:brightness-110 ${isLight ? 'bg-[#E6D3A3]' : 'bg-[#6B4E2E]'} ${isSelected ? 'ring-4 ring-warning ring-inset' : ''}`}
              >
                <span className={piece?.color === 'white' ? 'select-none [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]' : 'select-none [text-shadow:0_1px_2px_rgba(255,255,255,0.3)]'}>
                  {piece && PIECE_SYMBOLS[`${piece.color}-${piece.type}`]}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
