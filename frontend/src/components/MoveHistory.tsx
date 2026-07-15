import { MoveRecord } from '../types/game'

interface Props {
  moves: MoveRecord[]
  variant?: 'card' | 'embedded'
  formatMove?: (move: MoveRecord) => string
}

export default function MoveHistory({ moves, variant = 'card', formatMove }: Props) {
  return (
    <div className={variant === 'card' ? 'rounded-2xl border border-border/90 bg-surface/94 p-4 shadow-sm backdrop-blur-xl' : 'min-w-0'}>
      {variant === 'card' && <h3 className="mb-3 text-base font-semibold text-text-primary">Move History</h3>}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {moves.length === 0 && <p className="rounded-lg bg-page px-3 py-6 text-center text-sm text-text-muted">No moves yet</p>}
        {[...moves].reverse().map((m) => (
          <div key={m.moveNumber} className="grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,5rem)] gap-2 border-b border-border py-2 text-sm last:border-b-0">
            <span className="text-text-muted">#{m.moveNumber}</span>
            <span className={`${variant === 'embedded' ? 'break-words' : 'truncate'} font-mono text-text-primary`}>{formatMove ? formatMove(m) : m.move}</span>
            <span className={`${variant === 'embedded' ? 'break-words' : 'truncate'} text-right text-text-muted`}>{m.playerName}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
