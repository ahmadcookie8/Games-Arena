import { Router } from 'express'
import {
  createGame,
  getGame,
  listGames,
  joinGame,
  resignGame,
  closeGame,
  resumeGame,
  getMoveHistory,
} from '../controllers/gameController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.post('/create', createGame)
router.post('/join', joinGame)
router.get('/', listGames)
router.get('/:gameId', getGame)
router.post('/:gameId/join', joinGame)
router.post('/:gameId/resign', resignGame)
router.post('/:gameId/close', closeGame)
router.get('/:gameId/resume', resumeGame)
router.get('/:gameId/history', getMoveHistory)

export default router
