import { Request, Response, NextFunction } from 'express'
import { userService } from '../services/userService'
import { NotFoundError } from '../utils/errors'

export async function getUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await userService.getUserProfile(req.params.userId)
    if (!profile) throw new NotFoundError('User')
    res.json(profile)
  } catch (err) {
    next(err)
  }
}

export async function getUserStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await userService.getUserStats(req.params.userId)
    res.json(stats)
  } catch (err) {
    next(err)
  }
}

export async function getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parseInt(String(req.query.limit || '10'), 10)
    const page = parseInt(String(req.query.page || '1'), 10)
    const leaderboard = await userService.getGlobalLeaderboard(limit, page)
    res.json({ leaderboard, global: leaderboard })
  } catch (err) {
    next(err)
  }
}

export async function getLeaderboardByType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parseInt(String(req.query.limit || '10'), 10)
    const page = parseInt(String(req.query.page || '1'), 10)
    const leaderboard = await userService.getLeaderboardByGameType(req.params.gameType, limit, page)
    res.json({ leaderboard, global: leaderboard })
  } catch (err) {
    next(err)
  }
}
