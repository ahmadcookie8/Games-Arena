/**
 * The only constructors used by rendered multiplayer controls.
 *
 * Keeping payload construction here gives the backend contract tests one
 * stable seam to validate without coupling them to React implementation
 * details. These helpers intentionally do not coerce user input; components
 * must validate text and numeric values before constructing an action.
 */
export type TicTacToeMove = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'

export type WisecrackerMove =
  | { type: 'startMatch'; maxScore: number }
  | { type: 'refreshPrompt' }
  | { type: 'setPrompt'; prompt: string }
  | { type: 'submitAnswers'; answers: string[] }
  | { type: 'revealNextAnswer' }
  | { type: 'selectRoundWinner'; responseId: string }
  | { type: 'startNextRound' }

export interface ScrabblePlacementMove {
  rackTileId: string
  row: number
  col: number
  blankLetter?: string
}

export type ScrabbleMove =
  | { type: 'placeTiles'; placements: ScrabblePlacementMove[] }
  | { type: 'exchangeWithBag'; rackTileIds: string[] }
  | { type: 'offerTrade'; targetUserId: string; rackTileIds: string[] }
  | { type: 'respondTrade'; offerId?: string; accept: boolean; rackTileIds?: string[] }
  | { type: 'cancelTrade'; offerId?: string }
  | { type: 'pass' }
  | { type: 'giveUp' }

export type PropertyManagementMove =
  | { type: 'startGame' }
  | { type: 'rollDice' }
  | { type: 'buyProperty' }
  | { type: 'declineProperty' }
  | { type: 'auctionBid'; amount: number }
  | { type: 'auctionPass' }
  | { type: 'payJailFine' }
  | { type: 'useGetOutOfJailCard' }
  | { type: 'buildHouse'; squareIndex: number }
  | { type: 'sellHouse'; squareIndex: number }
  | { type: 'mortgageProperty'; squareIndex: number }
  | { type: 'unmortgageProperty'; squareIndex: number }
  | { type: 'declareBankruptcy' }
  | { type: 'endTurn' }
  | { type: 'acknowledgeCard' }

export const multiplayerActions = {
  ticTacToe: {
    place: (cell: TicTacToeMove): TicTacToeMove => cell,
  },
  wisecracker: {
    startMatch: (maxScore: number): WisecrackerMove => ({ type: 'startMatch', maxScore }),
    refreshPrompt: (): WisecrackerMove => ({ type: 'refreshPrompt' }),
    setPrompt: (prompt: string): WisecrackerMove => ({ type: 'setPrompt', prompt }),
    submitAnswers: (answers: string[]): WisecrackerMove => ({ type: 'submitAnswers', answers }),
    revealNextAnswer: (): WisecrackerMove => ({ type: 'revealNextAnswer' }),
    selectRoundWinner: (responseId: string): WisecrackerMove => ({ type: 'selectRoundWinner', responseId }),
    startNextRound: (): WisecrackerMove => ({ type: 'startNextRound' }),
  },
  scrabble: {
    placeTiles: (placements: ScrabblePlacementMove[]): ScrabbleMove => ({ type: 'placeTiles', placements }),
    exchangeWithBag: (rackTileIds: string[]): ScrabbleMove => ({ type: 'exchangeWithBag', rackTileIds }),
    offerTrade: (targetUserId: string, rackTileIds: string[]): ScrabbleMove => ({ type: 'offerTrade', targetUserId, rackTileIds }),
    acceptTrade: (offerId: string | undefined, rackTileIds: string[]): ScrabbleMove => ({ type: 'respondTrade', offerId, accept: true, rackTileIds }),
    declineTrade: (offerId?: string): ScrabbleMove => ({ type: 'respondTrade', offerId, accept: false }),
    cancelTrade: (offerId?: string): ScrabbleMove => ({ type: 'cancelTrade', offerId }),
    pass: (): ScrabbleMove => ({ type: 'pass' }),
    giveUp: (): ScrabbleMove => ({ type: 'giveUp' }),
  },
  propertyManagement: {
    startGame: (): PropertyManagementMove => ({ type: 'startGame' }),
    rollDice: (): PropertyManagementMove => ({ type: 'rollDice' }),
    buyProperty: (): PropertyManagementMove => ({ type: 'buyProperty' }),
    declineProperty: (): PropertyManagementMove => ({ type: 'declineProperty' }),
    auctionBid: (amount: number): PropertyManagementMove => ({ type: 'auctionBid', amount }),
    auctionPass: (): PropertyManagementMove => ({ type: 'auctionPass' }),
    payJailFine: (): PropertyManagementMove => ({ type: 'payJailFine' }),
    useGetOutOfJailCard: (): PropertyManagementMove => ({ type: 'useGetOutOfJailCard' }),
    buildHouse: (squareIndex: number): PropertyManagementMove => ({ type: 'buildHouse', squareIndex }),
    sellHouse: (squareIndex: number): PropertyManagementMove => ({ type: 'sellHouse', squareIndex }),
    mortgageProperty: (squareIndex: number): PropertyManagementMove => ({ type: 'mortgageProperty', squareIndex }),
    unmortgageProperty: (squareIndex: number): PropertyManagementMove => ({ type: 'unmortgageProperty', squareIndex }),
    declareBankruptcy: (): PropertyManagementMove => ({ type: 'declareBankruptcy' }),
    endTurn: (): PropertyManagementMove => ({ type: 'endTurn' }),
    acknowledgeCard: (): PropertyManagementMove => ({ type: 'acknowledgeCard' }),
  },
} as const
