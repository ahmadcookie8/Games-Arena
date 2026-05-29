import { BadRequestError } from '../utils/errors'
import { isCommonAbbreviation, isDictionaryWord } from './ScrabbleDictionary'

export type ScrabblePremium = 'DL' | 'TL' | 'DW' | 'TW'

export interface ScrabbleTile {
  id: string
  letter: string
  value: number
  isBlank: boolean
}

export interface ScrabbleCell {
  tile: ScrabbleTile
  placedBy: string
}

export interface ScrabblePlacement {
  rackTileId: string
  row: number
  col: number
  blankLetter?: string
}

export interface ScrabbleWordScore {
  word: string
  cells: Array<{
    row: number
    col: number
    letter: string
    baseValue: number
    letterMultiplier: number
    afterLetterMultiplier: number
    isNewTile: boolean
  }>
  wordMultiplier: number
  subtotal: number
  total: number
}

export interface ScrabbleScoreEvent {
  moveNumber: number
  playerId: string
  playerName: string
  words: ScrabbleWordScore[]
  total: number
}

export interface ScrabblePendingTrade {
  offerId: string
  fromUserId: string
  targetUserId: string
  offeredTiles: ScrabbleTile[]
}

export interface ScrabbleState {
  board: (ScrabbleCell | null)[][]
  racks: Record<string, ScrabbleTile[]>
  scores: Record<string, number>
  bag: ScrabbleTile[]
  infiniteLetters: boolean
  usedPremiumSquares: string[]
  pendingTrade: ScrabblePendingTrade | null
  consecutivePasses: number
  givenUpUserIds: string[]
  lastScoreEvent: ScrabbleScoreEvent | null
}

export type ScrabbleAction =
  | { type: 'placeTiles'; placements: ScrabblePlacement[] }
  | { type: 'exchangeWithBag'; rackTileIds: string[] }
  | { type: 'offerTrade'; targetUserId: string; rackTileIds: string[] }
  | { type: 'respondTrade'; accept: boolean; rackTileIds?: string[] }
  | { type: 'pass' }
  | { type: 'giveUp' }

export interface ScrabblePlayerView {
  userId: string
  username: string
}

export interface ScrabbleApplyResult {
  state: ScrabbleState
  description: string
  completed: boolean
  winnerUserId?: string
  isDraw?: boolean
}

const BOARD_SIZE = 15
const RACK_SIZE = 7
const CENTER = 7

const TILE_DISTRIBUTION: Array<{ letter: string; value: number; count: number }> = [
  { letter: 'A', value: 1, count: 9 },
  { letter: 'B', value: 3, count: 2 },
  { letter: 'C', value: 3, count: 2 },
  { letter: 'D', value: 2, count: 4 },
  { letter: 'E', value: 1, count: 12 },
  { letter: 'F', value: 4, count: 2 },
  { letter: 'G', value: 2, count: 3 },
  { letter: 'H', value: 4, count: 2 },
  { letter: 'I', value: 1, count: 9 },
  { letter: 'J', value: 8, count: 1 },
  { letter: 'K', value: 5, count: 1 },
  { letter: 'L', value: 1, count: 4 },
  { letter: 'M', value: 3, count: 2 },
  { letter: 'N', value: 1, count: 6 },
  { letter: 'O', value: 1, count: 8 },
  { letter: 'P', value: 3, count: 2 },
  { letter: 'Q', value: 10, count: 1 },
  { letter: 'R', value: 1, count: 6 },
  { letter: 'S', value: 1, count: 4 },
  { letter: 'T', value: 1, count: 6 },
  { letter: 'U', value: 1, count: 4 },
  { letter: 'V', value: 4, count: 2 },
  { letter: 'W', value: 4, count: 2 },
  { letter: 'X', value: 8, count: 1 },
  { letter: 'Y', value: 4, count: 2 },
  { letter: 'Z', value: 10, count: 1 },
  { letter: '?', value: 0, count: 2 },
]

