import { Router } from 'express'
import { signup, login, getMe, logout } from '../controllers/authController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
router.get('/me', authMiddleware, getMe)

export default router
