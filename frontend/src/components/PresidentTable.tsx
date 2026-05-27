interface Props {
  gameState: Record<string, unknown>
  isMyTurn: boolean
  playerIndex: number
  onMove: (move: string) => void
}

export default function PresidentTable(_props: Props) {
  // TODO: implement President card game UI
  return (
    <div className="text-white text-center p-8">
      <p className="text-gray-400">President card game coming soon...</p>
    </div>
  )
}
