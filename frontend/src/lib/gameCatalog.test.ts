import { describe, expect, it } from 'vitest'
import {
  GAME_CATALOG,
  MULTIPLAYER_GAMES,
  SINGLE_PLAYER_GAMES,
  getGameMode,
  getGamePath,
} from './gameCatalog'

describe('game catalog', () => {
  it('exposes only currently playable games in each mode', () => {
    expect(MULTIPLAYER_GAMES.map((game) => game.gameType)).toEqual([
      'ticTacToe',
      'wisecracker',
      'scrabble',
      'propertyManagement',
    ])
    expect(SINGLE_PLAYER_GAMES.map((game) => game.gameType)).toEqual([
      'ticTacToe',
      'snake',
      'mazeChase',
    ])
    expect(GAME_CATALOG.chess.available).toBe(false)
  })

  it('resolves routes from the game mode and type', () => {
    expect(getGamePath({ _id: 'mp', gameType: 'ticTacToe' })).toBe('/game/mp')
    expect(getGamePath({ _id: 'solo', gameType: 'ticTacToe', metadata: { mode: 'singlePlayer' } })).toBe('/single-player/tic-tac-toe/solo')
    expect(getGamePath({ _id: 'snake', gameType: 'snake' })).toBe('/single-player/snake/snake')
    expect(getGamePath({ _id: 'maze', gameType: 'mazeChase' })).toBe('/single-player/maze-chase/maze')
    expect(getGamePath({ _id: 'legacy', gameType: 'chess' })).toBeNull()
  })

  it('infers older solo score records that predate mode metadata', () => {
    expect(getGameMode({ gameType: 'snake' })).toBe('singlePlayer')
    expect(getGameMode({ gameType: 'mazeChase' })).toBe('singlePlayer')
    expect(getGameMode({ gameType: 'ticTacToe' })).toBe('multiplayer')
  })
})
