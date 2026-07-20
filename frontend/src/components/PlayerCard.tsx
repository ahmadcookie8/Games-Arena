import { Player } from '../types/game'
import PlayerAvatar from './PlayerAvatar'

interface Props {
  player: Player
  isCurrentTurn: boolean
}

export default function PlayerCard({ player, isCurrentTurn }: Props) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-150 ${isCurrentTurn ? 'border-accent bg-accent-subtle shadow-accent' : 'border-border bg-elevated'}`}>
      <PlayerAvatar
        name={player.username}
        size="md"
        status={isCurrentTurn ? 'turn' : player.isConnected ? 'online' : 'offline'}
      />
      <div className="min-w-0">
        <p className="truncate font-medium text-text-primary">{player.username}</p>
        <p className={`text-xs ${player.isConnected ? 'text-success' : 'text-text-muted'}`}>
          {player.isConnected ? 'Online' : 'Offline'}
        </p>
      </div>
      {isCurrentTurn && <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-accent">Playing</span>}
    </div>
  )
}
