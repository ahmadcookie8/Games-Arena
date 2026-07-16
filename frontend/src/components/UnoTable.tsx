import { useState } from 'react'
import { UnoState } from '../types/game'

const COLOR_CLASS: Record<string, string> = {
  red: 'bg-red-500',
  green: 'bg-emerald-500',
  blue: 'bg-blue-500',
  yellow: 'bg-amber-400 text-amber-900',
  wild: 'bg-gradient-to-br from-red-500 via-emerald-500 to-blue-500',
}

interface Props {
  gameState: Record<string, unknown>
  isMyTurn: boolean
  playerIndex: number
  onMove: (move: string) => void
}

export default function UnoTable({ gameState, isMyTurn, playerIndex, onMove }: Props) {
  const state = gameState as unknown as UnoState
  const [showColorPicker, setShowColorPicker] = useState<number | null>(null)

  const myHand = state.hand ?? []
  const otherHandCounts = (state.handCounts ?? []).filter((_count, index) => index !== playerIndex)
  const topCard = state.discardPile?.[state.discardPile.length - 1]

  function playCard(cardIndex: number, colorChoice?: string) {
    const card = myHand[cardIndex]
    if (card.type === 'WILD' || card.type === 'WILD_DRAW4') {
      if (!colorChoice) { setShowColorPicker(cardIndex); return }
    }
    onMove(JSON.stringify({ type: 'play', cardIndex, colorChoice }))
    setShowColorPicker(null)
  }

  function drawCard() {
    onMove(JSON.stringify({ type: 'draw' }))
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="flex items-center justify-center gap-6">
        <div className={`flex h-24 w-16 flex-shrink-0 items-center justify-center rounded-xl ${topCard ? COLOR_CLASS[topCard.color] : 'bg-elevated text-text-muted'} text-lg font-bold text-white shadow-md`}>
          {topCard?.value}
        </div>
        <button onClick={drawCard} disabled={!isMyTurn} className="h-24 w-16 flex-shrink-0 rounded-xl border-2 border-border bg-elevated text-sm font-bold text-text-muted shadow-md transition-transform duration-100 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100">
          Draw
        </button>
      </div>
      <p className="text-sm text-text-muted" aria-live="polite">
        {state.deckCount ?? 0} cards in the draw pile
        {otherHandCounts.length > 0 ? ` · Opponent hands: ${otherHandCounts.join(', ')}` : ''}
      </p>

      <div className="flex w-full max-w-2xl flex-wrap justify-center gap-2 px-2">
        {myHand.map((card, i) => (
          <button
            key={i}
            onClick={() => isMyTurn && playCard(i)}
            disabled={!isMyTurn}
            className={`h-20 w-14 rounded-xl ${COLOR_CLASS[card.color]} text-xs font-bold text-white shadow-md transition-transform duration-100 hover:-translate-y-2 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100`}
          >
            {card.value}
          </button>
        ))}
      </div>

      {showColorPicker !== null && (
        <div className="flex gap-3">
          {['red', 'green', 'blue', 'yellow'].map((color) => (
            <button
              key={color}
              onClick={() => playCard(showColorPicker, color)}
              aria-label={`Choose ${color}`}
              className={`h-12 w-12 rounded-full ${COLOR_CLASS[color]} shadow-md transition-transform duration-100 hover:scale-110`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
