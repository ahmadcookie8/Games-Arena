import { Response, NextFunction } from 'express'
import { AuthRequest } from '../middleware/auth'
import { gameService } from '../services/gameService'
import { createGameSchema, createSinglePlayerGameSchema, gameSettingsSchema, joinGameSchema, mazeChaseStateCheckpointSchema, singlePlayerMoveSchema, singlePlayerSettingsSchema, snakeStateCheckpointSchema } from '../utils/validators'
import { NotFoundError } from '../utils/errors'
import { presentGameForUser } from '../utils/gamePresenter'

export async function createGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameType, opponentUserId } = createGameSchema.parse(req.body)
    const game = await gameService.createGame(req.user!.userId, req.user!.username, gameType, { opponentUserId })
    res.status(201).json({ gameId: game._id, gameCode: game.gameCode, players: game.players })
  } catch (err) {
    next(err)
  }
}

export async function createSinglePlayerGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = createSinglePlayerGameSchema.parse(req.body)
    const game = await gameService.createSinglePlayerGame(req.user!.userId, req.user!.username, payload)
    res.status(201).json({ gameId: game._id, game, gameState: game.gameState, moveHistory: game.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function getGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await gameService.getGame(req.params.gameId)
    if (!game) throw new NotFoundError('Game')
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function listGames(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const mode = req.query.mode === 'singlePlayer' ? 'singlePlayer' : 'multiplayer'
    const games = await gameService.listGamesForUser(req.user!.userId, mode)
    res.json({
      active: games.active.map((game) => presentGameForUser(game, req.user!.userId)),
      waiting: games.waiting.map((game) => presentGameForUser(game, req.user!.userId)),
      completed: games.completed.map((game) => presentGameForUser(game, req.user!.userId)),
    })
  } catch (err) {
    next(err)
  }
}

export async function joinGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameCode } = joinGameSchema.parse(req.body)
    const game = await gameService.joinGame(gameCode, req.user!.userId, req.user!.username)
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState })
  } catch (err) {
    next(err)
  }
}

export async function makeSinglePlayerMove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { move } = singlePlayerMoveSchema.parse(req.body)
    const game = await gameService.makeSinglePlayerTicTacToeMove(req.params.gameId, req.user!.userId, move)
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function saveSinglePlayerSnakeState(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameState, completed } = snakeStateCheckpointSchema.parse(req.body)
    const game = await gameService.saveSinglePlayerSnakeState(req.params.gameId, req.user!.userId, gameState, completed)
    res.json({ game, gameState: game.gameState, moveHistory: game.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function saveSinglePlayerMazeChaseState(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameState, completed } = mazeChaseStateCheckpointSchema.parse(req.body)
    const game = await gameService.saveSinglePlayerMazeChaseState(req.params.gameId, req.user!.userId, gameState, completed)
    res.json({ game, gameState: game.gameState, moveHistory: game.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function updateSinglePlayerSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = singlePlayerSettingsSchema.parse(req.body)
    const game = await gameService.updateSinglePlayerSettings(req.params.gameId, req.user!.userId, settings)
    res.json({ game, gameState: game.gameState, moveHistory: game.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function updateGameSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = gameSettingsSchema.parse(req.body)
    const game = await gameService.updateGameSettings(req.params.gameId, req.user!.userId, settings)
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
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
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function replayGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await gameService.replayGame(req.params.gameId, req.user!.userId)
    const presented = presentGameForUser(game, req.user!.userId)
    res.status(201).json({ gameId: game._id, game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function resumeGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await gameService.resumeGame(req.params.gameId)
    if (!game) throw new NotFoundError('Game')
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
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
