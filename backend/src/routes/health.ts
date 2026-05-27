import { Router, Request, Response } from 'express'
import { isMongoConnected } from '../utils/mongoose'
import { redisIsConnected } from '../utils/redis'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const mongoConnected = isMongoConnected()
  const redisConnected = await redisIsConnected()

  const status = mongoConnected && redisConnected ? 'ok' : 'degraded'

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    uptime: Math.floor(process.uptime()),
    mongodb: mongoConnected ? 'connected' : 'disconnected',
    redis: redisConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  })
})

export default router