const PREMIUMS: Record<string, ScrabblePremium> = {
  '0,0': 'TW', '0,7': 'TW', '0,14': 'TW', '7,0': 'TW', '7,14': 'TW', '14,0': 'TW', '14,7': 'TW', '14,14': 'TW',
  '1,1': 'DW', '2,2': 'DW', '3,3': 'DW', '4,4': 'DW', '10,10': 'DW', '11,11': 'DW', '12,12': 'DW', '13,13': 'DW',
  '1,13': 'DW', '2,12': 'DW', '3,11': 'DW', '4,10': 'DW', '10,4': 'DW', '11,3': 'DW', '12,2': 'DW', '13,1': 'DW',
  '1,5': 'TL', '1,9': 'TL', '5,1': 'TL', '5,5': 'TL', '5,9': 'TL', '5,13': 'TL', '9,1': 'TL', '9,5': 'TL', '9,9': 'TL', '9,13': 'TL', '13,5': 'TL', '13,9': 'TL',
  '0,3': 'DL', '0,11': 'DL', '2,6': 'DL', '2,8': 'DL', '3,0': 'DL', '3,7': 'DL', '3,14': 'DL', '6,2': 'DL', '6,6': 'DL', '6,8': 'DL', '6,12': 'DL',
  '7,3': 'DL', '7,11': 'DL', '8,2': 'DL', '8,6': 'DL', '8,8': 'DL', '8,12': 'DL', '11,0': 'DL', '11,7': 'DL', '11,14': 'DL', '12,6': 'DL', '12,8': 'DL', '14,3': 'DL', '14,11': 'DL',
}

const TWO_LETTER_WORDS = new Set([
  'aa', 'ab', 'ad', 'ae', 'ag', 'ah', 'ai', 'al', 'am', 'an', 'ar', 'as', 'at', 'aw', 'ax', 'ay',
  'ba', 'be', 'bi', 'bo', 'by', 'da', 'de', 'do', 'ed', 'ef', 'eh', 'el', 'em', 'en', 'er', 'es', 'et',
  'ew', 'ex', 'fa', 'fe', 'gi', 'go', 'ha', 'he', 'hi', 'hm', 'ho', 'id', 'if', 'in', 'is', 'it',
  'jo', 'ka', 'ki', 'ko', 'la', 'li', 'lo', 'ma', 'me', 'mi', 'mm', 'mo', 'mu', 'my', 'na', 'ne',
  'no', 'nu', 'od', 'oe', 'of', 'oh', 'oi', 'om', 'on', 'op', 'or', 'os', 'ow', 'ox', 'oy', 'pa',
  'pe', 'pi', 'qi', 're', 'sh', 'si', 'so', 'ta', 'te', 'ti', 'to', 'uh', 'um', 'un', 'up', 'us',
  'ut', 'we', 'wo', 'xi', 'xu', 'ya', 'ye', 'yo', 'za',
])

const TWO_LETTER_ELEMENT_SYMBOLS = new Set([
  'he', 'li', 'be', 'ne', 'na', 'mg', 'al', 'si', 'cl', 'ar', 'ca', 'sc', 'ti', 'cr', 'mn', 'fe',
  'co', 'ni', 'cu', 'zn', 'ga', 'ge', 'as', 'se', 'br', 'kr', 'rb', 'sr', 'zr', 'nb', 'mo', 'tc',
  'ru', 'rh', 'pd', 'ag', 'cd', 'in', 'sn', 'sb', 'te', 'xe', 'cs', 'ba', 'la', 'ce', 'pr', 'nd',
  'pm', 'sm', 'eu', 'gd', 'tb', 'dy', 'ho', 'er', 'tm', 'yb', 'lu', 'hf', 'ta', 're', 'os', 'ir',
  'pt', 'au', 'hg', 'tl', 'pb', 'bi', 'po', 'at', 'rn', 'fr', 'ra', 'ac', 'th', 'pa', 'np', 'pu',
  'am', 'cm', 'bk', 'cf', 'es', 'fm', 'md', 'no', 'lr', 'rf', 'db', 'sg', 'bh', 'hs', 'mt', 'ds',
  'rg', 'cn', 'nh', 'fl', 'mc', 'lv', 'ts', 'og',
])

export class Scrabble {
  static createInitialState(hostUserId: string, infiniteLetters = false): ScrabbleState {
    const bag = shuffle(createTileBag())
    const state: ScrabbleState = {
      board: createEmptyBoard(),
      racks: { [hostUserId]: [] },
      scores: { [hostUserId]: 0 },
      bag,
      infiniteLetters,
      usedPremiumSquares: [],
      pendingTrade: null,
      consecutivePasses: 0,
      givenUpUserIds: [],
      lastScoreEvent: null,
    }
    drawToRack(state, hostUserId)
    return state
  }

