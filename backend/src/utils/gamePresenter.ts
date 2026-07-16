import { IGameDocument } from '../models/Game'

type PlainObject = Record<string, unknown>

const GAME_FIELDS = [
  '_id', 'gameType', 'status', 'gameCode', 'players', 'currentTurnIndex', 'currentTurn',
  'gameState', 'moveHistory', 'chatMessages', 'createdAt', 'startedAt', 'lastMoveAt',
  'completedAt', 'inviteExpiresAt', 'replay', 'result', 'metadata',
] as const
const PLAYER_FIELDS = ['userId', 'username', 'index', 'color', 'isConnected'] as const
const MOVE_FIELDS = ['moveNumber', 'playerId', 'playerName', 'move', 'timestamp'] as const
const CHAT_FIELDS = ['messageId', 'userId', 'username', 'text', 'timestamp'] as const
const RESULT_FIELDS = ['winner', 'winnerName', 'isDraw', 'winType', 'verification'] as const
const METADATA_FIELDS = [
  'ratedGame', 'mode', 'difficulty', 'boardSize', 'wallLooping', 'infiniteLetters', 'tournament',
] as const
const REPLAY_FIELDS = ['version', 'seed', 'startedAt'] as const
const SCRABBLE_TRADE_FIELDS = ['offerId', 'fromUserId', 'targetUserId', 'offeredTileCount', 'offeredTiles'] as const
const SCRABBLE_TILE_FIELDS = ['id', 'letter', 'value', 'isBlank'] as const
const GAME_STATE_FIELDS: Record<string, readonly string[]> = {
  ticTacToe: ['board', 'currentSymbol'],
  chess: ['board', 'enPassantTarget', 'castlingRights'],
  checkers: ['board', 'mustJump'],
  wisecracker: [
    'phase', 'hostUserId', 'maxScore', 'chooserUserId', 'chooserIndex', 'activePlayerIds',
    'waitingPlayerIds', 'prompt', 'answerSlots', 'revealedCount', 'scores', 'matchWinnerUserId',
    'submissionStatus', 'myAnswers', 'revealedResponses', 'roundWinnerResponseId',
  ],
  scrabble: [
    'board', 'racks', 'rackCounts', 'scores', 'bagCount', 'infiniteLetters',
    'usedPremiumSquares', 'pendingTrade', 'consecutivePasses', 'givenUpUserIds', 'lastScoreEvent',
  ],
  propertyManagement: [
    'phase', 'hostUserId', 'currentPlayerUserId', 'turnPhase', 'dice', 'doublesCount',
    'playerOrder', 'playerStates', 'properties', 'chanceCardIndex', 'communityChestCardIndex',
    'chanceFreeCardReturned', 'communityChestFreeCardReturned', 'pendingAction',
    'lastEventMessage', 'bankruptPlayerIds', 'winnerId',
  ],
  uno: ['discardPile', 'currentTurnIndex', 'direction', 'currentColor', 'unoStatus', 'hand', 'handCounts', 'deckCount'],
  president: ['currentTrick', 'rankings', 'hand', 'handCounts', 'deckCount'],
  snake: ['width', 'height', 'snake', 'direction', 'pendingDirection', 'food', 'score', 'isGameOver', 'hasStarted', 'tickMs', 'tick'],
  mazeChase: [
    'width', 'height', 'maze', 'player', 'ghosts', 'pellets', 'powerPellets', 'fruit',
    'score', 'lives', 'level', 'frightenedUntil', 'isGameOver', 'hasStarted', 'tickMs',
    'ghostStepCounter', 'tick', 'elapsedMs',
  ],
}
const MAX_PRESENTED_MOVES = 100

/**
 * Builds the only game representation that may cross a user-facing boundary.
 * Mongo documents and authoritative game state must never be emitted directly.
 */
export function presentGameForUser(game: IGameDocument | PlainObject, userId: string): PlainObject {
  const source = toPlainObject(game)
  const plain = pickFields(source, GAME_FIELDS)
  sanitizeTopLevelCollections(plain)
  const gameState = isPlainObject(plain.gameState) ? plain.gameState : null
  if (!gameState) {
    if (Object.prototype.hasOwnProperty.call(plain, 'gameState')) plain.gameState = {}
    return plain
  }

  switch (plain.gameType) {
    case 'wisecracker':
      presentWisecrackerState(gameState, userId)
      break
    case 'scrabble':
      presentScrabbleState(gameState, userId)
      break
    case 'propertyManagement':
      delete gameState.chanceCardOrder
      delete gameState.communityChestCardOrder
      break
    case 'uno':
      presentUnoState(plain, gameState, userId)
      break
    case 'president':
      presentPresidentState(plain, gameState, userId)
      break
  }

  plain.gameState = pickFields(gameState, GAME_STATE_FIELDS[String(plain.gameType)] || [])

  return plain
}

function sanitizeTopLevelCollections(game: PlainObject): void {
  if (Array.isArray(game.players)) {
    game.players = game.players.filter(isPlainObject).map((player) => pickFields(player, PLAYER_FIELDS))
  }
  if (Array.isArray(game.moveHistory)) {
    game.moveHistory = presentMoveHistory(game.moveHistory.slice(-MAX_PRESENTED_MOVES))
  }
  if (Array.isArray(game.chatMessages)) {
    game.chatMessages = game.chatMessages.filter(isPlainObject).map((message) => pickFields(message, CHAT_FIELDS))
  }
  if (isPlainObject(game.result)) game.result = pickFields(game.result, RESULT_FIELDS)
  if (isPlainObject(game.metadata)) game.metadata = pickFields(game.metadata, METADATA_FIELDS)
  if (isPlainObject(game.replay)) game.replay = pickFields(game.replay, REPLAY_FIELDS)
}

