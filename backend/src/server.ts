import express from 'express'
import helmet from 'helmet'
import { createServer, IncomingMessage } from 'http'
import { isIP } from 'net'
import { Server, Socket } from 'socket.io'
import { ZodError, ZodType } from 'zod'
import { config } from './config'
import { corsMiddleware } from './middleware/cors'
import { errorHandler } from './middleware/errorHandler'
import { isAllowedRequestOrigin, originMiddleware } from './middleware/origin'
import {
  RATE_LIMIT_POLICIES,
  consumeRedisRateLimit,
} from './middleware/rateLimit'
import { connectMongoDB } from './utils/mongoose'
import { getRedisClient } from './utils/redis'
import { gameService } from './services/gameService'
import { getLeaderboard, getLeaderboardByType, getSinglePlayerLeaderboard } from './controllers/userController'
import { getAuthTokenFromCookie, VerifiedAuthPayload } from './utils/authToken'
import { authenticateSessionPayload, authenticateSessionToken } from './services/sessionAuthService'
import {
  createGameStateEnvelope,
  releaseActiveGameConnectionLeases,
  setSocketServer,
} from './services/socketNotifier'
import { AuthPayload } from './types/api'
import { AppError, NotFoundError } from './utils/errors'
import {
  joinRoomEventSchema,
  leaveRoomEventSchema,
  makeMoveEventSchema,
  sendChatMessageEventSchema,
} from './utils/validators'
import { logSecurityEvent, startResourcePressureMonitor } from './utils/securityLogger'
import { startStatsReconciliationWorker } from './services/statsReconciliationWorker'
import { gameUserRoom, userRoom } from './utils/socketRooms'
import { activeGameConnectionLeases } from './services/activeGameConnectionLeases'

import authRoutes from './routes/auth'
import gameRoutes from './routes/games'
import userRoutes from './routes/users'
import healthRoutes from './routes/health'

interface AuthenticatedHandshakeRequest extends IncomingMessage {
  gamesArenaUser?: VerifiedAuthPayload
}

const presenceTransitionTails = new Map<string, Promise<void>>()

export interface SocketSuccess<T> {
  ok: true
  data: T
}

export interface SocketFailure {
  ok: false
  error: {
    code: string
    message: string
  }
}

export type SocketResponse<T> = SocketSuccess<T> | SocketFailure
type SocketCallback<T> = (response: SocketResponse<T>) => void

const app = express()
app.set('trust proxy', trustImmediateProxy)
app.disable('x-powered-by')
const httpServer = createServer(app)

const io = new Server(httpServer, {
  allowEIO3: false,
  maxHttpBufferSize: 64 * 1024,
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  allowRequest: (request, callback) => {
    void authorizeHandshake(request as AuthenticatedHandshakeRequest)
      .then(() => callback(null, true))
      .catch((error) => callback(error instanceof Error ? error.message : 'Unauthorized', false))
  },
})
setSocketServer(io)

io.engine.on('connection', (engineSocket) => {
  const request = engineSocket.request as AuthenticatedHandshakeRequest
  const user = request.gamesArenaUser
  if (!user) {
    engineSocket.close(true)
    return
  }

  const expiryTimer = setTimeout(() => {
    logSecurityEvent('socket.engine_session_expired', { userId: user.userId, engineSocketId: engineSocket.id })
    engineSocket.close(true)
  }, getSocketSessionExpiryDelay(user))
  expiryTimer.unref()
  let closed = false
  let heartbeatRunning = false
  const heartbeat = setInterval(() => {
    if (heartbeatRunning || closed) return
    heartbeatRunning = true
    void authenticateSessionPayload(user)
      .then((sessionUser) => {
        if (closed) return
        if (!sessionUser) {
          logSecurityEvent('socket.engine_session_rejected', { userId: user.userId, engineSocketId: engineSocket.id })
          engineSocket.close(true)
          return
        }
        request.gamesArenaUser = sessionUser
      })
      .catch(() => {
        logSecurityEvent('socket.engine_heartbeat_failed', { userId: user.userId, engineSocketId: engineSocket.id }, 'error')
        engineSocket.close(true)
      })
      .finally(() => { heartbeatRunning = false })
  }, 60 * 1000)
  heartbeat.unref()

  engineSocket.once('close', () => {
    closed = true
    clearTimeout(expiryTimer)
    clearInterval(heartbeat)
  })
})