  static addPlayer(state: ScrabbleState, userId: string): ScrabbleState {
    const next = clone(state)
    if (Object.keys(next.racks).includes(userId)) return next
    if (Object.keys(next.racks).length >= 4) throw new BadRequestError('Game is full')
    next.racks[userId] = []
    next.scores[userId] = 0
    drawToRack(next, userId)
    return next
  }

  static setInfiniteLetters(state: ScrabbleState, infiniteLetters: boolean): ScrabbleState {
    const next = clone(state)
    next.infiniteLetters = infiniteLetters
    if (!infiniteLetters && next.bag.length === 0) {
      next.bag = shuffle(createTileBag())
      for (const rack of Object.values(next.racks)) {
        const rackIds = new Set(rack.map((tile) => tile.id))
        next.bag = next.bag.filter((tile) => !rackIds.has(tile.id))
      }
    }
    return next
  }

  static applyAction(
    state: ScrabbleState,
    action: ScrabbleAction,
    userId: string,
    players: ScrabblePlayerView[],
    currentTurnIndex: number,
    moveNumber: number
  ): ScrabbleApplyResult {
    const next = clone(state)
    normalize(next, players)
    if (!next.racks[userId]) throw new BadRequestError('You are not in this game')

    if (action.type === 'respondTrade') {
      return respondTrade(next, action, userId, players, currentTurnIndex)
    }

    ensureNoPendingTrade(next)
    ensureCurrentPlayer(players, currentTurnIndex, userId)
    ensureCanAct(next, userId)

    switch (action.type) {
      case 'placeTiles':
        return placeTiles(next, action.placements, userId, players, currentTurnIndex, moveNumber)
      case 'exchangeWithBag':
        return exchangeWithBag(next, action.rackTileIds, userId, players, currentTurnIndex)
      case 'offerTrade':
        return offerTrade(next, action.targetUserId, action.rackTileIds, userId, players, currentTurnIndex)
      case 'pass':
        next.consecutivePasses += 1
        next.lastScoreEvent = null
        return finishTurn(next, players, currentTurnIndex, `${getPlayerName(players, userId)} passed`)
      case 'giveUp':
        if (!next.givenUpUserIds.includes(userId)) next.givenUpUserIds.push(userId)
        next.consecutivePasses = 0
        next.lastScoreEvent = null
        return finishTurn(next, players, currentTurnIndex, `${getPlayerName(players, userId)} gave up`)
    }
  }

  static getMoveDescription(action: ScrabbleAction): string {
    switch (action.type) {
      case 'placeTiles': return `played ${action.placements.length} tile${action.placements.length === 1 ? '' : 's'}`
      case 'exchangeWithBag': return `exchanged ${action.rackTileIds.length} tile${action.rackTileIds.length === 1 ? '' : 's'} with the bag`
      case 'offerTrade': return `offered ${action.rackTileIds.length} tile${action.rackTileIds.length === 1 ? '' : 's'} for trade`
      case 'respondTrade': return action.accept ? 'accepted a tile trade' : 'declined a tile trade'
      case 'pass': return 'passed'
      case 'giveUp': return 'gave up'
    }
  }

  static getPremium(row: number, col: number): ScrabblePremium | undefined {
    return PREMIUMS[key(row, col)]
  }
}