export function presentMoveHistory(moves: unknown[]): PlainObject[] {
  return moves.filter(isPlainObject).map((move) => pickFields(move, MOVE_FIELDS))
}

function presentWisecrackerState(state: PlainObject, userId: string): void {
  const submittedAnswers = isPlainObject(state.submittedAnswers)
    ? state.submittedAnswers as Record<string, unknown>
    : {}
  const responseIds = isPlainObject(state.responseIds)
    ? state.responseIds as Record<string, unknown>
    : {}
  const answerOrder = stringArray(state.answerOrder)
  const revealedCount = typeof state.revealedCount === 'number'
    ? Math.max(0, Math.min(Math.floor(state.revealedCount), answerOrder.length))
    : 0
  const activePlayerIds = stringArray(state.activePlayerIds)

  state.submissionStatus = Object.fromEntries(activePlayerIds.map((playerId) => [
    playerId,
    Array.isArray(submittedAnswers[playerId]),
  ]))

  const ownRevealIndex = answerOrder.indexOf(userId)
  const ownAnswersAreStillPrivate = ownRevealIndex === -1 || ownRevealIndex >= revealedCount
  if (ownAnswersAreStillPrivate && Array.isArray(submittedAnswers[userId])) {
    state.myAnswers = submittedAnswers[userId]
  } else {
    delete state.myAnswers
  }

  state.revealedResponses = answerOrder.slice(0, revealedCount).flatMap((answerUserId) => {
    const responseId = responseIds[answerUserId]
    const answers = submittedAnswers[answerUserId]
    return typeof responseId === 'string' && Array.isArray(answers)
      ? [{ responseId, answers }]
      : []
  })

  const roundWinnerUserId = typeof state.roundWinnerUserId === 'string' ? state.roundWinnerUserId : null
  state.roundWinnerResponseId = roundWinnerUserId && typeof responseIds[roundWinnerUserId] === 'string'
    ? responseIds[roundWinnerUserId]
    : null

  delete state.roundWinnerUserId
  delete state.submittedAnswers
  delete state.responseIds
  delete state.answerOrder
}

function presentScrabbleState(state: PlainObject, userId: string): void {
  const racks = isPlainObject(state.racks) ? state.racks as Record<string, unknown> : {}
  state.rackCounts = Object.fromEntries(Object.entries(racks).map(([rackUserId, tiles]) => [
    rackUserId,
    Array.isArray(tiles) ? tiles.length : 0,
  ]))
  state.racks = {
    [userId]: Array.isArray(racks[userId])
      ? racks[userId].filter(isPlainObject).map((tile) => pickFields(tile, SCRABBLE_TILE_FIELDS))
      : [],
  }

  const bag = Array.isArray(state.bag) ? state.bag : []
  state.bagCount = bag.length
  delete state.bag

  const pendingTrade = isPlainObject(state.pendingTrade) ? state.pendingTrade : null
  if (pendingTrade) {
    const offeredTiles = Array.isArray(pendingTrade.offeredTiles) ? pendingTrade.offeredTiles : []
    pendingTrade.offeredTileCount = offeredTiles.length
    if (pendingTrade.fromUserId !== userId && pendingTrade.targetUserId !== userId) {
      delete pendingTrade.offeredTiles
    } else {
      pendingTrade.offeredTiles = offeredTiles
        .filter(isPlainObject)
        .map((tile) => pickFields(tile, SCRABBLE_TILE_FIELDS))
    }
    state.pendingTrade = pickFields(pendingTrade, SCRABBLE_TRADE_FIELDS)
  }
}

function presentUnoState(game: PlainObject, state: PlainObject, userId: string): void {
  const hands = Array.isArray(state.hands) ? state.hands : []
  const playerIndex = findPlayerIndex(game, userId)
  state.hand = playerIndex >= 0 && Array.isArray(hands[playerIndex]) ? hands[playerIndex] : []
  state.handCounts = hands.map((hand) => Array.isArray(hand) ? hand.length : 0)
  state.deckCount = Array.isArray(state.deck) ? state.deck.length : 0
  delete state.hands
  delete state.deck
}

function presentPresidentState(game: PlainObject, state: PlainObject, userId: string): void {
  const hands = Array.isArray(state.hands) ? state.hands : []
  const playerIndex = findPlayerIndex(game, userId)
  state.hand = playerIndex >= 0 && Array.isArray(hands[playerIndex]) ? hands[playerIndex] : []
  state.handCounts = hands.map((hand) => Array.isArray(hand) ? hand.length : 0)
  delete state.hands
  if (Array.isArray(state.deck)) {
    state.deckCount = state.deck.length
    delete state.deck
  }
}

function findPlayerIndex(game: PlainObject, userId: string): number {
  if (!Array.isArray(game.players)) return -1
  return game.players.findIndex((player) => {
    if (!isPlainObject(player)) return false
    return String(player.userId) === userId
  })
}

function toPlainObject(game: IGameDocument | PlainObject): PlainObject {
  const value = typeof (game as IGameDocument).toObject === 'function'
    ? (game as IGameDocument).toObject()
    : game
  return JSON.parse(JSON.stringify(value)) as PlainObject
}

function isPlainObject(value: unknown): value is PlainObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function pickFields<const TFields extends readonly string[]>(source: PlainObject, fields: TFields): PlainObject {
  const result: PlainObject = {}
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) result[field] = source[field]
  }
  return result
}