async function authorizeHandshake(request: AuthenticatedHandshakeRequest): Promise<void> {
  const ip = getHandshakeIp(request)
  // Reject cross-site browser attempts before touching the shared IP bucket.
  // Otherwise a hostile page could exhaust a victim NAT's legitimate quota
  // using requests whose Origin can never be accepted.
  if (!isAllowedRequestOrigin(request.headers.origin)) {
    logSecurityEvent('socket.handshake_invalid_origin', { ip })
    throw new Error('Invalid origin')
  }

  let rateLimit
  try {
    rateLimit = await consumeRedisRateLimit(RATE_LIMIT_POLICIES.socketHandshakeIp, ip)
  } catch {
    logSecurityEvent('socket.handshake_rate_limit_unavailable', { ip }, 'error')
    throw new Error('Service unavailable')
  }
  if (!rateLimit.allowed) {
    logSecurityEvent('socket.handshake_rate_limited', { ip })
    throw new Error('Rate limited')
  }

  const token = getAuthTokenFromCookie(request.headers.cookie)
  if (!token) {
    logSecurityEvent('socket.handshake_auth_failed', { ip })
    throw new Error('Unauthorized')
  }
  let user
  try {
    user = await authenticateSessionToken(token)
  } catch {
    logSecurityEvent('socket.handshake_auth_failed', { ip })
    throw new Error('Unauthorized')
  }
  if (!user) {
    logSecurityEvent('socket.handshake_auth_failed', { ip })
    throw new Error('Unauthorized')
  }

  request.gamesArenaUser = user
}

io.use((socket, next) => {
  const request = socket.request as AuthenticatedHandshakeRequest
  void (async () => {
    const token = getAuthTokenFromCookie(request.headers.cookie)
    if (!request.gamesArenaUser || !token) throw new Error('Unauthorized')

    // The Engine.IO transport handshake and the Socket.IO namespace CONNECT
    // are distinct steps. Revalidate here so logout, deactivation, revocation,
    // or token expiry in that gap cannot create a live namespace connection.
    const user = await authenticateSessionToken(token)
    if (!user) throw new Error('Unauthorized')

    socket.data.user = user
    next()
  })().catch(() => {
    logSecurityEvent('socket.connection_rejected', { socketId: socket.id })
    next(new Error('Unauthorized'))
  })
})

app.use(helmet({
  frameguard: { action: 'deny' },
  hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
}))
app.use(corsMiddleware)
app.use(originMiddleware)
app.use(express.json({ limit: '64kb', strict: true }))

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/users', userRoutes)
app.get('/api/leaderboards', getLeaderboard)
app.get('/api/leaderboards/single-player/:gameType', getSinglePlayerLeaderboard)
app.get('/api/leaderboards/:gameType', getLeaderboardByType)

app.use(errorHandler)