function placeTiles(
  state: ScrabbleState,
  placements: ScrabblePlacement[],
  userId: string,
  players: ScrabblePlayerView[],
  currentTurnIndex: number,
  moveNumber: number
): ScrabbleApplyResult {
  if (!Array.isArray(placements) || placements.length === 0) throw new BadRequestError('Place at least one tile')
  validatePlacementShape(state, placements)

  const rack = state.racks[userId]
  const rackById = new Map(rack.map((tile) => [tile.id, tile]))
  const placedTiles = new Map<string, ScrabbleTile>()
  const usedRackIds = new Set<string>()

  for (const placement of placements) {
    const tile = rackById.get(placement.rackTileId)
    if (!tile) throw new BadRequestError('Placed tile is not in your rack')
    if (usedRackIds.has(tile.id)) throw new BadRequestError('Cannot place the same tile twice')
    usedRackIds.add(tile.id)
    const letter = resolveTileLetter(tile, placement.blankLetter)
    placedTiles.set(key(placement.row, placement.col), { ...tile, letter })
  }

  const boardWithMove = cloneBoard(state.board)
  for (const placement of placements) {
    const tile = placedTiles.get(key(placement.row, placement.col))!
    boardWithMove[placement.row][placement.col] = { tile, placedBy: userId }
  }

  ensureMoveConnects(state, placements, boardWithMove)
  const words = getFormedWords(state, boardWithMove, placements)
  if (words.length === 0) throw new BadRequestError('Move must form a word')
  for (const word of words) {
    if (!isAllowedWord(word.word)) throw new BadRequestError(`Word not allowed: ${word.word.toUpperCase()}`)
  }

  const scoreEvent = scoreWords(state, words, placements, userId, getPlayerName(players, userId), moveNumber)
  state.board = boardWithMove
  state.racks[userId] = rack.filter((tile) => !usedRackIds.has(tile.id))
  state.scores[userId] = (state.scores[userId] || 0) + scoreEvent.total
  for (const placement of placements) {
    if (PREMIUMS[key(placement.row, placement.col)]) state.usedPremiumSquares.push(key(placement.row, placement.col))
  }
  drawToRack(state, userId)
  state.consecutivePasses = 0
  state.lastScoreEvent = scoreEvent

  return finishTurn(state, players, currentTurnIndex, `${getPlayerName(players, userId)} scored ${scoreEvent.total}`)
}

function exchangeWithBag(
  state: ScrabbleState,
  rackTileIds: string[],
  userId: string,
  players: ScrabblePlayerView[],
  currentTurnIndex: number
): ScrabbleApplyResult {
  const ids = uniqueIds(rackTileIds)
  if (ids.length === 0) throw new BadRequestError('Choose at least one tile to exchange')
  if (!state.infiniteLetters && state.bag.length < ids.length) throw new BadRequestError('Not enough tiles left in the bag')

  const rack = state.racks[userId]
  const returned = ids.map((id) => {
    const tile = rack.find((candidate) => candidate.id === id)
    if (!tile) throw new BadRequestError('Exchange tile is not in your rack')
    return tile
  })
  state.racks[userId] = rack.filter((tile) => !ids.includes(tile.id))
  drawToRack(state, userId)
  if (!state.infiniteLetters) state.bag = shuffle([...state.bag, ...returned])
  state.consecutivePasses = 0
  state.lastScoreEvent = null
  return finishTurn(state, players, currentTurnIndex, `${getPlayerName(players, userId)} exchanged ${ids.length} tile${ids.length === 1 ? '' : 's'}`)
}

function offerTrade(
  state: ScrabbleState,
  targetUserId: string,
  rackTileIds: string[],
  userId: string,
  players: ScrabblePlayerView[],
  currentTurnIndex: number
): ScrabbleApplyResult {
  if (targetUserId === userId) throw new BadRequestError('Choose another player to trade with')
  if (!state.racks[targetUserId]) throw new BadRequestError('Trade target is not in this game')
  if (state.givenUpUserIds.includes(targetUserId)) throw new BadRequestError('Cannot trade with a player who gave up')
  const ids = uniqueIds(rackTileIds)
  if (ids.length === 0) throw new BadRequestError('Choose at least one tile to trade')
  const offeredTiles = ids.map((id) => {
    const tile = state.racks[userId].find((candidate) => candidate.id === id)
    if (!tile) throw new BadRequestError('Trade tile is not in your rack')
    return tile
  })
  state.pendingTrade = {
    offerId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fromUserId: userId,
    targetUserId,
    offeredTiles,
  }
  state.lastScoreEvent = null
  return {
    state,
    description: `${getPlayerName(players, userId)} offered a trade to ${getPlayerName(players, targetUserId)}`,
    completed: false,
  }
}

