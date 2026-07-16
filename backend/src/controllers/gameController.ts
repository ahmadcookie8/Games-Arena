import { Response, NextFunction } from 'express'
import { AuthRequest } from '../middleware/auth'
import { gameService } from '../services/gameService'
import { createGameSchema, createSinglePlayerGameSchema, gameIdSchema, gameSettingsSchema, joinGameSchema, mazeChaseStateCheckpointSchema, singlePlayerMoveSchema, singlePlayerReplaySchema, singlePlayerSettingsSchema, snakeStateCheckpointSchema } from '../utils/validators'
import { NotFoundError } from '../utils/errors'
import { presentGameForUser, presentMoveHistory } from '../utils/gamePresenter'

export async function createGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { gameType } = createGameSchema.parse(req.body)
    const game = await gameService.createGame(req.user!.userId, req.user!.username, gameType)
    res.status(201).json({ gameId: game._id, gameCode: game.gameCode })
  } catch (err) {
    next(err)
  }
}

export async function createSinglePlayerGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = createSinglePlayerGameSchema.parse(req.body)
    const game = await gameService.createSinglePlayerGame(req.user!.userId, req.user!.username, payload)
    const presented = presentGameForUser(game, req.user!.userId)
    res.status(201).json({ gameId: game._id, game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function getGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = gameIdSchema.parse(req.params.gameId)
    const game = await gameService.getGame(gameId, req.user!.userId)
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
    const gameId = gameIdSchema.parse(req.params.gameId)
    const { move } = singlePlayerMoveSchema.parse(req.body)
    const game = await gameService.makeSinglePlayerTicTacToeMove(gameId, req.user!.userId, move)
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function saveSinglePlayerSnakeState(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = gameIdSchema.parse(req.params.gameId)
    const { gameState, completed } = snakeStateCheckpointSchema.parse(req.body)
    const game = await gameService.saveSinglePlayerSnakeState(gameId, req.user!.userId, gameState, completed)
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function saveSinglePlayerMazeChaseState(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = gameIdSchema.parse(req.params.gameId)
    const { gameState, completed } = mazeChaseStateCheckpointSchema.parse(req.body)
    const game = await gameService.saveSinglePlayerMazeChaseState(gameId, req.user!.userId, gameState, completed)
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function completeSinglePlayerReplay(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = gameIdSchema.parse(req.params.gameId)
    const replay = singlePlayerReplaySchema.parse(req.body)
    const game = await gameService.completeSinglePlayerReplay(gameId, req.user!.userId, replay)
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function updateSinglePlayerSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = gameIdSchema.parse(req.params.gameId)
    const settings = singlePlayerSettingsSchema.parse(req.body)
    const game = await gameService.updateSinglePlayerSettings(gameId, req.user!.userId, settings)
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function updateGameSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = gameIdSchema.parse(req.params.gameId)
    const settings = gameSettingsSchema.parse(req.body)
    const game = await gameService.updateGameSettings(gameId, req.user!.userId, settings)
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function resignGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = gameIdSchema.parse(req.params.gameId)
    const result = await gameService.resignGame(gameId, req.user!.userId)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function closeGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = gameIdSchema.parse(req.params.gameId)
    const game = await gameService.closeGame(gameId, req.user!.userId)
    const presented = presentGameForUser(game, req.user!.userId)
    res.json({ game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function replayGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = gameIdSchema.parse(req.params.gameId)
    const game = await gameService.replayGame(gameId, req.user!.userId)
    const presented = presentGameForUser(game, req.user!.userId)
    res.status(201).json({ gameId: game._id, game: presented, gameState: presented.gameState, moveHistory: presented.moveHistory })
  } catch (err) {
    next(err)
  }
}

export async function getMoveHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameId = gameIdSchema.parse(req.params.gameId)
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50))
    const result = await gameService.getMoveHistory(gameId, req.user!.userId, page, limit)
    res.json({ ...result, moves: presentMoveHistory(result.moves) })
  } catch (err) {
    next(err)
  }
}
