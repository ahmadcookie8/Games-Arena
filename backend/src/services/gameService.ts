import { Game, IGameDocument } from '../models/Game'
import { GameSnapshot } from '../models/GameSnapshot'
import mongoose from 'mongoose'
import { redisGet, redisSet, redisDel } from '../utils/redis'
import { BadRequestError, NotFoundError } from '../utils/errors'
import { GameType } from '../types/game'
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
  }
}

const SNAPSHOT_INTERVAL = 10

class GameService {
  async createGame(userId: string, username: string, gameType: GameType, opponentUserId?: string): Promise<IGameDocument> {
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
      metadata: { ratedGame: false },
    })

    await redisSet(`game:${gameType}:${game._id}`, {
      gameId: game._id,
      gameType,
      players: game.players,
      currentTurnIndex: 0,
      gameState: initialState,
      status: 'active',
    })

    emitGamesChanged(game)

    return game
  }

  async getGame(gameId: string): Promise<IGameDocument | null> {
    return Game.findById(gameId)
  }

  async listGamesForUser(userId: string): Promise<{ active: IGameDocument[]; waiting: IGameDocument[]; completed: IGameDocument[] }> {
    const games = await Game.find({ 'players.userId': userId }).sort({ lastMoveAt: -1 }).limit(50)
    return {
      active: games.filter((g) => g.status === 'active'),
      waiting: games.filter((g) => g.status === 'active' && g.players.length < 2),
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

    if (game.status === 'completed') {
      emitGameOver(game)
    }

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

  async resumeGame(gameId: string): Promise<IGameDocument | null> {
    const game = await Game.findById(gameId)
    if (!game) return null

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
