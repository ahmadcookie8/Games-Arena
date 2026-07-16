import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import axios from 'axios'
import { create } from 'zustand'
import type { ChatMessage, Game } from '../types/game'
import api from '../lib/api'
import { parseGameStateEnvelope, shouldApplyGameSnapshot, type GameStateEnvelope } from '../lib/gameStateEvents'

interface GameStore {
  activeGameId: string | null
  currentGame: Game | null
  isMyTurn: boolean
  activateGame: (gameId: string) => void
  deactivateGame: (gameId: string) => void
  setGame: (game: Game) => void
  applyGameSnapshot: (
    snapshot: GameStateEnvelope,
    expectedGameId: string,
    allowEqualRevision?: boolean,
    preserveLocalDeltas?: boolean,
  ) => boolean
  appendChatMessage: (gameId: string, message: ChatMessage) => void
  updatePlayerPresence: (gameId: string, userId: string, isConnected: boolean) => void
  updateGameState: (gameState: Record<string, unknown>) => void
  clearGame: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  activeGameId: null,
  currentGame: null,
  isMyTurn: false,
  activateGame: (gameId) => set((state) => ({
    activeGameId: gameId,
    currentGame: state.currentGame?._id === gameId ? state.currentGame : null,
  })),
  deactivateGame: (gameId) => set((state) => state.activeGameId === gameId
    ? { activeGameId: null, currentGame: null, isMyTurn: false }
    : state),
  setGame: (game) => set((state) => state.activeGameId === game._id
    ? { currentGame: game }
    : state),
  applyGameSnapshot: (snapshot, expectedGameId, allowEqualRevision = false, preserveLocalDeltas = false) => {
    if (get().activeGameId !== expectedGameId) return false
    const currentGame = get().currentGame
    if (!shouldApplyGameSnapshot(currentGame, snapshot, expectedGameId, allowEqualRevision)) return false
    const nextGame = preserveLocalDeltas && currentGame
      ? {
          ...snapshot.game,
          players: mergePlayerPresence(currentGame.players, snapshot.game.players),
          chatMessages: mergeChatMessages(currentGame.chatMessages, snapshot.game.chatMessages),
        }
      : snapshot.game
    set({ currentGame: nextGame })
    return true
  },
  appendChatMessage: (gameId, message) => set((state) => {
    if (state.currentGame?._id !== gameId) return state
    const existing = state.currentGame.chatMessages ?? []
    if (existing.some((item) => item.messageId === message.messageId)) return state
    return { currentGame: { ...state.currentGame, chatMessages: [...existing, message].slice(-100) } }
  }),
  updatePlayerPresence: (gameId, userId, isConnected) => set((state) => {
    if (state.currentGame?._id !== gameId) return state
    const playerIndex = state.currentGame.players.findIndex((player) => player.userId === userId)
    if (playerIndex < 0 || state.currentGame.players[playerIndex].isConnected === isConnected) return state
    return {
      currentGame: {
        ...state.currentGame,
        players: state.currentGame.players.map((player, index) => index === playerIndex ? { ...player, isConnected } : player),
      },
    }
  }),
  updateGameState: (gameState) =>
    set((state) => state.currentGame ? { currentGame: { ...state.currentGame, gameState } } : state),
  clearGame: () => set({ currentGame: null, isMyTurn: false }),
}))

function mergeChatMessages(current: ChatMessage[] | undefined, incoming: ChatMessage[] | undefined): ChatMessage[] | undefined {
  if (!current?.length) return incoming
  if (!incoming?.length) return current
  const messages = new Map<string, ChatMessage>()
  for (const message of [...current, ...incoming]) messages.set(message.messageId, message)
  return [...messages.values()]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-100)
}

function mergePlayerPresence(current: Game['players'], incoming: Game['players']): Game['players'] {
  const currentByUserId = new Map(current.map((player) => [player.userId, player]))
  return incoming.map((player) => {
    const existing = currentByUserId.get(player.userId)
    return existing ? { ...player, isConnected: existing.isConnected } : player
  })
}

export function useGameState(gameId?: string) {
  const {
    currentGame,
    setGame,
    applyGameSnapshot,
    appendChatMessage,
    updatePlayerPresence,
    updateGameState,
    clearGame,
    activateGame,
    deactivateGame,
  } = useGameStore()
  const [loading, setLoading] = useState(Boolean(gameId))
  const [errorState, setErrorState] = useState<{ gameId: string; message: string } | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
  const refetch = useCallback(() => setRequestVersion((version) => version + 1), [])
  const applySnapshot = useCallback((value: unknown, allowEqualRevision = false, preserveLocalDeltas = false) => {
    if (!gameId) return false
    const snapshot = parseGameStateEnvelope(value)
    return snapshot ? applyGameSnapshot(snapshot, gameId, allowEqualRevision, preserveLocalDeltas) : false
  }, [applyGameSnapshot, gameId])

  useLayoutEffect(() => {
    if (!gameId) {
      clearGame()
      return
    }
    activateGame(gameId)
    return () => deactivateGame(gameId)
  }, [activateGame, clearGame, deactivateGame, gameId])

  useEffect(() => {
    setErrorState(null)
  }, [gameId])

  useEffect(() => {
    let cancelled = false
    setErrorState(null)

    if (!gameId) {
      setLoading(false)
      return () => { cancelled = true }
    }

    setLoading(useGameStore.getState().currentGame?._id !== gameId)
    api.get(`/api/games/${gameId}`)
      .then((res) => {
        if (!cancelled) applySnapshot(res.data, true)
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
  }, [applySnapshot, gameId, requestVersion])

  const game = currentGame?._id === gameId ? currentGame : null
  const error = errorState && errorState.gameId === gameId ? errorState.message : null
  const isResolvingGame = Boolean(gameId) && !game && !error

  return {
    game,
    loading: loading || isResolvingGame,
    error,
    refetch,
    setGame,
    applySnapshot,
    appendChatMessage,
    updatePlayerPresence,
    updateGameState,
  }
}
