import { GameStatus, ScrabbleScoreEvent } from '../types/game'

export const SCRABBLE_BOARD_DIMENSION = 15
export const SCRABBLE_BOARD_BASE_SIZE = 660
export const SCRABBLE_BOARD_MIN_ZOOM = 0.5
export const SCRABBLE_BOARD_MAX_ZOOM = 2
export const SCRABBLE_BOARD_ZOOM_STEP = 0.25

export interface ScrabbleBoardPoint {
  row: number
  col: number
}

export interface NormalizedCameraCenter {
  x: number
  y: number
}

export interface CameraScrollPosition {
  left: number
  top: number
}

export type ScrabblePendingTradeRole = 'none' | 'incoming' | 'outgoing' | 'other'

export type ScrabbleActionMode =
  | 'completed'
  | 'waitingForPlayer'
  | 'observing'
  | 'incomingTrade'
  | 'tradePending'
  | 'exchange'
  | 'place'
  | 'waitingTurn'

export function clampScrabbleZoom(zoom: number): number {
  return Math.min(SCRABBLE_BOARD_MAX_ZOOM, Math.max(SCRABBLE_BOARD_MIN_ZOOM, zoom))
}

export function stepScrabbleZoom(zoom: number, direction: -1 | 1): number {
  return clampScrabbleZoom(Math.round((zoom + direction * SCRABBLE_BOARD_ZOOM_STEP) * 100) / 100)
}

export function fitScrabbleBoardZoom(cameraWidth: number, cameraHeight: number, padding = 12): number {
  if (cameraWidth <= 0 || cameraHeight <= 0) return 1
  const available = Math.max(0, Math.min(cameraWidth, cameraHeight) - padding * 2)
  return clampScrabbleZoom(available / SCRABBLE_BOARD_BASE_SIZE)
}

export function captureScrabbleCameraCenter(
  scrollLeft: number,
  scrollTop: number,
  clientWidth: number,
  clientHeight: number,
  scrollWidth: number,
  scrollHeight: number,
): NormalizedCameraCenter {
  return {
    x: (scrollLeft + clientWidth / 2) / Math.max(1, scrollWidth),
    y: (scrollTop + clientHeight / 2) / Math.max(1, scrollHeight),
  }
}

export function restoreScrabbleCameraCenter(
  center: NormalizedCameraCenter,
  scrollWidth: number,
  scrollHeight: number,
  clientWidth: number,
  clientHeight: number,
): CameraScrollPosition {
  const maxLeft = Math.max(0, scrollWidth - clientWidth)
  const maxTop = Math.max(0, scrollHeight - clientHeight)
  return {
    left: Math.min(maxLeft, Math.max(0, center.x * scrollWidth - clientWidth / 2)),
    top: Math.min(maxTop, Math.max(0, center.y * scrollHeight - clientHeight / 2)),
  }
}

export function getScrabbleCoordinate(row: number, col: number): string {
  const safeRow = Math.min(SCRABBLE_BOARD_DIMENSION - 1, Math.max(0, Math.round(row)))
  const safeCol = Math.min(SCRABBLE_BOARD_DIMENSION - 1, Math.max(0, Math.round(col)))
  return `${String.fromCharCode(65 + safeCol)}${safeRow + 1}`
}

export function getScrabbleLastPlayCenter(event: ScrabbleScoreEvent | null): ScrabbleBoardPoint | null {
  const cells = event?.words.flatMap((word) => word.cells) ?? []
  if (cells.length === 0) return null
  const rows = cells.map((cell) => cell.row)
  const cols = cells.map((cell) => cell.col)
  return {
    row: Math.round((Math.min(...rows) + Math.max(...rows)) / 2),
    col: Math.round((Math.min(...cols) + Math.max(...cols)) / 2),
  }
}

export function resolveScrabbleActionMode({
  status,
  waitingForPlayer,
  hasGivenUp,
  pendingTradeRole,
  isMyTurn,
  swapMode,
}: {
  status: GameStatus
  waitingForPlayer: boolean
  hasGivenUp: boolean
  pendingTradeRole: ScrabblePendingTradeRole
  isMyTurn: boolean
  swapMode: boolean
}): ScrabbleActionMode {
  if (status === 'completed') return 'completed'
  if (waitingForPlayer) return 'waitingForPlayer'
  if (hasGivenUp) return 'observing'
  if (pendingTradeRole === 'incoming') return 'incomingTrade'
  if (pendingTradeRole !== 'none') return 'tradePending'
  if (isMyTurn && swapMode) return 'exchange'
  if (isMyTurn) return 'place'
  return 'waitingTurn'
}
