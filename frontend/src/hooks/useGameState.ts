import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { create } from 'zustand'
import type { Game } from '../types/game'
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
  const { currentGame, setGame, updateGameState, clearGame } = useGameStore()
  const [loading, setLoading] = useState(Boolean(gameId))
  const [errorState, setErrorState] = useState<{ gameId: string; message: string } | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
  const refetch = useCallback(() => setRequestVersion((version) => version + 1), [])

  useEffect(() => {
    let cancelled = false

    clearGame()
    setErrorState(null)

    if (!gameId) {
      setLoading(false)
      return () => { cancelled = true }
    }

    setLoading(true)
    api.get(`/api/games/${gameId}`)
      .then((res) => {
        if (!cancelled) setGame(res.data.game)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (axios.isAxiosError(err)) {
          const apiError = err.response?.data?.error
          const message = typeof apiError === 'string'
            ? apiError
            : apiError && typeof apiError.message === 'string'
              ? apiError.message
              : err.message
          setErrorState({ gameId, message })
        } else {
          setErrorState({ gameId, message: err instanceof Error ? err.message : 'The game could not be loaded.' })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [clearGame, gameId, requestVersion, setGame])

  const game = currentGame?._id === gameId ? currentGame : null
  const error = errorState && errorState.gameId === gameId ? errorState.message : null
  const isResolvingGame = Boolean(gameId) && !game && !error

  return { game, loading: loading || isResolvingGame, error, refetch, setGame, updateGameState }
}
