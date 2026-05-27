import { useState, useEffect } from 'react'
import { create } from 'zustand'
import { Game } from '../types/game'
import api from '../lib/api'

interface GameStore {
  currentGame: Game | null
  isMyTurn: boolean
  setGame: (game: Game) => void
  updateGameState: (gameState: Record<string, unknown>) => void
  clearGame: () => void
}

export const useGameStore = create<GameStore>((set) => ({
  currentGame: null,
  isMyTurn: false,
  setGame: (game) => set({ currentGame: game }),
  updateGameState: (gameState) =>
    set((state) => state.currentGame ? { currentGame: { ...state.currentGame, gameState } } : state),
  clearGame: () => set({ currentGame: null, isMyTurn: false }),
}))

export function useGameState(gameId?: string) {
  const { currentGame, setGame, updateGameState } = useGameStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameId) return
    setLoading(true)
    api.get(`/api/games/${gameId}`)
      .then((res) => setGame(res.data.game))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [gameId])

  return { game: currentGame, loading, error, setGame, updateGameState }
}
