import { Game } from '../types/game'
import { getGameLabel } from './gameRules'

export interface CloseGamePrompt {
  title: string
  message: string
}

export function canParticipantCloseGame(game: Game, currentUserId?: string): boolean {
  return Boolean(
    currentUserId
      && game.status === 'active'
      && game.players.some((player) => player.userId === currentUserId),
  )
}

export function getCloseGamePrompt(game: Game): CloseGamePrompt {
  if (game.metadata?.mode === 'singlePlayer') {
    return {
      title: 'Close this solo game?',
      message: 'This will close the active solo match and remove it from your Single Player active games list.',
    }
  }

  if (game.players.length > 1) {
    return {
      title: 'Close this game for everyone?',
      message: `This will end the ${getGameLabel(game.gameType)} game for everyone and record it as abandoned. No result or player statistics will be recorded.`,
    }
  }

  return {
    title: 'Close this game?',
    message: `This will close the ${getGameLabel(game.gameType)} room and remove it from your active games list. Other players will no longer be able to join or continue it.`,
  }
}
