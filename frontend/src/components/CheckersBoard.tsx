interface Props {
  gameState: Record<string, unknown>
  isMyTurn: boolean
  onMove: (move: string) => void
}

export default function CheckersBoard(_props: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-elevated p-12 text-center">
      <p className="text-lg font-semibold text-text-primary">Checkers</p>
      <p className="mt-1 text-sm text-text-muted">Coming soon</p>
    </div>
  )
}
