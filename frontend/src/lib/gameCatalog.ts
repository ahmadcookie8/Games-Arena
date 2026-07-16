import mazeChase480Avif from '../assets/cards/game-maze-chase-480.avif'
import mazeChase480Webp from '../assets/cards/game-maze-chase-480.webp'
import mazeChase960Avif from '../assets/cards/game-maze-chase-960.avif'
import mazeChase960Webp from '../assets/cards/game-maze-chase-960.webp'
import propertyManagement480Avif from '../assets/cards/game-property-management-480.avif'
import propertyManagement480Webp from '../assets/cards/game-property-management-480.webp'
import propertyManagement960Avif from '../assets/cards/game-property-management-960.avif'
import propertyManagement960Webp from '../assets/cards/game-property-management-960.webp'
import scrabble480Avif from '../assets/cards/game-scrabble-480.avif'
import scrabble480Webp from '../assets/cards/game-scrabble-480.webp'
import scrabble960Avif from '../assets/cards/game-scrabble-960.avif'
import scrabble960Webp from '../assets/cards/game-scrabble-960.webp'
import snake480Avif from '../assets/cards/game-snake-480.avif'
import snake480Webp from '../assets/cards/game-snake-480.webp'
import snake960Avif from '../assets/cards/game-snake-960.avif'
import snake960Webp from '../assets/cards/game-snake-960.webp'
import ticTacToe480Avif from '../assets/cards/game-tic-tac-toe-480.avif'
import ticTacToe480Webp from '../assets/cards/game-tic-tac-toe-480.webp'
import ticTacToe960Avif from '../assets/cards/game-tic-tac-toe-960.avif'
import ticTacToe960Webp from '../assets/cards/game-tic-tac-toe-960.webp'
import wisecracker480Avif from '../assets/cards/game-wisecracker-480.avif'
import wisecracker480Webp from '../assets/cards/game-wisecracker-480.webp'
import wisecracker960Avif from '../assets/cards/game-wisecracker-960.avif'
import wisecracker960Webp from '../assets/cards/game-wisecracker-960.webp'
import type { Game, GameMode, GameType } from '../types/game'

export interface ResponsiveGameArtwork {
  avifSrcSet: string
  webpSrcSet: string
  fallbackSrc: string
  width: 960
  height: 540
}

export interface GameCatalogModeEntry {
  description: string
  playerCount: string
  actionLabel: string
  createEndpoint: '/api/games/create' | '/api/games/single-player/create'
  createPayload: Readonly<{ gameType: GameType }>
}

export interface GameCatalogEntry {
  gameType: GameType
  label: string
  shortLabel: string
  artwork?: ResponsiveGameArtwork
  available: boolean
  modes: Partial<Record<GameMode, GameCatalogModeEntry>>
}

function createArtwork(
  avif480: string,
  avif960: string,
  webp480: string,
  webp960: string,
): ResponsiveGameArtwork {
  return {
    avifSrcSet: `${avif480} 480w, ${avif960} 960w`,
    webpSrcSet: `${webp480} 480w, ${webp960} 960w`,
    fallbackSrc: webp480,
    width: 960,
    height: 540,
  }
}

const unavailable = (gameType: GameType, label: string): GameCatalogEntry => ({
  gameType,
  label,
  shortLabel: label,
  available: false,
  modes: {},
})

