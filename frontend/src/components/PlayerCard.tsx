import { Player } from '../types/game'

interface Props {
  player: Player
  isCurrentTurn: boolean
}

export default function PlayerCard({ player, isCurrentTurn }: Props) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${isCurrentTurn ? 'bg-green-900 border border-green-600' : 'bg-gray-800'}`}>
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
        {player.username[0].toUpperCase()}
      </div>
      <div>
        <p className="font-medium">{player.username}</p>
        <p className={`text-xs ${player.isConnected ? 'text-green-400' : 'text-gray-500'}`}>
          {player.isConnected ? 'Online' : 'Offline'}
        </p>
      </div>
      {isCurrentTurn && <span className="ml-auto text-xs text-green-400">Playing</span>}
    </div>
  )
}
