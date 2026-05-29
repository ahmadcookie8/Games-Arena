import { Circle, X } from 'lucide-react'

interface TicTacToeState {
  board: (string | null)[]
  currentSymbol: 'X' | 'O'
}

interface Props {
  gameState: Record<string, unknown>
  isMyTurn: boolean
  onMove: (move: string) => void
}

export default function TicTacToeBoard({ gameState, isMyTurn, onMove }: Props) {
  const state = gameState as unknown as TicTacToeState

  return (
    <div className="flex flex-col items-center gap-6">
      <div className={`rounded-full px-3 py-1 text-sm font-medium ${isMyTurn ? 'bg-accent-subtle text-accent' : 'bg-overlay text-text-secondary'}`}>
        <span className="inline-flex items-center gap-1.5">
          Next: <TicTacToeMark symbol={state.currentSymbol} size="small" />
        </span>
      </div>
      <div className="grid w-full max-w-[22rem] grid-cols-3 gap-2">
        {state.board.map((cell, i) => {
          const row = Math.floor(i / 3) + 1
          const column = (i % 3) + 1
          return (
            <button
              key={i}
              onClick={() => isMyTurn && !cell && onMove(String(i))}
              disabled={!isMyTurn || !!cell}
              aria-label={`Row ${row}, Column ${column}${cell ? `, ${cell}` : ', empty'}`}
              className="aspect-square cursor-pointer rounded-xl border border-border bg-elevated text-4xl font-bold shadow-sm transition-all duration-150 hover:border-accent-muted hover:bg-overlay hover:shadow-accent disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-elevated disabled:hover:shadow-sm"
            >
              {cell && (
                <span className="inline-flex animate-scale-in items-center justify-center">
                  <TicTacToeMark symbol={cell as 'X' | 'O'} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TicTacToeMark({ symbol, size = 'large' }: { symbol: 'X' | 'O'; size?: 'small' | 'large' }) {
  const className = `${size === 'small' ? 'h-4 w-4' : 'h-16 w-16'} ${symbol === 'X' ? 'text-accent' : 'text-warning'}`
  return symbol === 'X'
    ? <X className={className} strokeWidth={size === 'small' ? 3 : 2.5} aria-label="X" role="img" />
    : <Circle className={className} strokeWidth={size === 'small' ? 3 : 2.5} aria-label="O" role="img" />
}
