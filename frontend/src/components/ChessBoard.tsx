import { useState } from 'react'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

const PIECE_SYMBOLS: Record<string, string> = {
  'white-king': '♔', 'white-queen': '♕', 'white-rook': '♖',
  'white-bishop': '♗', 'white-knight': '♘', 'white-pawn': '♙',
  'black-king': '♚', 'black-queen': '♛', 'black-rook': '♜',
  'black-bishop': '♝', 'black-knight': '♞', 'black-pawn': '♟',
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
      if (selected !== square) {
        onMove(`${selected}-${square}`)
      }
      setSelected(null)
    } else if (piece?.color === playerColor) {
      setSelected(square)
    }
  }

  return (
    <div className="inline-block border-2 border-gray-600 rounded">
      {RANKS.map((rank) => (
        <div key={rank} className="flex">
          {FILES.map((file) => {
            const square = `${file}${rank}`
            const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0
            const piece = state.board?.[square]
            const isSelected = selected === square

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(square)}
                className={`
                  w-14 h-14 flex items-center justify-center text-3xl cursor-pointer select-none
                  ${isLight ? 'bg-amber-100' : 'bg-amber-800'}
                  ${isSelected ? 'ring-4 ring-yellow-400 ring-inset' : ''}
                  hover:brightness-110
                `}
              >
                {piece && PIECE_SYMBOLS[`${piece.color}-${piece.type}`]}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