function respondTrade(
  state: ScrabbleState,
  action: Extract<ScrabbleAction, { type: 'respondTrade' }>,
  userId: string,
  players: ScrabblePlayerView[],
  currentTurnIndex: number
): ScrabbleApplyResult {
  if (!state.pendingTrade) throw new BadRequestError('There is no pending trade')
  if (state.pendingTrade.targetUserId !== userId) throw new BadRequestError('Only the target player can respond to this trade')

  const trade = state.pendingTrade
  if (!action.accept) {
    state.pendingTrade = null
    state.lastScoreEvent = null
    return {
      state,
      description: `${getPlayerName(players, userId)} declined a tile trade`,
      completed: false,
    }
  }

  const responseIds = uniqueIds(action.rackTileIds || [])
  if (responseIds.length !== trade.offeredTiles.length) throw new BadRequestError('Choose the same number of tiles')
  const responseTiles = responseIds.map((id) => {
    const tile = state.racks[userId].find((candidate) => candidate.id === id)
    if (!tile) throw new BadRequestError('Trade response tile is not in your rack')
    return tile
  })
  const offeredIds = trade.offeredTiles.map((tile) => tile.id)

  state.racks[trade.fromUserId] = [
    ...state.racks[trade.fromUserId].filter((tile) => !offeredIds.includes(tile.id)),
    ...responseTiles,
  ]
  state.racks[userId] = [
    ...state.racks[userId].filter((tile) => !responseIds.includes(tile.id)),
    ...trade.offeredTiles,
  ]
  state.pendingTrade = null
  state.consecutivePasses = 0
  state.lastScoreEvent = null
  return finishTurn(state, players, currentTurnIndex, `${getPlayerName(players, userId)} accepted a tile trade`)
}

function finishTurn(state: ScrabbleState, players: ScrabblePlayerView[], currentTurnIndex: number, description: string): ScrabbleApplyResult {
  const activeIds = players.map((player) => player.userId).filter((id) => !state.givenUpUserIds.includes(id))
  if (activeIds.length <= 1 && players.length >= 2) {
    return {
      state,
      description,
      completed: true,
      winnerUserId: activeIds[0] || getHighestScoringPlayer(state, players),
    }
  }

  if (!state.infiniteLetters && state.bag.length === 0 && state.consecutivePasses >= Math.max(activeIds.length, 1)) {
    const winnerUserId = getHighestScoringPlayer(state, players)
    const highScore = state.scores[winnerUserId] || 0
    const tied = players.filter((player) => (state.scores[player.userId] || 0) === highScore)
    return {
      state,
      description,
      completed: true,
      winnerUserId,
      isDraw: tied.length > 1,
    }
  }

  return { state, description, completed: false }
}

function scoreWords(
  state: ScrabbleState,
  words: Array<{ word: string; cells: Array<{ row: number; col: number; cell: ScrabbleCell }> }>,
  placements: ScrabblePlacement[],
  playerId: string,
  playerName: string,
  moveNumber: number
): ScrabbleScoreEvent {
  const newSquareKeys = new Set(placements.map((placement) => key(placement.row, placement.col)))
  const used = new Set(state.usedPremiumSquares)
  const wordScores = words.map((word) => {
    let wordMultiplier = 1
    const cells = word.cells.map(({ row, col, cell }) => {
      const square = key(row, col)
      const isNewTile = newSquareKeys.has(square)
      const premium = isNewTile && !used.has(square) ? PREMIUMS[square] : undefined
      const letterMultiplier = premium === 'DL' ? 2 : premium === 'TL' ? 3 : 1
      if (premium === 'DW') wordMultiplier *= 2
      if (premium === 'TW') wordMultiplier *= 3
      return {
        row,
        col,
        letter: cell.tile.letter,
        baseValue: cell.tile.value,
        letterMultiplier,
        afterLetterMultiplier: cell.tile.value * letterMultiplier,
        isNewTile,
      }
    })
    const subtotal = cells.reduce((sum, cell) => sum + cell.afterLetterMultiplier, 0)
    return {
      word: word.word,
      cells,
      wordMultiplier,
      subtotal,
      total: subtotal * wordMultiplier,
    }
  })

  return {
    moveNumber,
    playerId,
    playerName,
    words: wordScores,
    total: wordScores.reduce((sum, word) => sum + word.total, 0),
  }
}

