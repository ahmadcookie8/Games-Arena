import { AddressInfo } from 'net'
import { Socket as EngineClientSocket } from 'engine.io-client'
import mongoose from 'mongoose'
import { io as createSocketClient, Socket as ClientSocket } from 'socket.io-client'
import { config } from './config'
import { Game } from './models/Game'
import { GameSnapshot } from './models/GameSnapshot'
import { User, IUserDocument } from './models/User'
import { gameService } from './services/gameService'
import { httpServer, io } from './server'
import { AUTH_COOKIE_NAME, signAuthToken } from './utils/authToken'
import { connectMongoDB } from './utils/mongoose'
import { closeRedisClient, getRedisClient } from './utils/redis'
import { gameUserRoom } from './utils/socketRooms'

interface SocketAck {
  ok: boolean
  data?: Record<string, unknown>
  error?: {
    code: string
    message: string
  }
}

interface SeededUser {
  document: IUserDocument
  cookie: string
}

const runIntegration = process.env.RUN_SECURITY_INTEGRATION === '1'
const integrationDescribe = runIntegration ? describe : describe.skip
const sockets = new Set<ClientSocket>()
const engineSockets = new Set<EngineClientSocket>()
let baseUrl = ''

function assertIsolatedTestServices(): void {
  const mongoDatabase = new URL(config.mongodbUri).pathname.replace(/^\//, '')
  const redisDatabase = new URL(config.redisUrl).pathname.replace(/^\//, '')

  if (mongoDatabase !== 'games_arena_security_integration') {
    throw new Error('Security integration tests require the isolated games_arena_security_integration MongoDB database')
  }
  if (redisDatabase !== '15') {
    throw new Error('Security integration tests require isolated Redis database 15')
  }
}

async function clearTestData(): Promise<void> {
  await Promise.all([
    Game.deleteMany({}),
    GameSnapshot.deleteMany({}),
    User.deleteMany({}),
    getRedisClient().flushdb(),
  ])
}

async function seedUser(username: string): Promise<SeededUser> {
  const document = await User.create({
    username,
    email: `${username}@example.test`,
    passwordHash: 'integration-test-password-hash',
    authVersion: 0,
  })
  const token = signAuthToken({
    userId: String(document._id),
    username: document.username,
    authVersion: document.authVersion,
  })
  return {
    document,
    cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
  }
}

function socketOptions(cookie?: string, origin = config.corsOrigin): Parameters<typeof createSocketClient>[1] {
  return {
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    timeout: 2500,
    transports: ['websocket'],
    extraHeaders: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  }
}

async function connectSocket(cookie: string, origin = config.corsOrigin): Promise<ClientSocket> {
  const socket = createSocketClient(baseUrl, socketOptions(cookie, origin))
  sockets.add(socket)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 3500)
    socket.once('connect', () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.once('connect_error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    socket.connect()
  })
}

async function connectRawEngine(cookie: string): Promise<EngineClientSocket> {
  const socket = new EngineClientSocket(baseUrl, {
    path: '/socket.io/',
    transports: ['websocket'],
    extraHeaders: { Origin: config.corsOrigin, Cookie: cookie },
  })
  engineSockets.add(socket)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Engine.IO connection timed out')), 3500)
    socket.once('open', () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

async function expectSocketRejected(cookie: string | undefined, origin: string): Promise<void> {
  const socket = createSocketClient(baseUrl, socketOptions(cookie, origin))
  sockets.add(socket)

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Rejected socket connection timed out')), 3500)
    socket.once('connect', () => {
      clearTimeout(timer)
      reject(new Error('Socket connection unexpectedly succeeded'))
    })
    socket.once('connect_error', () => {
      clearTimeout(timer)
      resolve()
    })
    socket.connect()
  })

  socket.disconnect()
  sockets.delete(socket)
}

async function emitWithAck(socket: ClientSocket, event: string, payload: unknown): Promise<SocketAck> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} acknowledgement timed out`)), 2500)
    socket.emit(event, payload, (response: SocketAck) => {
      clearTimeout(timer)
      resolve(response)
    })
  })
}

async function disconnectTestSockets(): Promise<void> {
  for (const socket of sockets) socket.disconnect()
  sockets.clear()
  for (const socket of engineSockets) socket.close()
  engineSockets.clear()
  await new Promise((resolve) => setTimeout(resolve, 50))
}

async function waitForCondition(predicate: () => boolean | Promise<boolean>, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('Timed out waiting for integration-test condition')
}

integrationDescribe('real-service security integration', () => {
  beforeAll(async () => {
    assertIsolatedTestServices()
    await connectMongoDB()
    await getRedisClient().ping()
    await clearTestData()
    await Promise.all([User.syncIndexes(), Game.syncIndexes()])

    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject)
      httpServer.listen(0, '127.0.0.1', () => {
        httpServer.off('error', reject)
        const address = httpServer.address() as AddressInfo
        baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })
  }, 30_000)

  beforeEach(async () => {
    await disconnectTestSockets()
    await clearTestData()
  })

  afterEach(disconnectTestSockets)

  afterAll(async () => {
    await disconnectTestSockets()
    await clearTestData()
    await new Promise<void>((resolve) => io.close(() => resolve()))
    await mongoose.disconnect()
    await closeRedisClient()
  }, 30_000)

  test('rejects hostile and unauthenticated WebSocket handshakes before connection allocation', async () => {
    const user = await seedUser('socketowner')

    for (let attempt = 0; attempt < 25; attempt += 1) {
      await expectSocketRejected(user.cookie, 'https://attacker.example')
    }
    // Cross-site browser attempts do not consume the shared NAT/IP budget.
    const legitimateSocket = await connectSocket(user.cookie)
    legitimateSocket.disconnect()
    sockets.delete(legitimateSocket)
    await new Promise((resolve) => setTimeout(resolve, 50))

    for (let attempt = 0; attempt < 19; attempt += 1) {
      await expectSocketRejected(undefined, config.corsOrigin)
    }
    // The first legitimate handshake plus 19 same-origin unauthenticated
    // attempts consume the exact 20/minute budget.
    await expectSocketRejected(user.cookie, config.corsOrigin)
  })

  test('limits only active game-room connections to ten and keeps idle or completed sockets exempt', async () => {
    const user = await seedUser('socketlimit')
    const userId = String(user.document._id)
    const completedGame = await gameService.createGame(userId, user.document.username, 'ticTacToe')
    await Game.findByIdAndUpdate(completedGame._id, {
      $set: { status: 'completed', completedAt: new Date() },
    })
    const activeGame = await gameService.createGame(userId, user.document.username, 'ticTacToe')
    const userSockets: ClientSocket[] = []

    // Transport handshakes and completed-game views do not consume a slot.
    for (let index = 0; index < 11; index += 1) {
      const socket = await connectSocket(user.cookie)
      userSockets.push(socket)
      expect((await emitWithAck(socket, 'joinRoom', { gameId: String(completedGame._id) })).ok).toBe(true)
    }

    for (const socket of userSockets.slice(0, 10)) {
      expect((await emitWithAck(socket, 'joinRoom', { gameId: String(activeGame._id) })).ok).toBe(true)
    }
    expect(await emitWithAck(userSockets[10], 'joinRoom', { gameId: String(activeGame._id) })).toEqual({
      ok: false,
      error: {
        code: 'SOCKET_CONNECTION_LIMIT',
        message: 'You can have at most 10 active game connections',
      },
    })
    expect(userSockets[10].connected).toBe(true)

    // Explicit leave is idempotent and makes the capacity reusable immediately.
    expect((await emitWithAck(userSockets[0], 'leaveRoom', { gameId: String(activeGame._id) })).ok).toBe(true)
    expect((await emitWithAck(userSockets[0], 'leaveRoom', { gameId: String(activeGame._id) })).ok).toBe(true)
    expect((await emitWithAck(userSockets[10], 'joinRoom', { gameId: String(activeGame._id) })).ok).toBe(true)

    await gameService.closeGame(String(activeGame._id), userId)
    const replacementGame = await gameService.createGame(userId, user.document.username, 'ticTacToe')
    expect((await emitWithAck(userSockets[0], 'joinRoom', { gameId: String(replacementGame._id) })).ok).toBe(true)
  })

  test('keeps multi-socket presence accurate and increments disconnects only on the last departure', async () => {
    const user = await seedUser('presenceowner')
    const game = await gameService.createGame(String(user.document._id), user.document.username, 'ticTacToe')
    const first = await connectSocket(user.cookie)
    const second = await connectSocket(user.cookie)

    expect((await emitWithAck(first, 'joinRoom', { gameId: String(game._id) })).ok).toBe(true)
    expect((await emitWithAck(second, 'joinRoom', { gameId: String(game._id) })).ok).toBe(true)
    let persisted = await Game.findById(game._id).orFail()
    expect(persisted.players[0].isConnected).toBe(true)
    expect(persisted.players[0].disconnectCount).toBe(0)

    first.disconnect()
    sockets.delete(first)
    await new Promise((resolve) => setTimeout(resolve, 100))
    persisted = await Game.findById(game._id).orFail()
    expect(persisted.players[0].isConnected).toBe(true)
    expect(persisted.players[0].disconnectCount).toBe(0)

    second.disconnect()
    sockets.delete(second)
    await waitForCondition(async () => (await Game.findById(game._id))?.players[0].isConnected === false)
    persisted = await Game.findById(game._id).orFail()
    expect(persisted.players[0].disconnectCount).toBe(1)
  })

  test('disconnects logout-revoked sockets and rejects inactive accounts', async () => {
    const user = await seedUser('revokedowner')
    const socket = await connectSocket(user.cookie)
    const disconnected = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Logout did not disconnect the socket')), 2500)
      socket.once('disconnect', () => {
        clearTimeout(timer)
        resolve()
      })
    })

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: user.cookie, Origin: config.corsOrigin },
    })
    expect(logout.status).toBe(200)
    await disconnected
    sockets.delete(socket)
    await expectSocketRejected(user.cookie, config.corsOrigin)

    const inactive = await seedUser('inactiveowner')
    await User.findByIdAndUpdate(inactive.document._id, { $set: { isActive: false } })
    await expectSocketRejected(inactive.cookie, config.corsOrigin)
  })

  test('revalidates a delayed namespace CONNECT after logout revokes its Engine.IO handshake', async () => {
    const user = await seedUser('delayedconnect')
    const rawTransport = await connectRawEngine(user.cookie)

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: user.cookie, Origin: config.corsOrigin },
    })
    expect(logout.status).toBe(200)

    const namespaceResponse = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Namespace rejection timed out')), 2500)
      rawTransport.once('message', (message) => {
        clearTimeout(timer)
        resolve(String(message))
      })
    })
    // Engine.IO adds its own message packet framing. "0" is the inner
    // Socket.IO root-namespace CONNECT packet.
    rawTransport.send('0')
    expect(await namespaceResponse).toMatch(/^4/)
    expect(io.sockets.sockets.size).toBe(0)
  })

  test('enforces global, chat, and move event budgets against real Redis', async () => {
    const globalUser = await seedUser('globallimit')
    const globalGame = await gameService.createGame(
      String(globalUser.document._id),
      globalUser.document.username,
      'ticTacToe'
    )
    const globalSocket = await connectSocket(globalUser.cookie)
    expect((await emitWithAck(globalSocket, 'joinRoom', { gameId: String(globalGame._id) })).ok).toBe(true)
    for (let eventNumber = 0; eventNumber < 119; eventNumber += 1) {
      const ack = await emitWithAck(globalSocket, 'unsupportedEvent', {})
      expect(ack.error?.code).toBe('UNKNOWN_EVENT')
    }
    const globalLimited = await emitWithAck(globalSocket, 'unsupportedEvent', {})
    expect(globalLimited.error?.code).toBe('RATE_LIMITED')
    expect((await emitWithAck(globalSocket, 'leaveRoom', { gameId: String(globalGame._id) })).ok).toBe(true)

    await disconnectTestSockets()
    await getRedisClient().flushdb()

    const gameUser = await seedUser('eventlimit')
    const game = await gameService.createGame(String(gameUser.document._id), gameUser.document.username, 'ticTacToe')
    const gameSocket = await connectSocket(gameUser.cookie)
    expect((await emitWithAck(gameSocket, 'joinRoom', { gameId: String(game._id) })).ok).toBe(true)

    for (let messageNumber = 0; messageNumber < 20; messageNumber += 1) {
      const ack = await emitWithAck(gameSocket, 'sendChatMessage', {
        gameId: String(game._id),
        text: `message ${messageNumber}`,
      })
      expect(ack.ok).toBe(true)
    }
    const chatLimited = await emitWithAck(gameSocket, 'sendChatMessage', {
      gameId: String(game._id),
      text: 'one too many',
    })
    expect(chatLimited.error?.code).toBe('RATE_LIMITED')

    for (let moveNumber = 0; moveNumber < 60; moveNumber += 1) {
      const ack = await emitWithAck(gameSocket, 'makeMove', { gameId: String(game._id), move: '0' })
      expect(ack.error?.code).toBe('BAD_REQUEST')
    }
    const moveLimited = await emitWithAck(gameSocket, 'makeMove', { gameId: String(game._id), move: '0' })
    expect(moveLimited.error?.code).toBe('RATE_LIMITED')
  })

  test('closes an established transport when a Socket.IO frame exceeds 64 KiB', async () => {
    const user = await seedUser('oversizedsocket')
    const socket = await connectSocket(user.cookie)
    const disconnected = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Oversized socket frame was not closed')), 2500)
      socket.once('disconnect', () => {
        clearTimeout(timer)
        resolve()
      })
    })

    socket.emit('sendChatMessage', {
      gameId: new mongoose.Types.ObjectId().toString(),
      text: 'x'.repeat(70 * 1024),
    })
    await disconnected
    sockets.delete(socket)
  })

  test('blocks operator injection, malformed envelopes, unauthorized rooms, and event disclosure', async () => {
    const owner = await seedUser('roomowner')
    const outsider = await seedUser('roomoutsider')
    const game = await gameService.createGame(String(owner.document._id), owner.document.username, 'ticTacToe')
    const ownerSocket = await connectSocket(owner.cookie)
    const outsiderSocket = await connectSocket(outsider.cookie)

    const operatorAck = await emitWithAck(outsiderSocket, 'joinRoom', { gameId: { $ne: null } })
    expect(operatorAck).toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request' },
    })

    for (const payload of [null, [], { gameId: String(game._id).toUpperCase() }]) {
      const malformedAck = await emitWithAck(outsiderSocket, 'joinRoom', payload)
      expect(malformedAck.ok).toBe(false)
      expect(malformedAck.error?.code).toBe('VALIDATION_ERROR')
    }

    const unauthorizedAck = await emitWithAck(outsiderSocket, 'joinRoom', { gameId: String(game._id) })
    expect(unauthorizedAck).toEqual({
      ok: false,
      error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
    })

    let outsiderChatEvents = 0
    outsiderSocket.on('chatMessage', () => { outsiderChatEvents += 1 })

    const joinAck = await emitWithAck(ownerSocket, 'joinRoom', { gameId: String(game._id) })
    expect(joinAck.ok).toBe(true)
    const chatAck = await emitWithAck(ownerSocket, 'sendChatMessage', {
      gameId: String(game._id),
      text: 'private participant message',
    })
    expect(chatAck.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(outsiderChatEvents).toBe(0)

    const secondGame = await gameService.createGame(String(owner.document._id), owner.document.username, 'ticTacToe')
    const rapidRoomAcks = await Promise.all([
      emitWithAck(ownerSocket, 'joinRoom', { gameId: String(game._id) }),
      emitWithAck(ownerSocket, 'joinRoom', { gameId: String(secondGame._id) }),
    ])
    expect(rapidRoomAcks.every((ack) => ack.ok)).toBe(true)
    const serverSocket = io.sockets.sockets.get(ownerSocket.id)
    const joinedGameRooms = [...serverSocket!.rooms].filter((room) => room.startsWith('game:'))
    expect(joinedGameRooms).toEqual([
      gameUserRoom(String(secondGame._id), String(owner.document._id)),
    ])
    expect(joinedGameRooms.some((room) => room.includes(String(game._id)))).toBe(false)
  })

  test('isolates revisioned full-state events across two simultaneous games for one user', async () => {
    const owner = await seedUser('twogameowner')
    const challenger = await seedUser('twogamechallenger')
    const ownerId = String(owner.document._id)
    const challengerId = String(challenger.document._id)
    const firstGame = await gameService.createGame(ownerId, owner.document.username, 'ticTacToe')
    const secondGame = await gameService.createGame(ownerId, owner.document.username, 'ticTacToe')
    await gameService.joinGame(firstGame.gameCode, challengerId, challenger.document.username)
    await gameService.joinGame(secondGame.gameCode, challengerId, challenger.document.username)

    const firstSocket = await connectSocket(owner.cookie)
    const secondSocket = await connectSocket(owner.cookie)
    const firstJoin = await emitWithAck(firstSocket, 'joinRoom', { gameId: String(firstGame._id) })
    const secondJoin = await emitWithAck(secondSocket, 'joinRoom', { gameId: String(secondGame._id) })
    expect(firstJoin).toMatchObject({ ok: true, data: { gameId: String(firstGame._id), revision: expect.any(Number) } })
    expect(secondJoin).toMatchObject({ ok: true, data: { gameId: String(secondGame._id), revision: expect.any(Number) } })

    let foreignFullStateEvents = 0
    secondSocket.on('gameUpdated', () => { foreignFullStateEvents += 1 })

    const versionBeforeDeltas = (await Game.findById(firstGame._id).orFail()).__v
    expect((await emitWithAck(firstSocket, 'sendChatMessage', {
      gameId: String(firstGame._id),
      text: 'first table only',
    })).ok).toBe(true)
    expect((await Game.findById(firstGame._id).orFail()).__v).toBe(versionBeforeDeltas)

    const moveAck = await emitWithAck(firstSocket, 'makeMove', { gameId: String(firstGame._id), move: '0' })
    expect(moveAck).toMatchObject({
      ok: true,
      data: {
        gameId: String(firstGame._id),
        revision: expect.any(Number),
        game: { _id: String(firstGame._id) },
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(foreignFullStateEvents).toBe(0)
    expect((await Game.findById(firstGame._id).orFail()).__v).toBe(versionBeforeDeltas + 1)
    expect((await Game.findById(secondGame._id).orFail()).moveHistory).toHaveLength(0)
  })

  test('races a gameplay move with presence and chat without advancing the gameplay revision for deltas', async () => {
    const owner = await seedUser('deltaraceowner')
    const challenger = await seedUser('deltaracechallenger')
    const ownerId = String(owner.document._id)
    const challengerId = String(challenger.document._id)
    const game = await gameService.createGame(ownerId, owner.document.username, 'ticTacToe')
    await gameService.joinGame(game.gameCode, challengerId, challenger.document.username)
    const gameId = String(game._id)

    const moveSocket = await connectSocket(owner.cookie)
    const chatSocket = await connectSocket(owner.cookie)
    const presenceSocket = await connectSocket(challenger.cookie)
    expect((await emitWithAck(moveSocket, 'joinRoom', { gameId })).ok).toBe(true)
    expect((await emitWithAck(chatSocket, 'joinRoom', { gameId })).ok).toBe(true)

    const chatEvents: Array<{ gameId?: string; message?: { text?: string } }> = []
    const presenceEvents: Array<{ gameId?: string; userId?: string; isConnected?: boolean }> = []
    const stateEvents: Array<{
      gameId?: string
      revision?: number
      game?: { _id?: string; gameState?: { board?: Array<string | null> } }
    }> = []
    moveSocket.on('chatMessage', (event) => chatEvents.push(event))
    moveSocket.on('playerPresenceChanged', (event) => presenceEvents.push(event))
    moveSocket.on('gameUpdated', (event) => stateEvents.push(event))

    const versionBeforeRace = (await Game.findById(gameId).orFail()).__v
    const [moveAck, chatAck, presenceAck] = await Promise.all([
      emitWithAck(moveSocket, 'makeMove', { gameId, move: '0' }),
      emitWithAck(chatSocket, 'sendChatMessage', { gameId, text: 'concurrent delta' }),
      emitWithAck(presenceSocket, 'joinRoom', { gameId }),
    ])

    expect(moveAck).toMatchObject({
      ok: true,
      data: {
        gameId,
        revision: versionBeforeRace + 1,
        game: { _id: gameId },
      },
    })
    expect(chatAck).toMatchObject({ ok: true, data: { message: { text: 'concurrent delta' } } })
    expect(presenceAck).toMatchObject({ ok: true, data: { gameId } })

    await waitForCondition(() => (
      chatEvents.some((event) => event.gameId === gameId && event.message?.text === 'concurrent delta')
      && presenceEvents.some((event) => (
        event.gameId === gameId
        && event.userId === challengerId
        && event.isConnected === true
      ))
      && stateEvents.some((event) => (
        event.gameId === gameId
        && event.revision === versionBeforeRace + 1
        && event.game?._id === gameId
        && event.game.gameState?.board?.[0] === 'X'
      ))
    ))

    const persisted = await Game.findById(gameId).orFail()
    expect(persisted.__v).toBe(versionBeforeRace + 1)
    expect((persisted.gameState as { board: Array<string | null> }).board[0]).toBe('X')
    expect(persisted.moveHistory).toHaveLength(1)
    expect(persisted.chatMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: owner.document._id, text: 'concurrent delta' }),
    ]))
    expect(persisted.players.find((player) => player.userId.equals(challenger.document._id))).toMatchObject({
      isConnected: true,
    })
  })

  test('commits three simultaneous Wisecracker submissions and advances the phase once', async () => {
    const users = await Promise.all([
      seedUser('wisehost'),
      seedUser('wisewriterone'),
      seedUser('wisewritertwo'),
      seedUser('wisewriterthree'),
    ])
    const [host, ...writers] = users
    const game = await gameService.createGame(String(host.document._id), host.document.username, 'wisecracker')
    for (const writer of writers) {
      await gameService.joinGame(game.gameCode, String(writer.document._id), writer.document.username)
    }

    const gameId = String(game._id)
    await gameService.makeMove(gameId, String(host.document._id), { type: 'startMatch', maxScore: 3 })
    await gameService.makeMove(gameId, String(host.document._id), { type: 'setPrompt', prompt: 'A _ needs _.' })

    const writerSockets = await Promise.all(writers.map((writer) => connectSocket(writer.cookie)))
    for (const socket of writerSockets) {
      expect((await emitWithAck(socket, 'joinRoom', { gameId })).ok).toBe(true)
    }

    const submissions = await Promise.all(writerSockets.map((socket, index) => emitWithAck(socket, 'makeMove', {
      gameId,
      move: { type: 'submitAnswers', answers: [`answer-${index}-a`, `answer-${index}-b`] },
    })))
    expect(submissions.every((ack) => ack.ok)).toBe(true)

    const persisted = await Game.findById(game._id).orFail()
    const state = persisted.gameState as {
      phase: string
      submittedAnswers: Record<string, string[]>
      answerOrder: string[]
    }
    expect(state.phase).toBe('revealing')
    expect(Object.keys(state.submittedAnswers)).toHaveLength(3)
    expect(state.answerOrder).toHaveLength(3)
    expect(persisted.moveHistory.filter((move) => move.move === 'submitted answers')).toHaveLength(3)
  })

  test('gives missing and unauthorized REST game reads identical responses and enforces request boundaries', async () => {
    const owner = await seedUser('httpowner')
    const outsider = await seedUser('httpoutsider')
    const game = await gameService.createGame(String(owner.document._id), owner.document.username, 'ticTacToe')
    const missingGameId = new mongoose.Types.ObjectId().toString()

    const unauthorized = await fetch(`${baseUrl}/api/games/${game._id}`, {
      headers: { Cookie: outsider.cookie },
    })
    const missing = await fetch(`${baseUrl}/api/games/${missingGameId}`, {
      headers: { Cookie: outsider.cookie },
    })
    expect(unauthorized.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(await unauthorized.json()).toEqual(await missing.json())

    const bearerOnly = await fetch(`${baseUrl}/api/games`, {
      headers: { Authorization: `Bearer ${signAuthToken({ userId: String(owner.document._id), username: owner.document.username, authVersion: 0 })}` },
    })
    expect(bearerOnly.status).toBe(401)

    const hostileOrigin = await fetch(`${baseUrl}/api/games/create`, {
      method: 'POST',
      headers: {
        Cookie: owner.cookie,
        Origin: 'https://attacker.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gameType: 'ticTacToe' }),
    })
    expect(hostileOrigin.status).toBe(403)

    const malformedJson = await fetch(`${baseUrl}/api/games/create`, {
      method: 'POST',
      headers: {
        Cookie: owner.cookie,
        Origin: config.corsOrigin,
        'Content-Type': 'application/json',
      },
      body: '{"gameType":',
    })
    expect(malformedJson.status).toBe(400)
    expect(await malformedJson.json()).toMatchObject({ code: 'VALIDATION_ERROR' })

    const oversized = await fetch(`${baseUrl}/api/games/create`, {
      method: 'POST',
      headers: {
        Cookie: owner.cookie,
        Origin: config.corsOrigin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gameType: 'ticTacToe', padding: 'x'.repeat(70 * 1024) }),
    })
    expect(oversized.status).toBe(413)
    expect(await oversized.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
  })

  test('fails rate-limited authentication closed while Redis is unavailable and recovers cleanly', async () => {
    getRedisClient().disconnect()
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { Origin: config.corsOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'nobody', password: 'not-the-password' }),
    })
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' })

    await closeRedisClient()
    await expect(getRedisClient().ping()).resolves.toBe('PONG')
  })

  test('keeps a committed MongoDB move successful when Redis-derived services are unavailable', async () => {
    const owner = await seedUser('cacheowner')
    const challenger = await seedUser('cachechallenger')
    const game = await gameService.createGame(String(owner.document._id), owner.document.username, 'ticTacToe')
    await gameService.joinGame(game.gameCode, String(challenger.document._id), challenger.document.username)

    getRedisClient().disconnect()
    const moved = await gameService.makeMove(String(game._id), String(owner.document._id), '0')
    expect(moved.moveHistory).toHaveLength(1)
    const persisted = await Game.findById(game._id).orFail()
    expect(persisted.moveHistory).toHaveLength(1)
    expect((persisted.gameState as { board: Array<string | null> }).board[0]).toBe('X')

    await closeRedisClient()
    await expect(getRedisClient().ping()).resolves.toBe('PONG')
  })

  test('lets any participant close a started game and notifies every participant without processing statistics', async () => {
    const owner = await seedUser('closeowner')
    const challenger = await seedUser('closechallenger')
    const outsider = await seedUser('closeoutsider')
    const ownerId = String(owner.document._id)
    const challengerId = String(challenger.document._id)
    const game = await gameService.createGame(ownerId, owner.document.username, 'ticTacToe')
    await gameService.joinGame(game.gameCode, challengerId, challenger.document.username)

    const closeRequest = (user: SeededUser, gameId = String(game._id)) => fetch(`${baseUrl}/api/games/${gameId}/close`, {
      method: 'POST',
      headers: { Cookie: user.cookie, Origin: config.corsOrigin },
    })

    const outsiderResponse = await closeRequest(outsider)
    expect(outsiderResponse.status).toBe(404)
    expect(await outsiderResponse.json()).toMatchObject({ code: 'GAME_NOT_FOUND' })
    expect((await Game.findById(game._id).orFail()).status).toBe('active')

    const ownerSocket = await connectSocket(owner.cookie)
    const challengerSocket = await connectSocket(challenger.cookie)
    expect((await emitWithAck(ownerSocket, 'joinRoom', { gameId: String(game._id) })).ok).toBe(true)
    expect((await emitWithAck(challengerSocket, 'joinRoom', { gameId: String(game._id) })).ok).toBe(true)
    const nextEvent = (socket: ClientSocket, event: 'gameUpdated' | 'gamesChanged') => new Promise<unknown>((resolve) => {
      socket.once(event, resolve)
    })
    const ownerUpdate = nextEvent(ownerSocket, 'gameUpdated')
    const ownerRefresh = nextEvent(ownerSocket, 'gamesChanged')
    const challengerUpdate = nextEvent(challengerSocket, 'gameUpdated')
    const challengerRefresh = nextEvent(challengerSocket, 'gamesChanged')

    const response = await closeRequest(challenger)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ game: { status: 'abandoned' } })

    const [ownerEvent, , challengerEvent] = await Promise.all([
      ownerUpdate,
      ownerRefresh,
      challengerUpdate,
      challengerRefresh,
    ]) as Array<{ game?: { status?: string; result?: unknown } }>
    expect(ownerEvent.game).toMatchObject({ status: 'abandoned' })
    expect(ownerEvent.game?.result).toBeUndefined()
    expect(challengerEvent.game).toMatchObject({ status: 'abandoned' })
    expect(challengerEvent.game?.result).toBeUndefined()

    const persisted = await Game.findById(game._id).orFail()
    expect(persisted.status).toBe('abandoned')
    expect(persisted.result).toBeUndefined()
    expect(persisted.statsProcessedAt).toBeUndefined()

    const [ownerAfter, challengerAfter] = await Promise.all([
      User.findById(ownerId).orFail(),
      User.findById(challengerId).orFail(),
    ])
    expect(ownerAfter.stats).toMatchObject({ gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDraw: 0 })
    expect(challengerAfter.stats).toMatchObject({ gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDraw: 0 })

    const largerGame = await gameService.createGame(ownerId, owner.document.username, 'wisecracker')
    await gameService.joinGame(largerGame.gameCode, challengerId, challenger.document.username)
    await gameService.joinGame(largerGame.gameCode, String(outsider.document._id), outsider.document.username)
    const largerCloseResponse = await closeRequest(owner, String(largerGame._id))
    expect(largerCloseResponse.status).toBe(200)
    expect(await largerCloseResponse.json()).toMatchObject({ game: { status: 'abandoned' } })
    const persistedLargerGame = await Game.findById(largerGame._id).orFail()
    expect(persistedLargerGame.players).toHaveLength(3)
    expect(persistedLargerGame.status).toBe('abandoned')
    expect(persistedLargerGame.result).toBeUndefined()
    expect(persistedLargerGame.statsProcessedAt).toBeUndefined()
  })

  test('serializes participant close races against moves and resignation', async () => {
    const owner = await seedUser('closeraceowner')
    const challenger = await seedUser('closeracechallenger')
    const ownerId = String(owner.document._id)
    const challengerId = String(challenger.document._id)

    const moveRace = await gameService.createGame(ownerId, owner.document.username, 'ticTacToe')
    await gameService.joinGame(moveRace.gameCode, challengerId, challenger.document.username)
    await gameService.makeMove(String(moveRace._id), ownerId, '0')
    await gameService.makeMove(String(moveRace._id), challengerId, '3')
    await gameService.makeMove(String(moveRace._id), ownerId, '1')
    await gameService.makeMove(String(moveRace._id), challengerId, '4')
    const moveRaceResults = await Promise.allSettled([
      gameService.closeGame(String(moveRace._id), ownerId),
      gameService.makeMove(String(moveRace._id), ownerId, '2'),
    ])
    expect(moveRaceResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const afterMoveRace = await Game.findById(moveRace._id).orFail()
    if (afterMoveRace.status === 'abandoned') {
      expect(afterMoveRace.moveHistory).toHaveLength(4)
      expect(afterMoveRace.result).toBeUndefined()
    } else {
      expect(afterMoveRace.status).toBe('completed')
      expect(afterMoveRace.moveHistory).toHaveLength(5)
      expect(afterMoveRace.result?.winner?.toString()).toBe(ownerId)
    }

    const resignRace = await gameService.createGame(ownerId, owner.document.username, 'ticTacToe')
    await gameService.joinGame(resignRace.gameCode, challengerId, challenger.document.username)
    const resignRaceResults = await Promise.allSettled([
      gameService.closeGame(String(resignRace._id), ownerId),
      gameService.resignGame(String(resignRace._id), challengerId),
    ])
    expect(resignRaceResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    let afterResignRace = await Game.findById(resignRace._id).orFail()
    expect(['abandoned', 'completed']).toContain(afterResignRace.status)
    if (afterResignRace.status === 'abandoned') {
      expect(afterResignRace.result).toBeUndefined()
      expect(afterResignRace.statsProcessedAt).toBeUndefined()
    } else {
      await waitForCondition(async () => Boolean((await Game.findById(resignRace._id))?.statsProcessedAt))
      afterResignRace = await Game.findById(resignRace._id).orFail()
      expect(afterResignRace.result?.winType).toBe('resignation')
      expect(afterResignRace.statsProcessedAt).toBeInstanceOf(Date)
    }
  })

  test('serializes concurrent joins, moves, and resignations with one durable transition and one stats result', async () => {
    const owner = await seedUser('raceowner')
    const challengerOne = await seedUser('racechallengerone')
    const challengerTwo = await seedUser('racechallengertwo')
    const ownerId = String(owner.document._id)
    const game = await gameService.createGame(ownerId, owner.document.username, 'ticTacToe')

    const joinRequest = (challenger: SeededUser) => fetch(`${baseUrl}/api/games/join`, {
      method: 'POST',
      headers: {
        Cookie: challenger.cookie,
        Origin: config.corsOrigin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gameCode: game.gameCode }),
    })
    const joinResults = await Promise.all([joinRequest(challengerOne), joinRequest(challengerTwo)])
    expect(joinResults.filter((result) => result.status === 200)).toHaveLength(1)

    let persisted = await Game.findById(game._id).orFail()
    expect(persisted.players).toHaveLength(2)
    expect(new Set(persisted.players.map((player) => String(player.userId))).size).toBe(2)
    const challengerId = String(persisted.players[1].userId)
    const challenger = challengerId === String(challengerOne.document._id) ? challengerOne : challengerTwo

    const ownerSocket = await connectSocket(owner.cookie)
    expect((await emitWithAck(ownerSocket, 'joinRoom', { gameId: String(game._id) })).ok).toBe(true)
    const moveResults = await Promise.all([
      emitWithAck(ownerSocket, 'makeMove', { gameId: String(game._id), move: '0' }),
      emitWithAck(ownerSocket, 'makeMove', { gameId: String(game._id), move: '0' }),
    ])
    expect(moveResults.filter((result) => result.ok)).toHaveLength(1)

    persisted = await Game.findById(game._id).orFail()
    expect(persisted.moveHistory).toHaveLength(1)
    expect((persisted.gameState as { board: Array<string | null> }).board.filter(Boolean)).toHaveLength(1)

    const resignRequest = () => fetch(`${baseUrl}/api/games/${game._id}/resign`, {
      method: 'POST',
      headers: { Cookie: challenger.cookie, Origin: config.corsOrigin },
    })
    const resignResults = await Promise.all([resignRequest(), resignRequest()])
    expect(resignResults.filter((result) => result.status === 200)).toHaveLength(1)

    await waitForCondition(async () => Boolean((await Game.findById(game._id))?.statsProcessedAt))
    persisted = await Game.findById(game._id).orFail()
    expect(persisted.status).toBe('completed')
    expect(String(persisted.result?.winner)).toBe(ownerId)
    expect(persisted.statsProcessedAt).toBeInstanceOf(Date)

    const [winner, loser] = await Promise.all([
      User.findById(ownerId).orFail(),
      User.findById(challengerId).orFail(),
    ])
    expect(winner.stats).toMatchObject({ gamesPlayed: 1, gamesWon: 1, gamesLost: 0 })
    expect(loser.stats).toMatchObject({ gamesPlayed: 1, gamesWon: 0, gamesLost: 1 })
  })
})