io.on('connection', (socket) => {
  const user = socket.data.user as VerifiedAuthPayload
  let joinedGameId: string | null = null
  let roomTransition: Promise<void> = Promise.resolve()
  let disconnecting = false
  let leaseHeartbeatRunning = false
  const clientEvents = new Set(['joinRoom', 'leaveRoom', 'makeMove', 'sendChatMessage'])
  const sessionExpiryTimer = setTimeout(() => {
    logSecurityEvent('socket.session_expired', { userId: user.userId, socketId: socket.id })
    socket.disconnect(true)
  }, getSocketSessionExpiryDelay(user))
  sessionExpiryTimer.unref()
  const leaseHeartbeat = setInterval(() => {
    if (leaseHeartbeatRunning || disconnecting || !activeGameConnectionLeases.has(socket.id)) return
    leaseHeartbeatRunning = true
    void activeGameConnectionLeases.refresh(socket.id)
      .then((retained) => {
        if (retained || disconnecting) return
        logSecurityEvent('socket.active_game_connection_limit_rejected', {
          userId: user.userId,
          socketId: socket.id,
        })
        socket.disconnect(true)
      })
      .catch(() => {
        if (disconnecting) return
        logSecurityEvent('socket.active_game_connection_heartbeat_failed', {
          userId: user.userId,
          socketId: socket.id,
        }, 'error')
        socket.disconnect(true)
      })
      .finally(() => { leaseHeartbeatRunning = false })
  }, 60 * 1000)
  leaseHeartbeat.unref()

  socket.use((packet, next) => {
    void (async () => {
      const event = packet[0]
      // Cleanup must remain available after the general event budget is
      // exhausted; otherwise an active Redis lease could be stranded until TTL.
      if (event !== 'leaveRoom') {
        await enforceSocketRateLimit(user.userId, RATE_LIMIT_POLICIES.socketEventUser)
      }
      if (typeof event !== 'string' || !clientEvents.has(event)) {
        logSecurityEvent('socket.unknown_event', { socketEvent: typeof event === 'string' ? event : 'invalid', socketId: socket.id, userId: user.userId })
        const maybeCallback = packet[packet.length - 1]
        sendSocketResponse(socket, typeof event === 'string' ? event : 'unknown', typeof maybeCallback === 'function' ? maybeCallback : undefined, {
          ok: false,
          error: { code: 'UNKNOWN_EVENT', message: 'Unknown event' },
        })
        return
      }
      next()
    })().catch((error) => {
      const event = typeof packet[0] === 'string' ? packet[0] : 'unknown'
      const maybeCallback = packet[packet.length - 1]
      sendSocketResponse(socket, event, typeof maybeCallback === 'function' ? maybeCallback : undefined, socketFailure(error))
    })
  })

  socket.join(userRoom(user.userId))
  socket.emit('welcome', { socketId: socket.id, message: 'Connected to Games Arena' })

  registerSocketEvent(socket, 'joinRoom', joinRoomEventSchema, ({ gameId }) => {
    // Socket.IO handlers may overlap. Serialize room transitions so two rapid
    // authorized joins cannot leave one transport subscribed to two game rooms.
    const transition = roomTransition.then(async () => {
      const authorizedGame = await gameService.getGame(gameId, user.userId)
      if (!authorizedGame) throw new NotFoundError('Game')

      if (disconnecting || !socket.connected) {
        throw new AppError('Connection closed', 400, 'CONNECTION_CLOSED')
      }

      if (joinedGameId && joinedGameId !== gameId) {
        const previousGameId = joinedGameId
        joinedGameId = null
        await socket.leave(gameUserRoom(previousGameId, user.userId))
        try {
          await markPlayerDisconnectedIfLastSocket(previousGameId, user.userId)
        } catch {
          logSecurityEvent('socket.previous_game_disconnect_failed', { gameId: previousGameId, userId: user.userId }, 'error')
        }
      }

      try {
        if (authorizedGame.status === 'active') {
          try {
            await activeGameConnectionLeases.activate(socket.id, user.userId, gameId)
          } catch (error) {
            if (error instanceof AppError && error.code === 'SOCKET_CONNECTION_LIMIT') {
              logSecurityEvent('socket.active_game_connection_limit_rejected', {
                userId: user.userId,
                socketId: socket.id,
                gameId,
              })
            } else {
              logSecurityEvent('socket.active_game_connection_limit_unavailable', {
                userId: user.userId,
                socketId: socket.id,
                gameId,
              }, 'error')
            }
            throw error
          }
        } else {
          await releaseSocketActiveGameLease(socket.id, user.userId)
        }

        await socket.join(gameUserRoom(gameId, user.userId))
        joinedGameId = gameId
        if (disconnecting || !socket.connected) {
          throw new AppError('Connection closed', 400, 'CONNECTION_CLOSED')
        }

        const game = await withPresenceTransition(gameId, user.userId, () => (
          gameService.setPlayerConnection(gameId, user.userId, true)
        ))
        if (!game) throw new NotFoundError('Game')
        if (game.status !== 'active') await releaseSocketActiveGameLease(socket.id, user.userId)
        return createGameStateEnvelope(game, user.userId)
      } catch (error) {
        joinedGameId = null
        await socket.leave(gameUserRoom(gameId, user.userId))
        await releaseSocketActiveGameLease(socket.id, user.userId)
        try {
          await markPlayerDisconnectedIfLastSocket(gameId, user.userId)
        } catch {
          logSecurityEvent('socket.failed_room_join_cleanup_failed', { gameId, userId: user.userId }, 'error')
        }
        throw error
      }
    })
    roomTransition = transition.then(() => undefined, () => undefined)
    return transition
  })

  registerSocketEvent(socket, 'leaveRoom', leaveRoomEventSchema, ({ gameId }) => {
    const transition = roomTransition.then(async () => {
      // Route cleanups can arrive after another navigation. A stale or repeated
      // leave must never evict the socket from its newer room.
      if (joinedGameId !== gameId) return { gameId, left: false }

      joinedGameId = null
      await socket.leave(gameUserRoom(gameId, user.userId))
      await releaseSocketActiveGameLease(socket.id, user.userId)
      try {
        await markPlayerDisconnectedIfLastSocket(gameId, user.userId)
      } catch {
        logSecurityEvent('socket.explicit_leave_state_failed', { gameId, userId: user.userId }, 'error')
      }
      return { gameId, left: true }
    })
    roomTransition = transition.then(() => undefined, () => undefined)
    return transition
  })

  registerSocketEvent(socket, 'makeMove', makeMoveEventSchema, async ({ gameId, move }) => {
    await enforceSocketRateLimit(user.userId, RATE_LIMIT_POLICIES.socketMoveUser)
    if (joinedGameId !== gameId) throw new AppError('Join the game before making a move', 403, 'JOIN_GAME_FIRST')

    const game = await gameService.makeMove(gameId, user.userId, move)
    if (game.status !== 'active') await releaseActiveGameConnectionLeases(gameId)
    return createGameStateEnvelope(game, user.userId)
  })

  registerSocketEvent(socket, 'sendChatMessage', sendChatMessageEventSchema, async ({ gameId, text }) => {
    await enforceSocketRateLimit(user.userId, RATE_LIMIT_POLICIES.socketChatUser)
    if (joinedGameId !== gameId) throw new AppError('Join the game before sending a message', 403, 'JOIN_GAME_FIRST')

    const message = await gameService.sendChatMessage(gameId, user.userId, user.username, text)
    return { message }
  })

  socket.on('disconnect', () => {
    disconnecting = true
    clearTimeout(sessionExpiryTimer)
    clearInterval(leaseHeartbeat)
    void roomTransition.then(async () => {
      await releaseSocketActiveGameLease(socket.id, user.userId)
      if (joinedGameId) await markPlayerDisconnectedIfLastSocket(joinedGameId, user.userId)
    })
      .catch(() => logSecurityEvent('socket.disconnect_state_failed', { userId: user.userId }, 'error'))
  })
})

