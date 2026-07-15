import { PMPhase, PMTurnPhase } from '../types/game'

export const PROPERTY_BOARD_BASE_SIZE = 720
export const PROPERTY_BOARD_MIN_ZOOM = 0.5
export const PROPERTY_BOARD_MAX_ZOOM = 2
export const PROPERTY_BOARD_ZOOM_STEP = 0.25
export const PROPERTY_BOARD_TRACK_TEMPLATE = '1.35fr repeat(9, minmax(0, 1fr)) 1.35fr'

export interface PropertyBoardPosition {
  row: number
  col: number
}

export type PropertyBoardSide = 'corner' | 'top' | 'right' | 'bottom' | 'left'

export type PropertyActionMode =
  | 'lobby'
  | 'complete'
  | 'waiting'
  | 'preRoll'
  | 'postRoll'
  | 'buyOrAuction'
  | 'auction'
  | 'card'

export function getPropertyBoardPosition(squareIndex: number): PropertyBoardPosition {
  if (squareIndex === 0) return { row: 11, col: 11 }
  if (squareIndex <= 9) return { row: 11, col: 11 - squareIndex }
  if (squareIndex === 10) return { row: 11, col: 1 }
  if (squareIndex <= 19) return { row: 11 - (squareIndex - 10), col: 1 }
  if (squareIndex === 20) return { row: 1, col: 1 }
  if (squareIndex <= 29) return { row: 1, col: 1 + (squareIndex - 20) }
  if (squareIndex === 30) return { row: 1, col: 11 }
  return { row: 1 + (squareIndex - 30), col: 11 }
}

export function getPropertyBoardSide(squareIndex: number): PropertyBoardSide {
  if ([0, 10, 20, 30].includes(squareIndex)) return 'corner'
  if (squareIndex < 10) return 'bottom'
  if (squareIndex < 20) return 'left'
  if (squareIndex < 30) return 'top'
  return 'right'
}

export function wrapPropertySquareIndex(squareIndex: number, squareCount = 40): number {
  return (squareIndex + squareCount) % squareCount
}

export function clampPropertyBoardZoom(zoom: number): number {
  return Math.min(PROPERTY_BOARD_MAX_ZOOM, Math.max(PROPERTY_BOARD_MIN_ZOOM, zoom))
}

export function stepPropertyBoardZoom(zoom: number, direction: -1 | 1): number {
  const stepped = Math.round((zoom + direction * PROPERTY_BOARD_ZOOM_STEP) * 100) / 100
  return clampPropertyBoardZoom(stepped)
}

export function fitPropertyBoardZoom(cameraWidth: number, cameraHeight: number, padding = 16): number {
  if (cameraWidth <= 0 || cameraHeight <= 0) return 1
  const available = Math.max(0, Math.min(cameraWidth, cameraHeight) - padding * 2)
  return clampPropertyBoardZoom(available / PROPERTY_BOARD_BASE_SIZE)
}

export function resolvePropertyActionMode(
  phase: PMPhase,
  turnPhase: PMTurnPhase,
  isMyTurn: boolean,
): PropertyActionMode {
  if (phase === 'lobby') return 'lobby'
  if (phase === 'completed') return 'complete'
  if (!isMyTurn && turnPhase !== 'auction') return 'waiting'
  return turnPhase
}
