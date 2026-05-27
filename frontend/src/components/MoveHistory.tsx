import { MoveRecord } from '../types/game'

interface Props {
  moves: MoveRecord[]
}

export default function MoveHistory({ moves }: Props) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="font-semibold mb-3">Move History</h3>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {moves.length === 0 && <p className="text-gray-500 text-sm">No moves yet</p>}
        {[...moves].reverse().map((m) => (
          <div key={m.moveNumber} className="flex justify-between text-sm py-1 border-b border-gray-700">
            <span className="text-gray-400">#{m.moveNumber}</span>
            <span className="font-mono">{m.move}</span>
            <span className="text-gray-500">{m.playerName}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
