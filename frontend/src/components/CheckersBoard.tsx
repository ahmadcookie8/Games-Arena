interface Props {
  gameState: Record<string, unknown>
  isMyTurn: boolean
  onMove: (move: string) => void
}

export default function CheckersBoard(_props: Props) {
  // TODO: implement full checkers board UI
  return (
    <div className="text-white text-center p-8">
      <p className="text-gray-400">Checkers board coming soon...</p>
    </div>
  )
}
