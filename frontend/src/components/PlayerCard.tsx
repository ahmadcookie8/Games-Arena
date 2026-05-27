import { Player } from '../types/game'

interface Props {
  player: Player
  isCurrentTurn: boolean
}

export default function PlayerCard({ player, isCurrentTurn }: Props) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${isCurrentTurn ? 'border-accent bg-accent-subtle' : 'border-border bg-elevated'}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-text-on-accent">
        {player.username[0].toUpperCase()}
      </div>
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
