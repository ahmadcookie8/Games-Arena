export function getTabletopTabIndex(key: string, currentIndex: number, tabCount: number): number | null {
  if (tabCount <= 0) return null
  if (key === 'ArrowRight') return (currentIndex + 1) % tabCount
  if (key === 'ArrowLeft') return (currentIndex - 1 + tabCount) % tabCount
  if (key === 'Home') return 0
  if (key === 'End') return tabCount - 1
  return null
}

export function shouldWrapSheetFocus(currentIndex: number, focusableCount: number, shiftKey: boolean): number | null {
  if (focusableCount <= 0) return -1
  if (shiftKey && currentIndex <= 0) return focusableCount - 1
  if (!shiftKey && currentIndex >= focusableCount - 1) return 0
  return null
}
