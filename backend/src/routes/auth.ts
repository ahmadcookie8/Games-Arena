import { Router } from 'express'
import { signup, login, getMe, logout } from '../controllers/authController'
import { authMiddleware } from '../middleware/auth'
import { originMiddleware } from '../middleware/origin'
import { loginIdentifierRateLimit, loginIpRateLimit, signupIpRateLimit } from '../middleware/rateLimit'
import { privateNoStore } from '../middleware/privateCache'

const router = Router()

router.use(privateNoStore)
router.use(originMiddleware)
router.post('/signup', signupIpRateLimit, signup)
router.post('/login', loginIpRateLimit, loginIdentifierRateLimit, login)
router.post('/logout', authMiddleware, logout)
router.get('/me', authMiddleware, getMe)

export default router
