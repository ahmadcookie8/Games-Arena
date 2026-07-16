import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { userService } from '../services/userService'
import { NotFoundError } from '../utils/errors'
import { gameIdSchema } from '../utils/validators'

const leaderboardGameTypeSchema = z.enum([
  'chess',
  'checkers',
  'ticTacToe',
  'uno',
  'president',
  'wisecracker',
  'scrabble',
  'propertyManagement',
  'snake',
  'mazeChase',
])

const singlePlayerLeaderboardGameTypeSchema = z.enum(['ticTacToe', 'snake', 'mazeChase'])

function parsePagination(query: Request['query']): { limit: number; page: number } {
  return z.object({
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('10'),
    page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(10_000)).optional().default('1'),
  }).parse({ limit: query.limit, page: query.page })
}

export async function getUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = gameIdSchema.parse(req.params.userId)
    const profile = await userService.getUserProfile(userId)
    if (!profile) throw new NotFoundError('User')
    res.json(profile)
  } catch (err) {
    next(err)
  }
}

export async function getUserStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = gameIdSchema.parse(req.params.userId)
    const stats = await userService.getUserStats(userId)
    if (!stats) throw new NotFoundError('User')
    res.json(stats)
  } catch (err) {
    next(err)
  }
}

export async function getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { limit, page } = parsePagination(req.query)
    const leaderboard = await userService.getGlobalLeaderboard(limit, page)
    res.json({ leaderboard, global: leaderboard })
  } catch (err) {
    next(err)
  }
}

export async function getLeaderboardByType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { limit, page } = parsePagination(req.query)
    const gameType = leaderboardGameTypeSchema.parse(req.params.gameType)
    const leaderboard = await userService.getLeaderboardByGameType(gameType, limit, page)
    res.json({ leaderboard, global: leaderboard })
  } catch (err) {
    next(err)
  }
}

export async function getSinglePlayerLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { limit, page } = parsePagination(req.query)
    const gameType = singlePlayerLeaderboardGameTypeSchema.parse(req.params.gameType)
    const leaderboard = await userService.getSinglePlayerLeaderboard(gameType, limit, page)
    res.json({ leaderboard })
  } catch (err) {
    next(err)
  }
}