function getFormedWords(
  previousState: ScrabbleState,
  board: (ScrabbleCell | null)[][],
  placements: ScrabblePlacement[]
): Array<{ word: string; cells: Array<{ row: number; col: number; cell: ScrabbleCell }> }> {
  const rows = new Set(placements.map((placement) => placement.row))
  const cols = new Set(placements.map((placement) => placement.col))
  const direction = rows.size === 1 ? 'horizontal' : cols.size === 1 ? 'vertical' : 'single'
  const words = new Map<string, { word: string; cells: Array<{ row: number; col: number; cell: ScrabbleCell }> }>()

  if (direction !== 'single') {
    const anchor = placements[0]
    addWord(words, gatherWord(board, anchor.row, anchor.col, direction === 'horizontal' ? 0 : 1, direction === 'horizontal' ? 1 : 0))
  } else {
    const anchor = placements[0]
    addWord(words, gatherWord(board, anchor.row, anchor.col, 0, 1))
    addWord(words, gatherWord(board, anchor.row, anchor.col, 1, 0))
  }

  for (const placement of placements) {
    const crossDirection = direction === 'horizontal' ? [1, 0] : [0, 1]
    if (direction === 'single') continue
    addWord(words, gatherWord(board, placement.row, placement.col, crossDirection[0], crossDirection[1]))
  }

  return [...words.values()].filter((word) => word.word.length > 1 && includesNewTile(previousState, word.cells))
}

function gatherWord(board: (ScrabbleCell | null)[][], row: number, col: number, dr: number, dc: number): { word: string; cells: Array<{ row: number; col: number; cell: ScrabbleCell }> } {
  let startRow = row
  let startCol = col
  while (inBounds(startRow - dr, startCol - dc) && board[startRow - dr][startCol - dc]) {
    startRow -= dr
    startCol -= dc
  }

  const cells: Array<{ row: number; col: number; cell: ScrabbleCell }> = []
  let currentRow = startRow
  let currentCol = startCol
  while (inBounds(currentRow, currentCol) && board[currentRow][currentCol]) {
    cells.push({ row: currentRow, col: currentCol, cell: board[currentRow][currentCol]! })
    currentRow += dr
    currentCol += dc
  }
  return { word: cells.map((item) => item.cell.tile.letter).join('').toLowerCase(), cells }
}

function addWord(words: Map<string, { word: string; cells: Array<{ row: number; col: number; cell: ScrabbleCell }> }>, word: { word: string; cells: Array<{ row: number; col: number; cell: ScrabbleCell }> }): void {
  if (word.word.length <= 1) return
  words.set(word.cells.map((cell) => key(cell.row, cell.col)).join('|'), word)
}

function validatePlacementShape(state: ScrabbleState, placements: ScrabblePlacement[]): void {
  const seen = new Set<string>()
  for (const placement of placements) {
    if (!Number.isInteger(placement.row) || !Number.isInteger(placement.col) || !inBounds(placement.row, placement.col)) {
      throw new BadRequestError('Placement is outside the board')
    }
    const square = key(placement.row, placement.col)
    if (seen.has(square)) throw new BadRequestError('Cannot place two tiles on the same square')
    seen.add(square)
    if (state.board[placement.row][placement.col]) throw new BadRequestError('That square is already occupied')
  }

  const rows = new Set(placements.map((placement) => placement.row))
  const cols = new Set(placements.map((placement) => placement.col))
  if (rows.size > 1 && cols.size > 1) throw new BadRequestError('Tiles must be placed in one row or column')

  if (placements.length > 1) {
    const sameRow = rows.size === 1
    const fixed = sameRow ? placements[0].row : placements[0].col
    const values = placements.map((placement) => sameRow ? placement.col : placement.row)
    const min = Math.min(...values)
    const max = Math.max(...values)
    for (let value = min; value <= max; value += 1) {
      const row = sameRow ? fixed : value
      const col = sameRow ? value : fixed
      if (!state.board[row][col] && !seen.has(key(row, col))) throw new BadRequestError('Placed tiles must be contiguous')
    }
  }
}

function ensureMoveConnects(state: ScrabbleState, placements: ScrabblePlacement[], boardWithMove: (ScrabbleCell | null)[][]): void {
  const boardWasEmpty = state.board.every((row) => row.every((cell) => cell === null))
  if (boardWasEmpty) {
    if (!placements.some((placement) => placement.row === CENTER && placement.col === CENTER)) {
      throw new BadRequestError('First move must cover the center square')
    }
    return
  }

  const touchesExisting = placements.some((placement) => {
    const neighbors = [
      [placement.row - 1, placement.col],
      [placement.row + 1, placement.col],
      [placement.row, placement.col - 1],
      [placement.row, placement.col + 1],
    ]
    return neighbors.some(([row, col]) => inBounds(row, col) && Boolean(state.board[row][col]))
      || wordContainsExistingTile(state, boardWithMove, placement.row, placement.col, 0, 1)
      || wordContainsExistingTile(state, boardWithMove, placement.row, placement.col, 1, 0)
  })
  if (!touchesExisting) throw new BadRequestError('Move must connect to the existing board')
}

