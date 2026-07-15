import { describe, expect, it } from 'vitest'
import {
  SCRABBLE_BOARD_MAX_ZOOM,
  SCRABBLE_BOARD_MIN_ZOOM,
  captureScrabbleCameraCenter,
  clampScrabbleZoom,
  fitScrabbleBoardZoom,
  getScrabbleCoordinate,
  getScrabbleLastPlayCenter,
  resolveScrabbleActionMode,
  restoreScrabbleCameraCenter,
  stepScrabbleZoom,
} from './scrabbleBoardUi'
import { ScrabbleScoreEvent } from '../types/game'

describe('Scrabble board camera', () => {
  it('clamps and steps between 50% and 200%', () => {
    expect(clampScrabbleZoom(0.1)).toBe(SCRABBLE_BOARD_MIN_ZOOM)
    expect(clampScrabbleZoom(3)).toBe(SCRABBLE_BOARD_MAX_ZOOM)
    expect(stepScrabbleZoom(1, -1)).toBe(0.75)
    expect(stepScrabbleZoom(1, 1)).toBe(1.25)
    expect(stepScrabbleZoom(2, 1)).toBe(2)
  })

  it('fits to the smaller camera dimension', () => {
    expect(fitScrabbleBoardZoom(360, 520)).toBeCloseTo(0.509, 3)
    expect(fitScrabbleBoardZoom(330, 520)).toBe(SCRABBLE_BOARD_MIN_ZOOM)
    expect(fitScrabbleBoardZoom(684, 700)).toBe(1)
    expect(fitScrabbleBoardZoom(1600, 1600)).toBe(SCRABBLE_BOARD_MAX_ZOOM)
  })

  it('captures and restores the same normalized visual center', () => {
    const center = captureScrabbleCameraCenter(300, 180, 400, 300, 1000, 800)
    expect(center).toEqual({ x: 0.5, y: 0.4125 })
    expect(restoreScrabbleCameraCenter(center, 1500, 1200, 400, 300)).toEqual({ left: 550, top: 345 })
  })
})

describe('Scrabble board positioning', () => {
  it('names the full board from A1 to O15', () => {
    const names = Array.from({ length: 15 }, (_, row) => Array.from({ length: 15 }, (_, col) => getScrabbleCoordinate(row, col))).flat()
    expect(names).toHaveLength(225)
    expect(new Set(names).size).toBe(225)
    expect(names[0]).toBe('A1')
    expect(names[112]).toBe('H8')
    expect(names[224]).toBe('O15')
  })

  it('centers on the bounds of every word in the last play', () => {
    const event = {
      moveNumber: 4,
      playerId: 'p1',
      playerName: 'Player',
      total: 20,
      words: [
        { word: 'CAT', subtotal: 5, total: 5, wordMultiplier: 1, cells: [{ row: 7, col: 6 }, { row: 7, col: 7 }, { row: 7, col: 8 }] },
        { word: 'ATE', subtotal: 4, total: 4, wordMultiplier: 1, cells: [{ row: 6, col: 7 }, { row: 7, col: 7 }, { row: 8, col: 7 }] },
      ],
    } as ScrabbleScoreEvent
    expect(getScrabbleLastPlayCenter(event)).toEqual({ row: 7, col: 7 })
    expect(getScrabbleLastPlayCenter(null)).toBeNull()
  })
})

describe('Scrabble action presentation', () => {
  const base = {
    status: 'active' as const,
    waitingForPlayer: false,
    hasGivenUp: false,
    pendingTradeRole: 'none' as const,
    isMyTurn: false,
    swapMode: false,
  }

  it('resolves every state in gameplay precedence', () => {
    expect(resolveScrabbleActionMode({ ...base, status: 'completed' })).toBe('completed')
    expect(resolveScrabbleActionMode({ ...base, waitingForPlayer: true })).toBe('waitingForPlayer')
    expect(resolveScrabbleActionMode({ ...base, hasGivenUp: true })).toBe('observing')
    expect(resolveScrabbleActionMode({ ...base, pendingTradeRole: 'incoming' })).toBe('incomingTrade')
    expect(resolveScrabbleActionMode({ ...base, pendingTradeRole: 'outgoing' })).toBe('tradePending')
    expect(resolveScrabbleActionMode({ ...base, pendingTradeRole: 'other' })).toBe('tradePending')
    expect(resolveScrabbleActionMode({ ...base, isMyTurn: true, swapMode: true })).toBe('exchange')
    expect(resolveScrabbleActionMode({ ...base, isMyTurn: true })).toBe('place')
    expect(resolveScrabbleActionMode(base)).toBe('waitingTurn')
  })

  it('prioritizes an incoming trade over turn ownership', () => {
    expect(resolveScrabbleActionMode({ ...base, pendingTradeRole: 'incoming', isMyTurn: false })).toBe('incomingTrade')
    expect(resolveScrabbleActionMode({ ...base, pendingTradeRole: 'incoming', isMyTurn: true, swapMode: true })).toBe('incomingTrade')
  })
})