export function registerSocketEvent<TInput, TOutput>(
  socket: Socket,
  event: string,
  schema: ZodType<TInput>,
  handler: (payload: TInput) => Promise<TOutput>
): void {
  socket.on(event, (...args: unknown[]) => {
    const callbackCandidate = args[args.length - 1]
    const callback = typeof callbackCandidate === 'function'
      ? callbackCandidate as SocketCallback<TOutput>
      : undefined
    const payloadArgs = callback ? args.slice(0, -1) : args
    // Each supported event has exactly one envelope. Treat missing or extra
    // arguments as malformed while still preserving an acknowledgement-only
    // callback so the client receives a bounded, sanitized failure.
    const payload = payloadArgs.length === 1 ? payloadArgs[0] : undefined
    void (async () => {
      const parsed = schema.parse(payload)
      const data = await handler(parsed)
      sendSocketResponse(socket, event, callback, { ok: true, data })
    })().catch((error) => {
      const failure = socketFailure(error)
      if (error instanceof ZodError) {
        logSecurityEvent('socket.malformed_event', { socketEvent: event, socketId: socket.id, userId: (socket.data.user as AuthPayload | undefined)?.userId })
      }
      if (!(error instanceof AppError) && !(error instanceof ZodError)) {
        logSecurityEvent('socket.unhandled_event_error', { socketEvent: event, socketId: socket.id }, 'error')
      }
      sendSocketResponse(socket, event, callback, failure)
    })
  })
}

function sendSocketResponse<T>(socket: Socket, event: string, callback: SocketCallback<T> | undefined, response: SocketResponse<T>): void {
  if (typeof callback === 'function') {
    try {
      callback(response)
    } catch {
      logSecurityEvent('socket.acknowledgement_failed', { socketEvent: event, socketId: socket.id }, 'error')
    }
    return
  }

  if (!response.ok) socket.emit('operationError', { event, error: response.error })
}

export function socketFailure(error: unknown): SocketFailure {
  if (error instanceof ZodError) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } }
  }
  if (error instanceof AppError) {
    const code = error.code === 'NOT_FOUND' && error.message === 'Game not found'
      ? 'GAME_NOT_FOUND'
      : error.code || 'REQUEST_FAILED'
    return { ok: false, error: { code, message: error.message } }
  }
  return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Request failed' } }
}

async function enforceSocketRateLimit(userId: string, policy: typeof RATE_LIMIT_POLICIES[keyof typeof RATE_LIMIT_POLICIES]): Promise<void> {
  let result
  try {
    result = await consumeRedisRateLimit(policy, userId)
  } catch {
    logSecurityEvent('socket.event_rate_limit_unavailable', { userId, scope: policy.scope }, 'error')
    throw new AppError('Service temporarily unavailable', 503, 'RATE_LIMIT_UNAVAILABLE')
  }
  if (!result.allowed) {
    logSecurityEvent('socket.event_rate_limited', { userId, scope: policy.scope })
    throw new AppError('Too many requests', 429, 'RATE_LIMITED')
  }
}

