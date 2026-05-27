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
        Next: <span className="font-mono font-bold">{state.currentSymbol}</span>
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
              className="aspect-square rounded-xl border border-border bg-elevated text-4xl font-bold shadow-sm transition-all duration-150 hover:border-border-strong hover:bg-overlay disabled:cursor-not-allowed disabled:hover:bg-elevated"
            >
              <span className={`inline-block animate-scale-in ${cell === 'X' ? 'text-accent' : cell === 'O' ? 'text-warning' : ''}`}>{cell}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
