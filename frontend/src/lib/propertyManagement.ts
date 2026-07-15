import { PMColorGroup, PropertyManagementState } from '../types/game'

export interface PMSquareDef {
  index: number
  name: string
  type: string
  colorGroup: PMColorGroup
  price: number | null
  houseCost: number | null
  mortgageValue: number | null
  rent: number[]
}

export const BOARD_SQUARES: PMSquareDef[] = [
  { index: 0, name: 'GO', type: 'go', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 1, name: 'Elm Street', type: 'property', colorGroup: 'brown', price: 60, houseCost: 50, mortgageValue: 30, rent: [2, 10, 30, 90, 160, 250] },
  { index: 2, name: 'Community Chest', type: 'communityChest', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 3, name: 'Oak Avenue', type: 'property', colorGroup: 'brown', price: 60, houseCost: 50, mortgageValue: 30, rent: [4, 20, 60, 180, 320, 450] },
  { index: 4, name: 'Income Tax', type: 'tax', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [200] },
  { index: 5, name: 'Transit Line 1', type: 'railroad', colorGroup: 'railroad', price: 200, houseCost: null, mortgageValue: 100, rent: [25, 50, 100, 200] },
  { index: 6, name: 'Cedar Lane', type: 'property', colorGroup: 'lightBlue', price: 100, houseCost: 50, mortgageValue: 50, rent: [6, 30, 90, 270, 400, 550] },
  { index: 7, name: 'Chance', type: 'chance', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 8, name: 'Maple Drive', type: 'property', colorGroup: 'lightBlue', price: 100, houseCost: 50, mortgageValue: 50, rent: [6, 30, 90, 270, 400, 550] },
  { index: 9, name: 'Birch Boulevard', type: 'property', colorGroup: 'lightBlue', price: 120, houseCost: 50, mortgageValue: 60, rent: [8, 40, 100, 300, 450, 600] },
  { index: 10, name: 'Jail', type: 'jail', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 11, name: 'Rose Road', type: 'property', colorGroup: 'pink', price: 140, houseCost: 100, mortgageValue: 70, rent: [10, 50, 150, 450, 625, 750] },
  { index: 12, name: 'Power Co.', type: 'utility', colorGroup: 'utility', price: 150, houseCost: null, mortgageValue: 75, rent: [4, 10] },
  { index: 13, name: 'Violet Way', type: 'property', colorGroup: 'pink', price: 140, houseCost: 100, mortgageValue: 70, rent: [10, 50, 150, 450, 625, 750] },
  { index: 14, name: 'Lavender Lane', type: 'property', colorGroup: 'pink', price: 160, houseCost: 100, mortgageValue: 80, rent: [12, 60, 180, 500, 700, 900] },
  { index: 15, name: 'Transit Line 2', type: 'railroad', colorGroup: 'railroad', price: 200, houseCost: null, mortgageValue: 100, rent: [25, 50, 100, 200] },
  { index: 16, name: 'Amber Court', type: 'property', colorGroup: 'orange', price: 180, houseCost: 100, mortgageValue: 90, rent: [14, 70, 200, 550, 750, 950] },
  { index: 17, name: 'Community Chest', type: 'communityChest', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 18, name: 'Tangerine Terrace', type: 'property', colorGroup: 'orange', price: 180, houseCost: 100, mortgageValue: 90, rent: [14, 70, 200, 550, 750, 950] },
  { index: 19, name: 'Sienna Square', type: 'property', colorGroup: 'orange', price: 200, houseCost: 100, mortgageValue: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { index: 20, name: 'Free Parking', type: 'freeParking', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 21, name: 'Crimson Close', type: 'property', colorGroup: 'red', price: 220, houseCost: 150, mortgageValue: 110, rent: [18, 90, 250, 700, 875, 1050] },
  { index: 22, name: 'Chance', type: 'chance', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 23, name: 'Scarlet Street', type: 'property', colorGroup: 'red', price: 220, houseCost: 150, mortgageValue: 110, rent: [18, 90, 250, 700, 875, 1050] },
  { index: 24, name: 'Ruby Rise', type: 'property', colorGroup: 'red', price: 240, houseCost: 150, mortgageValue: 120, rent: [20, 100, 300, 750, 925, 1100] },
  { index: 25, name: 'Transit Line 3', type: 'railroad', colorGroup: 'railroad', price: 200, houseCost: null, mortgageValue: 100, rent: [25, 50, 100, 200] },
  { index: 26, name: 'Gold Gate', type: 'property', colorGroup: 'yellow', price: 260, houseCost: 150, mortgageValue: 130, rent: [22, 110, 330, 800, 975, 1150] },
  { index: 27, name: 'Amber Heights', type: 'property', colorGroup: 'yellow', price: 260, houseCost: 150, mortgageValue: 130, rent: [22, 110, 330, 800, 975, 1150] },
  { index: 28, name: 'Water Co.', type: 'utility', colorGroup: 'utility', price: 150, houseCost: null, mortgageValue: 75, rent: [4, 10] },
  { index: 29, name: 'Canary Crescent', type: 'property', colorGroup: 'yellow', price: 280, houseCost: 150, mortgageValue: 140, rent: [24, 120, 360, 850, 1025, 1200] },
  { index: 30, name: 'Go To Jail', type: 'goToJail', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 31, name: 'Emerald Estate', type: 'property', colorGroup: 'green', price: 300, houseCost: 200, mortgageValue: 150, rent: [26, 130, 390, 900, 1100, 1275] },
  { index: 32, name: 'Jade Junction', type: 'property', colorGroup: 'green', price: 300, houseCost: 200, mortgageValue: 150, rent: [26, 130, 390, 900, 1100, 1275] },
  { index: 33, name: 'Community Chest', type: 'communityChest', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 34, name: 'Fern Field', type: 'property', colorGroup: 'green', price: 320, houseCost: 200, mortgageValue: 160, rent: [28, 150, 450, 1000, 1200, 1400] },
  { index: 35, name: 'Transit Line 4', type: 'railroad', colorGroup: 'railroad', price: 200, houseCost: null, mortgageValue: 100, rent: [25, 50, 100, 200] },
  { index: 36, name: 'Chance', type: 'chance', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [] },
  { index: 37, name: 'Sapphire Street', type: 'property', colorGroup: 'darkBlue', price: 350, houseCost: 200, mortgageValue: 175, rent: [35, 175, 500, 1100, 1300, 1500] },
  { index: 38, name: 'Luxury Tax', type: 'tax', colorGroup: null, price: null, houseCost: null, mortgageValue: null, rent: [100] },
  { index: 39, name: 'Indigo Place', type: 'property', colorGroup: 'darkBlue', price: 400, houseCost: 200, mortgageValue: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
]

export const COLOR_GROUPS: Record<string, number[]> = {
  brown: [1, 3],
  lightBlue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  darkBlue: [37, 39],
  railroad: [5, 15, 25, 35],
  utility: [12, 28],
}

export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#ec4899', '#14b8a6']

export const GROUP_STRIP_CLASSES: Record<string, string> = {
  brown: 'bg-amber-800',
  lightBlue: 'bg-sky-300',
  pink: 'bg-pink-400',
  orange: 'bg-orange-400',
  red: 'bg-red-500',
  yellow: 'bg-yellow-300',
  green: 'bg-green-600',
  darkBlue: 'bg-blue-800',
  railroad: 'bg-slate-500',
  utility: 'bg-slate-400',
}

export function ownsColorGroup(state: PropertyManagementState, colorGroup: string, ownerId: string): boolean {
  const indices = COLOR_GROUPS[colorGroup]
  if (!indices) return false
  return indices.every((index) => {
    const ownership = state.properties[String(index)]
    return ownership && ownership.ownerId === ownerId && !ownership.mortgaged
  })
}

export function canBuildHouse(state: PropertyManagementState, userId: string, squareIndex: number): boolean {
  const square = BOARD_SQUARES[squareIndex]
  const ownership = state.properties[String(squareIndex)]
  if (!square || !ownership || square.type !== 'property' || !square.colorGroup) return false
  if (ownership.ownerId !== userId || ownership.mortgaged || ownership.houses >= 5) return false
  if (!ownsColorGroup(state, square.colorGroup, userId)) return false
  const groupIndices = COLOR_GROUPS[square.colorGroup] ?? []
  const minHouses = Math.min(...groupIndices.map((index) => state.properties[String(index)]?.houses ?? 0))
  return ownership.houses <= minHouses && (state.playerStates[userId]?.money ?? 0) >= (square.houseCost ?? 0)
}

export function canSellHouse(state: PropertyManagementState, userId: string, squareIndex: number): boolean {
  const square = BOARD_SQUARES[squareIndex]
  const ownership = state.properties[String(squareIndex)]
  if (!square || !ownership || !square.colorGroup) return false
  if (ownership.ownerId !== userId || ownership.houses <= 0) return false
  const groupIndices = COLOR_GROUPS[square.colorGroup] ?? []
  const maxHouses = Math.max(...groupIndices.map((index) => state.properties[String(index)]?.houses ?? 0))
  return ownership.houses >= maxHouses
}

export function canMortgage(state: PropertyManagementState, userId: string, squareIndex: number): boolean {
  const square = BOARD_SQUARES[squareIndex]
  const ownership = state.properties[String(squareIndex)]
  if (!square || !ownership) return false
  if (ownership.ownerId !== userId || ownership.mortgaged || ownership.houses > 0) return false
  if (square.colorGroup) {
    const groupIndices = COLOR_GROUPS[square.colorGroup] ?? []
    return !groupIndices.some((index) => (state.properties[String(index)]?.houses ?? 0) > 0)
  }
  return true
}

export function getBuildLabel(houses: number): string {
  if (houses >= 5) return 'Hotel'
  if (houses <= 0) return ''
  return `${houses} house${houses === 1 ? '' : 's'}`
}