function wordContainsExistingTile(state: ScrabbleState, board: (ScrabbleCell | null)[][], row: number, col: number, dr: number, dc: number): boolean {
  return gatherWord(board, row, col, dr, dc).cells.some((cell) => Boolean(state.board[cell.row][cell.col]))
}

function includesNewTile(state: ScrabbleState, cells: Array<{ row: number; col: number }>): boolean {
  return cells.some((cell) => !state.board[cell.row][cell.col])
}

function isAllowedWord(word: string): boolean {
  const normalized = word.toLowerCase()
  if (!/^[a-z]+$/.test(normalized)) return false
  if (normalized.length < 2) return false
  return TWO_LETTER_WORDS.has(normalized)
    || TWO_LETTER_ELEMENT_SYMBOLS.has(normalized)
    || isDictionaryWord(normalized)
    || isCommonAbbreviation(normalized)
}

function drawToRack(state: ScrabbleState, userId: string): void {
  while (state.racks[userId].length < RACK_SIZE) {
    const tile = state.infiniteLetters ? drawInfiniteTile() : state.bag.shift()
    if (!tile) return
    state.racks[userId].push(tile)
  }
}

function drawInfiniteTile(): ScrabbleTile {
  const totalWeight = TILE_DISTRIBUTION.reduce((sum, item) => sum + item.count, 0)
  let roll = Math.floor(Math.random() * totalWeight)
  const item = TILE_DISTRIBUTION.find((candidate) => {
    roll -= candidate.count
    return roll < 0
  }) || TILE_DISTRIBUTION[0]
  return makeTile(item.letter, item.value)
}

function createTileBag(): ScrabbleTile[] {
  return TILE_DISTRIBUTION.flatMap((item) => Array.from({ length: item.count }, () => makeTile(item.letter, item.value)))
}

function makeTile(letter: string, value: number): ScrabbleTile {
  return {
    id: `${letter}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    letter,
    value,
    isBlank: letter === '?',
  }
}

function resolveTileLetter(tile: ScrabbleTile, blankLetter?: string): string {
  if (!tile.isBlank) return tile.letter
  const normalized = String(blankLetter || '').trim().toUpperCase()
  if (!/^[A-Z]$/.test(normalized)) throw new BadRequestError('Choose a letter for each blank tile')
  return normalized
}

function ensureCurrentPlayer(players: ScrabblePlayerView[], currentTurnIndex: number, userId: string): void {
  if (players[currentTurnIndex]?.userId !== userId) throw new BadRequestError('It is not your turn')
}

function ensureCanAct(state: ScrabbleState, userId: string): void {
  if (state.givenUpUserIds.includes(userId)) throw new BadRequestError('You have already given up')
}

function ensureNoPendingTrade(state: ScrabbleState): void {
  if (state.pendingTrade) throw new BadRequestError('Resolve the pending trade first')
}

function normalize(state: ScrabbleState, players: ScrabblePlayerView[]): void {
  for (const player of players) {
    state.racks[player.userId] = state.racks[player.userId] || []
    state.scores[player.userId] = state.scores[player.userId] || 0
  }
}

function getHighestScoringPlayer(state: ScrabbleState, players: ScrabblePlayerView[]): string {
  return players.reduce((best, player) => (state.scores[player.userId] || 0) > (state.scores[best] || 0) ? player.userId : best, players[0]?.userId || '')
}

function getPlayerName(players: ScrabblePlayerView[], userId: string): string {
  return players.find((player) => player.userId === userId)?.username || 'Unknown'
}

function createEmptyBoard(): (ScrabbleCell | null)[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null))
}

function clone(state: ScrabbleState): ScrabbleState {
  return JSON.parse(JSON.stringify(state))
}

function cloneBoard(board: (ScrabbleCell | null)[][]): (ScrabbleCell | null)[][] {
  return board.map((row) => row.map((cell) => cell ? { ...cell, tile: { ...cell.tile } } : null))
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = next[i]
    next[i] = next[j]
    next[j] = temp
  }
  return next
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set((ids || []).map(String).filter(Boolean))]
}

function key(row: number, col: number): string {
  return `${row},${col}`
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}
