import { Router } from 'express'
import { getUserProfile, getUserStats, getLeaderboard, getLeaderboardByType } from '../controllers/userController'
import { authMiddleware } from '../middleware/auth'
import { privateNoStore } from '../middleware/privateCache'

const router = Router()

router.get('/leaderboards', getLeaderboard)
router.get('/leaderboards/:gameType', getLeaderboardByType)
router.get('/:userId', getUserProfile)
router.get('/:userId/stats', privateNoStore, authMiddleware, getUserStats)

export default router
