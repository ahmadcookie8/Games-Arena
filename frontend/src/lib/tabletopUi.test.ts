import { describe, expect, it } from 'vitest'
import { getTabletopTabIndex, shouldWrapSheetFocus } from './tabletopUi'

describe('tabletop tab keyboard navigation', () => {
  it('moves and wraps with arrow keys', () => {
    expect(getTabletopTabIndex('ArrowRight', 2, 3)).toBe(0)
    expect(getTabletopTabIndex('ArrowLeft', 0, 3)).toBe(2)
  })

  it('jumps to the first and last tabs', () => {
    expect(getTabletopTabIndex('Home', 2, 4)).toBe(0)
    expect(getTabletopTabIndex('End', 0, 4)).toBe(3)
    expect(getTabletopTabIndex('Enter', 0, 4)).toBeNull()
  })
})

describe('tabletop sheet focus wrapping', () => {
  it('wraps at either edge and handles an empty sheet', () => {
    expect(shouldWrapSheetFocus(0, 3, true)).toBe(2)
    expect(shouldWrapSheetFocus(2, 3, false)).toBe(0)
    expect(shouldWrapSheetFocus(1, 3, false)).toBeNull()
    expect(shouldWrapSheetFocus(0, 0, false)).toBe(-1)
  })
})
