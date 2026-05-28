import { Response, NextFunction } from 'express'
import { AuthRequest } from '../middleware/auth'
import { gameService } from '../services/gameService'
import { createGameSchema, createSinglePlayerGameSchema, joinGameSchema, singlePlayerMoveSchema } from '../utils/validators'
import { NotFoundError } from '../utils/errors'

export async function createGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameType, opponentUserId } = createGameSchema.parse(req.body)
    const game = await gameService.createGame(req.user!.userId, req.user!.username, gameType, opponentUserId)
    res.status(201).json({ gameId: game._id, gameCode: game.gameCode, players: game.players })
  } catch (err) {
    next(err)
  }
}

export async function createSinglePlayerGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameType, difficulty } = createSinglePlayerGameSchema.parse(req.body)
    const game = await gameService.createSinglePlayerGame(req.user!.userId, req.user!.username, gameType, difficulty)
    res.status(201).json({ gameId: game._id, game, gameState: game.gameState, moveHistory: game.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function getGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await gameService.getGame(req.params.gameId)
    if (!game) throw new NotFoundError('Game')
    res.json({ game, gameState: game.gameState, moveHistory: game.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function listGames(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const mode = req.query.mode === 'singlePlayer' ? 'singlePlayer' : 'multiplayer'
    const games = await gameService.listGamesForUser(req.user!.userId, mode)
    res.json(games)
  } catch (err) {
    next(err)
  }
}

export async function joinGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameCode } = joinGameSchema.parse(req.body)
    const game = await gameService.joinGame(gameCode, req.user!.userId, req.user!.username)
    res.json({ game, gameState: game.gameState })
  } catch (err) {
    next(err)
  }
}

export async function makeSinglePlayerMove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { move } = singlePlayerMoveSchema.parse(req.body)
    const game = await gameService.makeSinglePlayerTicTacToeMove(req.params.gameId, req.user!.userId, move)
    res.json({ game, gameState: game.gameState, moveHistory: game.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function resignGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await gameService.resignGame(req.params.gameId, req.user!.userId)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function closeGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await gameService.closeGame(req.params.gameId, req.user!.userId)
    res.json({ game, gameState: game.gameState, moveHistory: game.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function resumeGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await gameService.resumeGame(req.params.gameId)
    if (!game) throw new NotFoundError('Game')
    res.json({ game, gameState: game.gameState, moveHistory: game.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function getMoveHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(String(req.query.page || '1'), 10)
    const limit = parseInt(String(req.query.limit || '50'), 10)
    const result = await gameService.getMoveHistory(req.params.gameId, page, limit)
    res.json(result)
  } catch (err) {
    next(err)
  }
}
