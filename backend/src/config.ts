import dotenv from 'dotenv'
dotenv.config()

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongodbUri: process.env.MONGODB_URI || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL || 'debug',
  maxConcurrentGames: parseInt(process.env.MAX_CONCURRENT_GAMES || '1000', 10),
  gameTimeoutMinutes: parseInt(process.env.GAME_TIMEOUT_MINUTES || '5', 10),
  rateLimitAuth: parseInt(process.env.RATE_LIMIT_AUTH || '5', 10),
}
