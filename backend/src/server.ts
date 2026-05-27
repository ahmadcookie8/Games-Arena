import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { config } from './config'
import { corsMiddleware } from './middleware/cors'
import { errorHandler } from './middleware/errorHandler'
import { connectMongoDB } from './utils/mongoose'
import { getRedisClient } from './utils/redis'
import { gameService } from './services/gameService'
import { Game } from './models/Game'
import { getLeaderboard, getLeaderboardByType } from './controllers/userController'
import { getTokenFromHeaders, verifyAuthToken } from './utils/authToken'
import { setSocketServer } from './services/socketNotifier'
import { AuthPayload } from './types/api'

import authRoutes from './routes/auth'
import gameRoutes from './routes/games'
import userRoutes from './routes/users'
import healthRoutes from './routes/health'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
setSocketServer(io)

io.use((socket, next) => {
  const token = getTokenFromHeaders(
    typeof socket.handshake.auth?.token === 'string' ? `Bearer ${socket.handshake.auth.token}` : undefined,
    socket.handshake.headers.cookie
  )

  if (!token) {
    next(new Error('Unauthorized'))
    return
  }

  try {
    socket.data.user = verifyAuthToken(token)
    next()
  } catch {
    next(new Error('Unauthorized'))
  }
})

app.use(corsMiddleware)
app.use(express.json())

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/users', userRoutes)
app.get('/api/leaderboards', getLeaderboard)
app.get('/api/leaderboards/:gameType', getLeaderboardByType)

app.use(errorHandler)

// Socket.io event handlers
io.on('connection', (socket) => {
  const user = socket.data.user as AuthPayload
  const joinedGameIds = new Set<string>()

  console.log(`Socket connected: ${socket.id}`)
  socket.join(`user:${user.userId}`)

  socket.emit('welcome', { socketId: socket.id, message: 'Connected to Games Arena' })

  socket.on('createGame', async (_payload: { gameType: string }, callback?: (response: { error: string }) => void) => {
    // Handled via REST; socket joins room after HTTP create
    callback?.({ error: 'Use POST /api/games/create then joinRoom' })
  })

  socket.on('joinRoom', async ({ gameId }: { gameId: string }, callback?: (response: { game?: unknown; error?: string }) => void) => {
    socket.join(gameId)
    joinedGameIds.add(gameId)
    const game = await gameService.setPlayerConnection(gameId, user.userId, true)
    console.log(`Socket ${socket.id} joined room ${gameId}`)
    callback?.(game ? { game } : { error: 'Game not found' })
  })

  socket.on('joinGame', async ({ gameCode }: { gameCode: string }, callback?: (response: { game?: unknown; gameState?: unknown; error?: string }) => void) => {
    try {
      const game = await Game.findOne({ gameCode })
      if (!game) return callback?.({ error: 'Game not found' })
      socket.join(String(game._id))
      joinedGameIds.add(String(game._id))
      const updated = await gameService.setPlayerConnection(String(game._id), user.userId, true)
      callback?.({ game: updated || game, gameState: (updated || game).gameState })
    } catch (err) {
      callback?.({ error: 'Failed to join game' })
    }
  })

  socket.on('makeMove', async ({ gameId, move }: { gameId: string; move: unknown }, callback?: (response: { success: boolean; game?: unknown; error?: string }) => void) => {
    try {
      const game = await gameService.makeMove(gameId, user.userId, move)
      callback?.({ success: true, game })
    } catch (err) {
      callback?.({ success: false, error: err instanceof Error ? err.message : 'Move failed' })
    }
  })

  socket.on('getGameState', async ({ gameId }: { gameId: string }, callback?: (response: { game?: unknown; gameState?: unknown; moveHistory?: unknown; error?: string }) => void) => {
    try {
      const game = await Game.findById(gameId)
      if (!game) return callback?.({ error: 'Game not found' })
      callback?.({ game, gameState: game.gameState, moveHistory: game.moveHistory })
    } catch (err) {
      callback?.({ error: 'Failed to get game state' })
    }
  })

  socket.on('pauseGame', async ({ gameId }: { gameId: string }, callback?: (response: { success: boolean; error?: string }) => void) => {
    try {
      await Game.findByIdAndUpdate(gameId, { status: 'paused' })
      io.to(gameId).emit('gamePaused', { pausedBy: socket.id, timestamp: new Date() })
      callback?.({ success: true })
    } catch (err) {
      callback?.({ success: false, error: 'Failed to pause game' })
    }
  })

  socket.on('resumeGame', async ({ gameId }: { gameId: string }, callback?: (response: { game?: unknown; gameState?: unknown; error?: string }) => void) => {
    try {
      const game = await gameService.resumeGame(gameId)
      if (!game) return callback?.({ error: 'Game not found' })
      socket.join(gameId)
      joinedGameIds.add(gameId)
      await gameService.setPlayerConnection(gameId, user.userId, true)
      callback?.({ game, gameState: game.gameState })
    } catch (err) {
      callback?.({ error: 'Failed to resume game' })
    }
  })

  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`)
    for (const gameId of joinedGameIds) {
      await gameService.setPlayerConnection(gameId, user.userId, false)
    }
  })
})

async function bootstrap() {
  await connectMongoDB()
  getRedisClient() // initialize connection

  httpServer.listen(config.port, () => {
    console.log(`Server running on port ${config.port} (${config.nodeEnv})`)
  })
}

bootstrap()

export { io }