export const GAME_CATALOG: Readonly<Record<GameType, GameCatalogEntry>> = {
  ticTacToe: {
    gameType: 'ticTacToe',
    label: 'Tic Tac Toe',
    shortLabel: 'Tic Tac Toe',
    artwork: createArtwork(ticTacToe480Avif, ticTacToe960Avif, ticTacToe480Webp, ticTacToe960Webp),
    available: true,
    modes: {
      multiplayer: {
        description: 'A quick head-to-head classic with live turns.',
        playerCount: '2 players',
        actionLabel: 'Create room',
        createEndpoint: '/api/games/create',
        createPayload: { gameType: 'ticTacToe' },
      },
      singlePlayer: {
        description: 'Sharpen your strategy against the computer.',
        playerCount: '1 player',
        actionLabel: 'Start run',
        createEndpoint: '/api/games/single-player/create',
        createPayload: { gameType: 'ticTacToe' },
      },
    },
  },
  wisecracker: {
    gameType: 'wisecracker',
    label: 'Wisecracker',
    shortLabel: 'Wisecracker',
    artwork: createArtwork(wisecracker480Avif, wisecracker960Avif, wisecracker480Webp, wisecracker960Webp),
    available: true,
    modes: {
      multiplayer: {
        description: 'Write the punchline, then win the room over.',
        playerCount: '3–4 players',
        actionLabel: 'Create room',
        createEndpoint: '/api/games/create',
        createPayload: { gameType: 'wisecracker' },
      },
    },
  },
  scrabble: {
    gameType: 'scrabble',
    label: 'Scrabble',
    shortLabel: 'Scrabble',
    artwork: createArtwork(scrabble480Avif, scrabble960Avif, scrabble480Webp, scrabble960Webp),
    available: true,
    modes: {
      multiplayer: {
        description: 'Build words, control the board, and chase big scores.',
        playerCount: '2–4 players',
        actionLabel: 'Create room',
        createEndpoint: '/api/games/create',
        createPayload: { gameType: 'scrabble' },
      },
    },
  },
  propertyManagement: {
    gameType: 'propertyManagement',
    label: 'Property Management',
    shortLabel: 'Property',
    artwork: createArtwork(propertyManagement480Avif, propertyManagement960Avif, propertyManagement480Webp, propertyManagement960Webp),
    available: true,
    modes: {
      multiplayer: {
        description: 'Deal, develop, and outlast your rival across the city.',
        playerCount: '2–8 players',
        actionLabel: 'Create room',
        createEndpoint: '/api/games/create',
        createPayload: { gameType: 'propertyManagement' },
      },
    },
  },
  snake: {
    gameType: 'snake',
    label: 'Snake',
    shortLabel: 'Snake',
    artwork: createArtwork(snake480Avif, snake960Avif, snake480Webp, snake960Webp),
    available: true,
    modes: {
      singlePlayer: {
        description: 'Thread the arena, grow longer, and protect your streak.',
        playerCount: '1 player',
        actionLabel: 'Start run',
        createEndpoint: '/api/games/single-player/create',
        createPayload: { gameType: 'snake' },
      },
    },
  },
  mazeChase: {
    gameType: 'mazeChase',
    label: 'Maze Chase',
    shortLabel: 'Maze Chase',
    artwork: createArtwork(mazeChase480Avif, mazeChase960Avif, mazeChase480Webp, mazeChase960Webp),
    available: true,
    modes: {
      singlePlayer: {
        description: 'Clear the maze, dodge the ghosts, and climb the ranks.',
        playerCount: '1 player',
        actionLabel: 'Start run',
        createEndpoint: '/api/games/single-player/create',
        createPayload: { gameType: 'mazeChase' },
      },
    },
  },
  chess: unavailable('chess', 'Chess'),
  checkers: unavailable('checkers', 'Checkers'),
  uno: unavailable('uno', 'Uno'),
  president: unavailable('president', 'President'),
}

export const MULTIPLAYER_GAMES = Object.values(GAME_CATALOG).filter(
  (entry) => entry.available && Boolean(entry.modes.multiplayer),
)

export const SINGLE_PLAYER_GAMES = Object.values(GAME_CATALOG).filter(
  (entry) => entry.available && Boolean(entry.modes.singlePlayer),
)

export const AVAILABLE_GAMES = Object.values(GAME_CATALOG).filter((entry) => entry.available)

export function getCatalogEntry(gameType: GameType): GameCatalogEntry {
  return GAME_CATALOG[gameType]
}

export function getCatalogMode(entry: GameCatalogEntry, mode: GameMode): GameCatalogModeEntry | undefined {
  if (!entry.available) return undefined
  return entry.modes[mode]
}

export function getGameMode(game: Pick<Game, 'gameType' | 'metadata'>): GameMode {
  if (game.metadata?.mode) return game.metadata.mode
  return game.gameType === 'snake' || game.gameType === 'mazeChase' ? 'singlePlayer' : 'multiplayer'
}

export function getGamePath(game: Pick<Game, '_id' | 'gameType' | 'metadata'>): string | null {
  const entry = getCatalogEntry(game.gameType)
  const mode = getGameMode(game)
  if (!getCatalogMode(entry, mode)) return null

  if (mode === 'multiplayer') return `/game/${game._id}`
  if (game.gameType === 'snake') return `/single-player/snake/${game._id}`
  if (game.gameType === 'mazeChase') return `/single-player/maze-chase/${game._id}`
  if (game.gameType === 'ticTacToe') return `/single-player/tic-tac-toe/${game._id}`
  return null
}
