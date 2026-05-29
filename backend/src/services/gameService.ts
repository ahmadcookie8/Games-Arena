import { Game, IGameDocument } from '../models/Game'
import { GameSnapshot } from '../models/GameSnapshot'
import mongoose from 'mongoose'
import { redisGet, redisSet, redisDel } from '../utils/redis'
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors'
import { GameMode, GameType, SnakeBoardSize, TicTacToeDifficulty } from '../types/game'
import { TicTacToe } from '../games/TicTacToe'
import { Chess } from '../games/Chess'
import { Checkers } from '../games/Checkers'
import { Uno } from '../games/Uno'
import { President } from '../games/President'
import { Wisecracker, WisecrackerAction, WisecrackerState } from '../games/Wisecracker'
import { emitGameOver, emitGameUpdated, emitGamesChanged, emitMoveMade } from './socketNotifier'
import { userService } from './userService'

function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function getInitialState(gameType: GameType, hostUserId: string): unknown {
  switch (gameType) {
    case 'ticTacToe': return TicTacToe.createInitialState()
    case 'chess': return Chess.createInitialState()
    case 'checkers': return Checkers.createInitialState()
    case 'uno': return Uno.createInitialState(2)
    case 'president': return President.createInitialState(5)
    case 'wisecracker': return Wisecracker.createInitialState(hostUserId)
    case 'snake': return createInitialSnakeState('medium')
  }
}

const SNAPSHOT_INTERVAL = 10
const COMPUTER_USER_ID = new mongoose.Types.ObjectId('000000000000000000000000')

interface TicTacToeState {
  board: (string | null)[]
  currentSymbol: 'X' | 'O'
}

interface SnakeCell {
  x: number
  y: number
}

interface SnakeState {
  width: number
  height: number
  snake: SnakeCell[]
  direction: 'up' | 'down' | 'left' | 'right'
  pendingDirection: 'up' | 'down' | 'left' | 'right'
  food: SnakeCell
  score: number
  isGameOver: boolean
  hasStarted?: boolean
  tickMs: number
}

const SNAKE_BOARD_DIMENSIONS: Record<SnakeBoardSize, number> = {
  small: 12,
  medium: 18,
  large: 24,
}

function getGameMode(game: IGameDocument): GameMode {
  return game.metadata?.mode || 'multiplayer'
}

function getComputerName(difficulty: TicTacToeDifficulty): string {
  return `Computer (${difficulty[0].toUpperCase()}${difficulty.slice(1)})`
}

function getAvailableTicTacToeMoves(state: TicTacToeState): string[] {
  return state.board
    .map((cell, index) => (cell === null ? String(index) : null))
    .filter((move): move is string => move !== null)
}

function chooseRandomMove(moves: string[]): string {
  return moves[Math.floor(Math.random() * moves.length)]
}

function findImmediateTicTacToeMove(state: TicTacToeState, symbol: 'X' | 'O'): string | null {
  const ticTacToe = new TicTacToe([])

  for (const move of getAvailableTicTacToeMoves(state)) {
    const candidate = ticTacToe.applyMove({ ...state, board: [...state.board], currentSymbol: symbol }, move)
    const result = ticTacToe.isGameOver(candidate)
    if (result.isGameOver && !result.isDraw) {
      return move
    }
  }

  return null
}

function scoreTicTacToeState(state: TicTacToeState, depth: number): number {
  const result = new TicTacToe([]).isGameOver(state)
  if (!result.isGameOver || result.isDraw) return 0
  return result.winner === 1 ? 10 - depth : depth - 10
}

function minimaxTicTacToe(state: TicTacToeState, depth: number, isMaximizing: boolean): number {
  const result = new TicTacToe([]).isGameOver(state)
  if (result.isGameOver) {
    return scoreTicTacToeState(state, depth)
  }

  const ticTacToe = new TicTacToe([])
  const moves = getAvailableTicTacToeMoves(state)

  if (isMaximizing) {
    let bestScore = -Infinity
    for (const move of moves) {
      const nextState = ticTacToe.applyMove({ ...state, board: [...state.board], currentSymbol: 'O' }, move)
      bestScore = Math.max(bestScore, minimaxTicTacToe(nextState, depth + 1, false))
    }
    return bestScore
  }

  let bestScore = Infinity
  for (const move of moves) {
    const nextState = ticTacToe.applyMove({ ...state, board: [...state.board], currentSymbol: 'X' }, move)
    bestScore = Math.min(bestScore, minimaxTicTacToe(nextState, depth + 1, true))
  }
  return bestScore
}

