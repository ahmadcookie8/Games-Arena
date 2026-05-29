import { Router } from 'express'
import {
  createGame,
  createSinglePlayerGame,
  getGame,
  listGames,
  joinGame,
  makeSinglePlayerMove,
  saveSinglePlayerSnakeState,
  updateSinglePlayerSettings,
  resignGame,
  closeGame,
  resumeGame,
  getMoveHistory,
} from '../controllers/gameController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.post('/create', createGame)
router.post('/single-player/create', createSinglePlayerGame)
router.post('/join', joinGame)
router.get('/', listGames)
router.post('/:gameId/single-player/move', makeSinglePlayerMove)
router.post('/:gameId/single-player/snake/state', saveSinglePlayerSnakeState)
router.patch('/:gameId/single-player/settings', updateSinglePlayerSettings)
router.get('/:gameId', getGame)
router.post('/:gameId/join', joinGame)
router.post('/:gameId/resign', resignGame)
router.post('/:gameId/close', closeGame)
router.get('/:gameId/resume', resumeGame)
router.get('/:gameId/history', getMoveHistory)

export default router
