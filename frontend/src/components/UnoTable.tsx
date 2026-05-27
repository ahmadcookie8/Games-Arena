import { useState } from 'react'

interface UnoCard {
  color: string
  value: string
  type: string
}

interface UnoState {
  hands: UnoCard[][]
  discardPile: UnoCard[]
  currentTurnIndex: number
  currentColor: string
}

const COLOR_CLASS: Record<string, string> = {
  red: 'bg-red-500', green: 'bg-green-500', blue: 'bg-blue-500',
  yellow: 'bg-yellow-400', wild: 'bg-gray-600',
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

  const myHand = state.hands?.[playerIndex] ?? []
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
      <div className="flex gap-6 items-center">
        <div className={`w-16 h-24 rounded-xl ${topCard ? COLOR_CLASS[topCard.color] : 'bg-gray-700'} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
          {topCard?.value}
        </div>
        <button onClick={drawCard} disabled={!isMyTurn} className="w-16 h-24 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm disabled:opacity-50 shadow-lg">
          Draw
        </button>
      </div>

      <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
        {myHand.map((card, i) => (
          <button
            key={i}
            onClick={() => isMyTurn && playCard(i)}
            disabled={!isMyTurn}
            className={`w-14 h-20 rounded-xl ${COLOR_CLASS[card.color]} text-white text-xs font-bold shadow disabled:opacity-60 hover:scale-105 transition-transform`}
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
              className={`w-12 h-12 rounded-full ${COLOR_CLASS[color]} hover:scale-110 transition-transform`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
