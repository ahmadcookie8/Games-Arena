import { describe, expect, it } from 'vitest'
import {
  PROPERTY_BOARD_MAX_ZOOM,
  PROPERTY_BOARD_MIN_ZOOM,
  clampPropertyBoardZoom,
  fitPropertyBoardZoom,
  getPropertyBoardPosition,
  getPropertyBoardSide,
  resolvePropertyActionMode,
  stepPropertyBoardZoom,
  wrapPropertySquareIndex,
} from './propertyManagementBoard'

describe('Property Management board layout', () => {
  it('maps all 40 squares to unique perimeter cells', () => {
    const positions = Array.from({ length: 40 }, (_, index) => getPropertyBoardPosition(index))
    const unique = new Set(positions.map(({ row, col }) => `${row},${col}`))

    expect(unique.size).toBe(40)
    expect(positions.every(({ row, col }) => row === 1 || row === 11 || col === 1 || col === 11)).toBe(true)
  })

  it('maps corners and sides consistently around the board', () => {
    expect([0, 10, 20, 30].map(getPropertyBoardSide)).toEqual(['corner', 'corner', 'corner', 'corner'])
    expect(getPropertyBoardSide(5)).toBe('bottom')
    expect(getPropertyBoardSide(15)).toBe('left')
    expect(getPropertyBoardSide(25)).toBe('top')
    expect(getPropertyBoardSide(35)).toBe('right')
  })

  it('wraps square navigation in either direction', () => {
    expect(wrapPropertySquareIndex(-1)).toBe(39)
    expect(wrapPropertySquareIndex(40)).toBe(0)
  })
})

describe('Property Management board camera', () => {
  it('clamps and steps zoom to the supported range', () => {
    expect(clampPropertyBoardZoom(0.1)).toBe(PROPERTY_BOARD_MIN_ZOOM)
    expect(clampPropertyBoardZoom(3)).toBe(PROPERTY_BOARD_MAX_ZOOM)
    expect(stepPropertyBoardZoom(1, -1)).toBe(0.75)
    expect(stepPropertyBoardZoom(1, 1)).toBe(1.25)
    expect(stepPropertyBoardZoom(1.75, 1)).toBe(2)
    expect(stepPropertyBoardZoom(2, 1)).toBe(PROPERTY_BOARD_MAX_ZOOM)
  })

  it('fits the board to the smaller camera dimension', () => {
    expect(fitPropertyBoardZoom(390, 520)).toBe(PROPERTY_BOARD_MIN_ZOOM)
    expect(fitPropertyBoardZoom(760, 760)).toBeCloseTo(1.011, 2)
    expect(fitPropertyBoardZoom(1200, 1200)).toBeCloseTo(1.622, 2)
    expect(fitPropertyBoardZoom(2000, 2000)).toBe(PROPERTY_BOARD_MAX_ZOOM)
  })
})

describe('Property Management action presentation', () => {
  it('covers lobby, completed, waiting, and every turn phase', () => {
    expect(resolvePropertyActionMode('lobby', 'preRoll', true)).toBe('lobby')
    expect(resolvePropertyActionMode('completed', 'postRoll', true)).toBe('complete')
    expect(resolvePropertyActionMode('playing', 'preRoll', false)).toBe('waiting')
    expect(resolvePropertyActionMode('playing', 'preRoll', true)).toBe('preRoll')
    expect(resolvePropertyActionMode('playing', 'postRoll', true)).toBe('postRoll')
    expect(resolvePropertyActionMode('playing', 'buyOrAuction', true)).toBe('buyOrAuction')
    expect(resolvePropertyActionMode('playing', 'auction', false)).toBe('auction')
    expect(resolvePropertyActionMode('playing', 'card', true)).toBe('card')
  })
})
