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
      <p className="text-gray-400">Next: {state.currentSymbol}</p>
      <div className="grid grid-cols-3 gap-2">
        {state.board.map((cell, i) => (
          <button
            key={i}
            onClick={() => isMyTurn && !cell && onMove(String(i))}
            disabled={!isMyTurn || !!cell}
            className="w-24 h-24 text-4xl font-bold rounded-xl bg-gray-700 hover:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <span className={cell === 'X' ? 'text-blue-400' : 'text-red-400'}>{cell}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
