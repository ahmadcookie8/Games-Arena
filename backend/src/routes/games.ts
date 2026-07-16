import { Router } from 'express'
import {
  createGame,
  createSinglePlayerGame,
  getGame,
  listGames,
  joinGame,
  makeSinglePlayerMove,
  completeSinglePlayerReplay,
  saveSinglePlayerMazeChaseState,
  saveSinglePlayerSnakeState,
  updateSinglePlayerSettings,
  updateGameSettings,
  resignGame,
  closeGame,
  replayGame,
  getMoveHistory,
} from '../controllers/gameController'
import { authMiddleware } from '../middleware/auth'
import { createGameRateLimit, gameMutationRateLimit, joinGameRateLimit, replayVerificationRateLimit } from '../middleware/rateLimit'
import { privateNoStore } from '../middleware/privateCache'

const router = Router()

router.use(privateNoStore)
router.use(authMiddleware)

router.post('/create', createGameRateLimit, createGame)
router.post('/single-player/create', createGameRateLimit, createSinglePlayerGame)
router.post('/join', joinGameRateLimit, joinGame)
router.get('/', listGames)
router.post('/:gameId/single-player/move', gameMutationRateLimit, makeSinglePlayerMove)
router.post('/:gameId/single-player/replay', gameMutationRateLimit, replayVerificationRateLimit, completeSinglePlayerReplay)
router.post('/:gameId/single-player/snake/state', gameMutationRateLimit, saveSinglePlayerSnakeState)
router.post('/:gameId/single-player/maze-chase/state', gameMutationRateLimit, saveSinglePlayerMazeChaseState)
router.patch('/:gameId/single-player/settings', gameMutationRateLimit, updateSinglePlayerSettings)
router.patch('/:gameId/settings', gameMutationRateLimit, updateGameSettings)
router.get('/:gameId', getGame)
router.post('/:gameId/resign', gameMutationRateLimit, resignGame)
router.post('/:gameId/close', gameMutationRateLimit, closeGame)
router.post('/:gameId/replay', createGameRateLimit, replayGame)
router.get('/:gameId/history', getMoveHistory)

export default router