function chooseHardTicTacToeMove(state: TicTacToeState): string {
  const moves = getAvailableTicTacToeMoves(state)
  const ticTacToe = new TicTacToe([])
  let bestMove = moves[0]
  let bestScore = -Infinity

  for (const move of moves) {
    const nextState = ticTacToe.applyMove({ ...state, board: [...state.board], currentSymbol: 'O' }, move)
    const score = minimaxTicTacToe(nextState, 0, false)
    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove
}

function chooseComputerTicTacToeMove(state: TicTacToeState, difficulty: TicTacToeDifficulty): string {
  const moves = getAvailableTicTacToeMoves(state)
  if (moves.length === 0) throw new BadRequestError('No moves available')

  if (difficulty === 'easy') return chooseRandomMove(moves)

  if (difficulty === 'medium') {
    return findImmediateTicTacToeMove(state, 'O')
      || findImmediateTicTacToeMove(state, 'X')
      || chooseRandomMove(moves)
  }

  return chooseHardTicTacToeMove(state)
}

function createInitialSnakeState(boardSize: SnakeBoardSize): SnakeState {
  const size = SNAKE_BOARD_DIMENSIONS[boardSize]
  const center = Math.floor(size / 2)
  return {
    width: size,
    height: size,
    snake: [
      { x: center, y: center },
      { x: center - 1, y: center },
      { x: center - 2, y: center },
    ],
    direction: 'right',
    pendingDirection: 'right',
    food: { x: Math.min(center + 3, size - 1), y: center },
    score: 3,
    isGameOver: false,
    hasStarted: false,
    tickMs: 120,
  }
}

function validateSnakeStateForGame(game: IGameDocument, state: SnakeState): void {
  const boardSize = game.metadata.boardSize
  if (!boardSize) throw new BadRequestError('Missing Snake board size')

  const expectedSize = SNAKE_BOARD_DIMENSIONS[boardSize]
  if (state.width !== expectedSize || state.height !== expectedSize) {
    throw new BadRequestError('Invalid Snake board dimensions')
  }
  if (state.score !== state.snake.length) {
    throw new BadRequestError('Snake score must match snake length')
  }

  const allCells = [...state.snake, state.food]
  for (const cell of allCells) {
    if (cell.x < 0 || cell.x >= state.width || cell.y < 0 || cell.y >= state.height) {
      throw new BadRequestError('Snake state contains an out-of-bounds cell')
    }
  }
}

class GameService {
  async createGame(userId: string, username: string, gameType: GameType, _opponentUserId?: string): Promise<IGameDocument> {
    const gameCode = generateGameCode()
    const initialState = getInitialState(gameType, userId)

    const game = await Game.create({
      gameType,
      gameCode,
      players: [{ userId, username, index: 0 }],
      currentTurnIndex: 0,
      currentTurn: userId,
      gameState: initialState,
      moveHistory: [],
      lastMoveAt: new Date(),
      metadata: { ratedGame: false, mode: 'multiplayer' },
    })

    await redisSet(`game:${gameType}:${game._id}`, {
      gameId: game._id,
      gameType,
      players: game.players,
      currentTurnIndex: 0,
      gameState: initialState,
      status: 'active',
      metadata: game.metadata,
    })

    emitGamesChanged(game)

    return game
  }

  async createSinglePlayerGame(
    userId: string,
    username: string,
    options: { gameType: 'ticTacToe'; difficulty?: TicTacToeDifficulty } | { gameType: 'snake'; boardSize?: SnakeBoardSize; wallLooping?: boolean }
  ): Promise<IGameDocument> {
    const gameCode = generateGameCode()
    const ticTacToeDifficulty = options.gameType === 'ticTacToe' ? options.difficulty || 'easy' : 'easy'
    const snakeBoardSize = options.gameType === 'snake' ? options.boardSize || 'medium' : 'medium'
    const snakeWallLooping = options.gameType === 'snake' ? Boolean(options.wallLooping) : false
    const initialState = options.gameType === 'ticTacToe'
      ? TicTacToe.createInitialState()
      : createInitialSnakeState(snakeBoardSize)
    const metadata = options.gameType === 'ticTacToe'
      ? { ratedGame: false, mode: 'singlePlayer' as const, difficulty: ticTacToeDifficulty }
      : { ratedGame: false, mode: 'singlePlayer' as const, boardSize: snakeBoardSize, wallLooping: snakeWallLooping }

    const game = await Game.create({
      gameType: options.gameType,
      gameCode,
      players: [{ userId, username, index: 0 }],
      currentTurnIndex: 0,
      currentTurn: userId,
      gameState: initialState,
      moveHistory: [],
      startedAt: new Date(),
      lastMoveAt: new Date(),
      metadata,
    })

    await redisSet(`game:${options.gameType}:${game._id}`, {
      gameId: game._id,
      gameType: options.gameType,
      players: game.players,
      currentTurnIndex: 0,
      gameState: initialState,
      status: 'active',
      metadata: game.metadata,
    })

    emitGamesChanged(game)

    return game
  }

  async updateSinglePlayerSettings(
    gameId: string,
    userId: string,
    settings: { difficulty: TicTacToeDifficulty } | { boardSize: SnakeBoardSize; wallLooping: boolean }
  ): Promise<IGameDocument> {
    const game = await Game.findById(gameId)
    if (!game) throw new NotFoundError('Game')
    if (getGameMode(game) !== 'singlePlayer') throw new BadRequestError('This is not a single player game')
    if (game.status !== 'active') throw new BadRequestError('Game is not active')

    const isParticipant = game.players.some((player) => player.userId.toString() === userId)
    if (!isParticipant) throw new ForbiddenError('Only players in this game can change settings')

    if (game.gameType === 'ticTacToe') {
      if (!('difficulty' in settings)) throw new BadRequestError('Invalid Tic Tac Toe settings')
      if (game.moveHistory.length > 0) throw new BadRequestError('Settings are locked after play starts')
      game.metadata.difficulty = settings.difficulty
    } else if (game.gameType === 'snake') {
      if (!('boardSize' in settings)) throw new BadRequestError('Invalid Snake settings')
      const state = game.gameState as unknown as SnakeState
      if (state.hasStarted || game.moveHistory.length > 0) {
        throw new BadRequestError('Settings are locked after play starts')
      }
      game.metadata.boardSize = settings.boardSize
      game.metadata.wallLooping = settings.wallLooping
      game.gameState = createInitialSnakeState(settings.boardSize) as unknown as Record<string, unknown>
    } else {
      throw new BadRequestError('Settings are not available for this game')
    }

    game.lastMoveAt = new Date()
    await game.save()
    await this.cacheGame(game)
    emitGameUpdated(game)
    emitGamesChanged(game)
    return game
  }

  async getGame(gameId: string): Promise<IGameDocument | null> {
    return Game.findById(gameId)
  }

  async listGamesForUser(userId: string, mode: GameMode = 'multiplayer'): Promise<{ active: IGameDocument[]; waiting: IGameDocument[]; completed: IGameDocument[] }> {
    const modeFilter = mode === 'singlePlayer'
      ? { 'metadata.mode': 'singlePlayer' }
      : { $or: [{ 'metadata.mode': 'multiplayer' }, { 'metadata.mode': { $exists: false } }] }
    const games = await Game.find({ 'players.userId': userId, ...modeFilter }).sort({ lastMoveAt: -1 }).limit(50)
    return {
      active: games.filter((g) => g.status === 'active'),
      waiting: mode === 'singlePlayer' ? [] : games.filter((g) => g.status === 'active' && g.players.length < 2),
      completed: games.filter((g) => g.status === 'completed'),
    }
  }

  async joinGame(gameCode: string, userId: string, username: string): Promise<IGameDocument> {
    const game = await Game.findOne({ gameCode })
    if (!game) throw new NotFoundError('Game')
    if (game.players.some((p) => p.userId.toString() === userId)) throw new BadRequestError('Already in this game')
    if (game.gameType !== 'wisecracker' && game.players.length >= 2) throw new BadRequestError('Game is full')
    if (game.status !== 'active') throw new BadRequestError('Game is not active')

    game.players.push({
      userId: new mongoose.Types.ObjectId(userId),
      username,
      index: game.players.length,
    })
    game.startedAt = new Date()
    game.players.forEach((player, index) => {
      player.index = index
    })
    if (game.gameType === 'wisecracker') {
      game.gameState = Wisecracker.addPlayer(game.gameState as unknown as WisecrackerState, userId) as unknown as Record<string, unknown>
    }
    await game.save()

    await this.cacheGame(game)
    emitGameUpdated(game)
    emitGamesChanged(game)

    return game
  }

  async makeMove(gameId: string, userId: string, move: unknown): Promise<IGameDocument> {
    const game = await Game.findById(gameId)
    if (!game) throw new NotFoundError('Game')

    if (game.gameType === 'ticTacToe') {
      if (typeof move !== 'string') throw new BadRequestError('Invalid Tic Tac Toe move')
      return this.makeTicTacToeMoveOnGame(game, userId, move)
    }

    if (game.gameType === 'wisecracker') {
      return this.makeWisecrackerMoveOnGame(game, userId, move)
    }

    throw new BadRequestError('Only Tic Tac Toe and Wisecracker are available right now')
  }

  async setPlayerConnection(gameId: string, userId: string, isConnected: boolean): Promise<IGameDocument | null> {
    const game = await Game.findById(gameId)
    if (!game) return null

    const player = game.players.find((p) => p.userId.toString() === userId)
    if (!player) return game

    player.isConnected = isConnected
    if (isConnected) {
      player.connectedAt = new Date()
    } else {
      player.disconnectCount = (player.disconnectCount || 0) + 1
    }

    await game.save()
    await this.cacheGame(game)
    emitGameUpdated(game)
    emitGamesChanged(game)

    return game
  }

  async makeTicTacToeMove(gameId: string, userId: string, move: string): Promise<IGameDocument> {
    const game = await Game.findById(gameId)
    if (!game) throw new NotFoundError('Game')
    return this.makeTicTacToeMoveOnGame(game, userId, move)
  }

  private async makeTicTacToeMoveOnGame(game: IGameDocument, userId: string, move: string): Promise<IGameDocument> {
    if (game.gameType !== 'ticTacToe') throw new BadRequestError('Only Tic Tac Toe is available right now')
    if (getGameMode(game) === 'singlePlayer') throw new BadRequestError('Use the single player move endpoint for solo games')
    if (game.status !== 'active') throw new BadRequestError('Game is not active')
    if (game.players.length !== 2) throw new BadRequestError('Waiting for another player')

    const playerIndex = game.players.findIndex((p) => p.userId.toString() === userId)
    if (playerIndex === -1) throw new BadRequestError('You are not in this game')
    if (playerIndex !== game.currentTurnIndex) throw new BadRequestError('It is not your turn')

    const ticTacToe = new TicTacToe([])
    const validation = ticTacToe.validateMove(game.gameState, move)
    if (!validation.isValid) throw new BadRequestError(validation.reason || 'Invalid move')

    const nextState = ticTacToe.applyMove(game.gameState, move) as unknown as Record<string, unknown>
    const gameOver = ticTacToe.isGameOver(nextState)
    const currentPlayer = game.players[playerIndex]

    game.gameState = nextState
    game.moveHistory.push({
      moveNumber: game.moveHistory.length + 1,
      playerId: currentPlayer.userId,
      playerName: currentPlayer.username,
      move,
      timestamp: new Date(),
    })
    game.lastMoveAt = new Date()

    if (gameOver.isGameOver) {
      game.status = 'completed'
      game.completedAt = new Date()
      if (gameOver.isDraw) {
        game.result = { isDraw: true, winType: 'draw' }
      } else {
        const winner = game.players[gameOver.winner ?? playerIndex]
        const loser = game.players.find((p) => p.userId.toString() !== winner.userId.toString())
        game.result = {
          winner: winner.userId,
          winnerName: winner.username,
          loser: loser?.userId,
          loserName: loser?.username,
          isDraw: false,
          winType: 'three_in_a_row',
        }
      }
    } else {
      game.currentTurnIndex = (game.currentTurnIndex + 1) % game.players.length
      game.currentTurn = game.players[game.currentTurnIndex].userId
    }

    await game.save()
    await this.cacheGame(game)

    if (game.status === 'completed') {
      await this.updateStatsForCompletedGame(game)
    }

    emitMoveMade(game, move)
    emitGameUpdated(game)
    emitGamesChanged(game)

    if (gameOver.isGameOver) {
      emitGameOver(game)
    }

    return game
  }

  async makeSinglePlayerTicTacToeMove(gameId: string, userId: string, move: string): Promise<IGameDocument> {
    const game = await Game.findById(gameId)
    if (!game) throw new NotFoundError('Game')
    if (game.gameType !== 'ticTacToe') throw new BadRequestError('Only Tic Tac Toe is available right now')
    if (getGameMode(game) !== 'singlePlayer') throw new BadRequestError('This is not a single player game')
    if (game.status !== 'active') throw new BadRequestError('Game is not active')

    const player = game.players.find((p) => p.userId.toString() === userId)
    if (!player) throw new BadRequestError('You are not in this game')

    const ticTacToe = new TicTacToe([])
    const validation = ticTacToe.validateMove(game.gameState, move)
    if (!validation.isValid) throw new BadRequestError(validation.reason || 'Invalid move')

    const difficulty = game.metadata.difficulty || 'easy'
    const humanState = ticTacToe.applyMove(game.gameState, move) as unknown as TicTacToeState
    game.gameState = humanState as unknown as Record<string, unknown>
    game.moveHistory.push({
      moveNumber: game.moveHistory.length + 1,
      playerId: player.userId,
      playerName: player.username,
      move,
      timestamp: new Date(),
    })

    let gameOver = ticTacToe.isGameOver(humanState)
    if (gameOver.isGameOver) {
      this.completeSinglePlayerTicTacToe(game, gameOver)
    } else {
      const computerMove = chooseComputerTicTacToeMove(humanState, difficulty)
      const computerState = ticTacToe.applyMove(humanState, computerMove) as unknown as TicTacToeState
      game.gameState = computerState as unknown as Record<string, unknown>
      game.moveHistory.push({
        moveNumber: game.moveHistory.length + 1,
        playerId: COMPUTER_USER_ID,
        playerName: getComputerName(difficulty),
        move: computerMove,
        timestamp: new Date(),
      })

      gameOver = ticTacToe.isGameOver(computerState)
      if (gameOver.isGameOver) {
        this.completeSinglePlayerTicTacToe(game, gameOver)
      } else {
        game.currentTurnIndex = 0
        game.currentTurn = player.userId
      }
    }

    game.lastMoveAt = new Date()
    await game.save()
    await this.cacheGame(game)

    if (gameOver.isGameOver) {
      await userService.invalidateLeaderboardCache(game.gameType)
    }

    emitMoveMade(game, move)
    emitGameUpdated(game)
    emitGamesChanged(game)

    if (gameOver.isGameOver) {
      emitGameOver(game)
    }

    return game
  }

  private completeSinglePlayerTicTacToe(game: IGameDocument, gameOver: { isDraw?: boolean; winner?: number }): void {
    const player = game.players[0]
    const difficulty = game.metadata.difficulty || 'easy'
    game.status = 'completed'
    game.completedAt = new Date()

    if (gameOver.isDraw) {
      game.result = { isDraw: true, winType: 'draw' }
      return
    }

    if (gameOver.winner === 0) {
      game.result = {
        winner: player.userId,
        winnerName: player.username,
        isDraw: false,
        winType: 'three_in_a_row',
      }
      return
    }

    game.result = {
      winnerName: getComputerName(difficulty),
      loser: player.userId,
      loserName: player.username,
      isDraw: false,
      winType: 'three_in_a_row',
    }
  }

  async saveSinglePlayerSnakeState(gameId: string, userId: string, state: SnakeState, completed = false): Promise<IGameDocument> {
    const game = await Game.findById(gameId)
    if (!game) throw new NotFoundError('Game')
    if (game.gameType !== 'snake') throw new BadRequestError('Only Snake state can be saved here')
    if (getGameMode(game) !== 'singlePlayer') throw new BadRequestError('This is not a single player game')
    if (game.status !== 'active') throw new BadRequestError('Game is not active')

    const player = game.players.find((p) => p.userId.toString() === userId)
    if (!player) throw new BadRequestError('You are not in this game')

    validateSnakeStateForGame(game, state)

    game.gameState = state as unknown as Record<string, unknown>
    game.lastMoveAt = new Date()

    if (completed || state.isGameOver) {
      game.status = 'completed'
      game.completedAt = new Date()
      game.result = {
        winner: player.userId,
        winnerName: player.username,
        isDraw: false,
        winType: `score:${state.snake.length}`,
      }
      game.moveHistory.push({
        moveNumber: game.moveHistory.length + 1,
        playerId: player.userId,
        playerName: player.username,
        move: `Score ${state.snake.length}`,
        timestamp: new Date(),
      })
    }

    await game.save()
    await this.cacheGame(game)

    if (game.status === 'completed') {
      await userService.invalidateLeaderboardCache(game.gameType)
      emitGameOver(game)
    }

    emitGameUpdated(game)
    emitGamesChanged(game)

    return game
  }

  private async makeWisecrackerMoveOnGame(game: IGameDocument, userId: string, move: unknown): Promise<IGameDocument> {
    const action = parseWisecrackerAction(move)
    if (game.status !== 'active' && !(game.status === 'completed' && action.type === 'returnToLobby')) {
      throw new BadRequestError('Game is not active')
    }
    const playerIndex = game.players.findIndex((p) => p.userId.toString() === userId)
    if (playerIndex === -1) throw new BadRequestError('You are not in this game')

    const players = game.players.map((player) => ({
      userId: player.userId.toString(),
      username: player.username,
    }))
    const nextState = Wisecracker.applyAction(game.gameState as unknown as WisecrackerState, action, userId, players)
    const player = game.players[playerIndex]

    game.gameState = nextState as unknown as Record<string, unknown>
    game.currentTurn = nextState.chooserUserId ? new mongoose.Types.ObjectId(nextState.chooserUserId) : player.userId
    game.currentTurnIndex = nextState.chooserUserId
      ? Math.max(game.players.findIndex((p) => p.userId.toString() === nextState.chooserUserId), 0)
      : 0
    game.moveHistory.push({
      moveNumber: game.moveHistory.length + 1,
      playerId: player.userId,
      playerName: player.username,
      move: Wisecracker.getMoveDescription(action),
      timestamp: new Date(),
    })
    game.lastMoveAt = new Date()

    if (nextState.phase === 'completed' && nextState.matchWinnerUserId) {
      const winner = game.players.find((p) => p.userId.toString() === nextState.matchWinnerUserId)
      game.status = 'completed'
      game.completedAt = new Date()
      game.result = {
        winner: winner?.userId,
        winnerName: winner?.username,
        isDraw: false,
        winType: 'score_limit',
      }
    } else if (action.type === 'returnToLobby') {
      game.status = 'active'
      game.completedAt = undefined
      game.result = undefined
    }

    await game.save()
    await this.cacheGame(game)

    if (game.status === 'completed') {
      await this.updateStatsForCompletedGame(game)
    }

    emitMoveMade(game, Wisecracker.getMoveDescription(action))
    emitGameUpdated(game)
    emitGamesChanged(game)

    if (game.status === 'completed') {
      emitGameOver(game)
    }

    return game
  }

  async resignGame(gameId: string, userId: string): Promise<{ winner: string; reason: string }> {
    const game = await Game.findById(gameId)
    if (!game) throw new NotFoundError('Game')

    const opponent = game.players.find((p) => p.userId.toString() !== userId)
    if (!opponent) throw new BadRequestError('No opponent found')

    game.status = 'completed'
    game.completedAt = new Date()
    game.result = {
      winner: opponent.userId,
      winnerName: opponent.username,
      isDraw: false,
      winType: 'resignation',
    }
    await game.save()
    await redisDel(`game:${game.gameType}:${gameId}`)
    await userService.updateStatsAfterGame({
      winnerId: opponent.userId.toString(),
      loserIds: [userId],
    })
    await userService.invalidateLeaderboardCache(game.gameType)
    emitGameUpdated(game)
    emitGamesChanged(game)

    return { winner: opponent.username, reason: 'resignation' }
  }

  async closeGame(gameId: string, userId: string): Promise<IGameDocument> {
    const game = await Game.findById(gameId)
    if (!game) throw new NotFoundError('Game')

    const isParticipant = game.players.some((player) => player.userId.toString() === userId)
    if (!isParticipant) throw new ForbiddenError('Only players in this game can close it')
    if (game.status !== 'active') throw new BadRequestError('Only active games can be closed')

    game.status = 'abandoned'
    game.completedAt = new Date()
    game.lastMoveAt = new Date()
    game.result = undefined

    await game.save()
    await redisDel(`game:${game.gameType}:${gameId}`)

    emitGameUpdated(game)
    emitGamesChanged(game)

    return game
  }

  async resumeGame(gameId: string): Promise<IGameDocument | null> {
    const game = await Game.findById(gameId)
    if (!game) return null
    if (game.status === 'abandoned') return game

    const cached = await redisGet(`game:${game.gameType}:${gameId}`)
    if (cached) return game

    // Reload from latest snapshot + replay remaining moves
    const snapshot = await GameSnapshot.findOne({ gameId }).sort({ snapshotNumber: -1 })
    if (snapshot) {
      game.gameState = snapshot.gameState
    }

    if (game.status !== 'completed') {
      game.status = 'active'
    }
    await game.save()

    await redisSet(`game:${game.gameType}:${gameId}`, {
      gameId: game._id,
      gameType: game.gameType,
      players: game.players,
      currentTurnIndex: game.currentTurnIndex,
      gameState: game.gameState,
      status: 'active',
      metadata: game.metadata,
    })

    return game
  }

  private async cacheGame(game: IGameDocument): Promise<void> {
    await redisSet(`game:${game.gameType}:${game._id}`, {
      gameId: game._id,
      gameType: game.gameType,
      players: game.players,
      currentTurnIndex: game.currentTurnIndex,
      gameState: game.gameState,
      status: game.status,
      metadata: game.metadata,
    })
  }

  async getMoveHistory(gameId: string, page: number, limit: number): Promise<{ moves: unknown[]; total: number }> {
    const game = await Game.findById(gameId).select('moveHistory')
    if (!game) throw new NotFoundError('Game')

    const total = game.moveHistory.length
    const moves = game.moveHistory.slice((page - 1) * limit, page * limit)
    return { moves, total }
  }

  async saveSnapshot(gameId: string, gameState: unknown, moveNumber: number): Promise<void> {
    const count = await GameSnapshot.countDocuments({ gameId })
    await GameSnapshot.create({ gameId, snapshotNumber: count + 1, gameState, moveNumber })
  }

  shouldSnapshot(moveCount: number): boolean {
    return moveCount % SNAPSHOT_INTERVAL === 0
  }

  private async updateStatsForCompletedGame(game: IGameDocument): Promise<void> {
    if (getGameMode(game) === 'singlePlayer') {
      return
    }

    if (!game.result) {
      return
    }

    if (game.result.isDraw) {
      await userService.updateStatsAfterGame({
        drawPlayerIds: game.players.map((player) => player.userId.toString()),
      })
    } else if (game.result.winner) {
      const winnerId = game.result.winner.toString()
      await userService.updateStatsAfterGame({
        winnerId,
        loserIds: game.players
          .map((player) => player.userId.toString())
          .filter((playerId) => playerId !== winnerId),
      })
    }

    await userService.invalidateLeaderboardCache(game.gameType)
  }
}

export const gameService = new GameService()

function parseWisecrackerAction(move: unknown): WisecrackerAction {
  if (!move || typeof move !== 'object') throw new BadRequestError('Invalid Wisecracker action')
  const action = move as Record<string, unknown>

  switch (action.type) {
    case 'startMatch':
      return { type: 'startMatch', maxScore: typeof action.maxScore === 'number' ? action.maxScore : Number(action.maxScore) }
    case 'refreshPrompt':
      return { type: 'refreshPrompt' }
    case 'setPrompt':
      return { type: 'setPrompt', prompt: String(action.prompt || '') }
    case 'submitAnswers':
      return { type: 'submitAnswers', answers: Array.isArray(action.answers) ? action.answers.map(String) : [] }
    case 'revealNextAnswer':
      return { type: 'revealNextAnswer' }
    case 'selectRoundWinner':
      return { type: 'selectRoundWinner', userId: String(action.userId || '') }
    case 'startNextRound':
      return { type: 'startNextRound' }
    case 'returnToLobby':
      return { type: 'returnToLobby' }
    default:
      throw new BadRequestError('Unknown Wisecracker action')
  }
}