export function getHandshakeIp(request: IncomingMessage): string {
  const remoteAddress = normalizeIpAddress(request.socket.remoteAddress || 'unknown')
  if (!isTrustedProxyAddress(remoteAddress)) return remoteAddress

  const forwarded = request.headers['x-forwarded-for']
  const value = Array.isArray(forwarded) ? forwarded[forwarded.length - 1] : forwarded
  if (!value) return remoteAddress

  const forwardedAddresses = value.split(',').map((part) => part.trim()).filter(Boolean)
  const rightmost = forwardedAddresses[forwardedAddresses.length - 1]
  // Production binds Node to loopback and places exactly one trusted Nginx hop
  // in front. Nginx appends the real peer, so the rightmost value cannot be a
  // client-supplied spoof even when an earlier XFF value was supplied.
  return rightmost && isIP(rightmost) !== 0 ? normalizeIpAddress(rightmost) : remoteAddress
}

/** Exactly one loopback/private bridge hop may supply forwarding metadata. */
export function trustImmediateProxy(address: string, hop = 0): boolean {
  return hop === 0 && isTrustedProxyAddress(address)
}

export function isTrustedProxyAddress(address: string): boolean {
  const normalized = normalizeIpAddress(address)
  const version = isIP(normalized)
  if (version === 4) {
    const octets = normalized.split('.').map(Number)
    return octets[0] === 127
      || octets[0] === 10
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
  }
  if (version === 6) {
    const lower = normalized.toLowerCase()
    return lower === '::1' || /^f[cd][0-9a-f]{2}:/.test(lower)
  }
  return false
}

function normalizeIpAddress(address: string): string {
  const withoutZone = address.split('%', 1)[0]
  const mappedAddress = withoutZone.toLowerCase().startsWith('::ffff:') ? withoutZone.slice(7) : withoutZone
  return isIP(mappedAddress) === 4 ? mappedAddress : withoutZone
}

function hasLiveUserSocketInGame(gameId: string, userId: string): boolean {
  const socketIds = io.sockets.adapter.rooms.get(gameUserRoom(gameId, userId))
  if (!socketIds) return false

  for (const socketId of socketIds) {
    const candidate = io.sockets.sockets.get(socketId)
    const candidateUser = candidate?.data.user as VerifiedAuthPayload | undefined
    if (candidate?.connected && candidateUser?.userId === userId) return true
  }
  return false
}

async function markPlayerDisconnectedIfLastSocket(gameId: string, userId: string): Promise<void> {
  await withPresenceTransition(gameId, userId, async () => {
    if (hasLiveUserSocketInGame(gameId, userId)) return
    await gameService.setPlayerConnection(gameId, userId, false)
  })
}

async function releaseSocketActiveGameLease(socketId: string, userId: string): Promise<void> {
  try {
    await activeGameConnectionLeases.releaseSocket(socketId)
  } catch {
    // Local ownership is removed before Redis I/O. The Redis member remains
    // bounded by its 120-second TTL if the backend is temporarily unavailable.
    logSecurityEvent('socket.active_game_connection_release_failed', { userId, socketId }, 'error')
  }
}

async function withPresenceTransition<T>(gameId: string, userId: string, operation: () => Promise<T>): Promise<T> {
  const key = `${gameId}:${userId}`
  const previous = presenceTransitionTails.get(key) || Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const tail = previous.then(() => gate, () => gate)
  presenceTransitionTails.set(key, tail)

  await previous.catch(() => undefined)
  try {
    return await operation()
  } finally {
    release()
    if (presenceTransitionTails.get(key) === tail) presenceTransitionTails.delete(key)
  }
}

export function getSocketSessionExpiryDelay(user: AuthPayload, now = Date.now()): number {
  if (typeof user.exp !== 'number' || !Number.isFinite(user.exp)) return 0
  // Node clamps larger timer delays. Seven-day sessions are already below this
  // ceiling, but bounding keeps this helper fail-safe if token policy changes.
  return Math.max(0, Math.min((user.exp * 1000) - now, 2_147_483_647))
}

async function bootstrap(): Promise<void> {
  await connectMongoDB()
  getRedisClient()
  startResourcePressureMonitor()
  startStatsReconciliationWorker()

  httpServer.listen(config.port, () => {
    console.log(`Server running on port ${config.port} (${config.nodeEnv})`)
  })
}

if (require.main === module) {
  void bootstrap().catch((error) => {
    logSecurityEvent('server.start_failed', { errorName: error instanceof Error ? error.name : 'unknown' }, 'error')
    process.exitCode = 1
  })
}

export { app, httpServer, io }
