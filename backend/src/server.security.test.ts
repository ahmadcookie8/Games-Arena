import { AddressInfo } from 'net'
import {
  app,
  getHandshakeIp,
  getSocketSessionExpiryDelay,
  httpServer,
  isTrustedProxyAddress,
  registerSocketEvent,
  socketFailure,
  trustImmediateProxy,
} from './server'
import { joinRoomEventSchema } from './utils/validators'
import { AppError } from './utils/errors'

describe('HTTP security boundary', () => {
  let baseUrl: string

  beforeAll(async () => {
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
    const address = httpServer.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()))
  })

  it('rejects unsafe requests without the configured browser Origin', async () => {
    const response = await fetch(`${baseUrl}/api/games/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameType: 'ticTacToe' }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual(expect.objectContaining({ code: 'FORBIDDEN' }))
  })

  it('does not accept bearer-only authentication', async () => {
    const response = await fetch(`${baseUrl}/api/games/create`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer forged-token',
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ gameType: 'ticTacToe' }),
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual(expect.objectContaining({ code: 'UNAUTHORIZED' }))
  })

  it('returns a sanitized 413 for payloads over 64 KiB', async () => {
    const response = await fetch(`${baseUrl}/api/games/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ value: 'x'.repeat(70 * 1024) }),
    })

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ success: false, error: 'Request payload is too large', code: 'PAYLOAD_TOO_LARGE' })
  })

  it('returns a sanitized 400 for malformed JSON instead of manufacturing a 500', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: '{"identifier":',
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid JSON request body',
      code: 'VALIDATION_ERROR',
    })
  })

  it('sets API hardening headers and suppresses Express disclosure', async () => {
    const response = await fetch(`${baseUrl}/not-found`)

    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin')
    expect(response.headers.get('x-powered-by')).toBeNull()
  })

  // Keep the imported app referenced so TypeScript verifies the exported test surface.
  it('exports the configured Express application', () => expect(app).toBeDefined())
})

describe('socket acknowledgement boundary', () => {
  function fakeSocket() {
    const listeners = new Map<string, (...args: unknown[]) => void>()
    return {
      id: 'socket-1',
      data: { user: { userId: '0123456789abcdef01234567' } },
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) => listeners.set(event, listener)),
      emit: jest.fn(),
      listener: (event: string) => listeners.get(event)!,
    }
  }

  it('rejects operator objects without calling the handler', async () => {
    const socket = fakeSocket()
    const handler = jest.fn().mockResolvedValue({})
    registerSocketEvent(socket as never, 'joinRoom', joinRoomEventSchema, handler)
    const callback = jest.fn()

    socket.listener('joinRoom')({ gameId: { $ne: null } }, callback)
    await new Promise((resolve) => setImmediate(resolve))

    expect(handler).not.toHaveBeenCalled()
    expect(callback).toHaveBeenCalledWith({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } })
  })

  it('uses the unified success acknowledgement shape', async () => {
    const socket = fakeSocket()
    const gameId = 'abcdef0123456789abcdef01'
    registerSocketEvent(socket as never, 'joinRoom', joinRoomEventSchema, async () => ({ game: { _id: gameId } }))
    const callback = jest.fn()

    socket.listener('joinRoom')({ gameId }, callback)
    await new Promise((resolve) => setImmediate(resolve))

    expect(callback).toHaveBeenCalledWith({ ok: true, data: { game: { _id: gameId } } })
  })

  it('acknowledges missing and extra payload arguments as sanitized validation failures', async () => {
    const socket = fakeSocket()
    const handler = jest.fn().mockResolvedValue({})
    registerSocketEvent(socket as never, 'joinRoom', joinRoomEventSchema, handler)
    const missingPayloadCallback = jest.fn()
    const extraPayloadCallback = jest.fn()

    socket.listener('joinRoom')(missingPayloadCallback)
    socket.listener('joinRoom')({ gameId: 'abcdef0123456789abcdef01' }, { extra: true }, extraPayloadCallback)
    await new Promise((resolve) => setImmediate(resolve))

    const failure = { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } }
    expect(missingPayloadCallback).toHaveBeenCalledWith(failure)
    expect(extraPayloadCallback).toHaveBeenCalledWith(failure)
    expect(handler).not.toHaveBeenCalled()
  })

  it('sanitizes unknown failures and preserves safe application errors', () => {
    expect(socketFailure(new Error('database credentials leaked'))).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Request failed' },
    })
    expect(socketFailure(new AppError('Game state changed', 409, 'GAME_STATE_CONFLICT'))).toEqual({
      ok: false,
      error: { code: 'GAME_STATE_CONFLICT', message: 'Game state changed' },
    })
  })
})

describe('socket session lifetime', () => {
  it('disconnects no later than token expiry and fails closed without an expiry claim', () => {
    const now = 1_000_000

    expect(getSocketSessionExpiryDelay({ userId: 'user1', username: 'alice', exp: (now + 5_000) / 1_000 }, now)).toBe(5_000)
    expect(getSocketSessionExpiryDelay({ userId: 'user1', username: 'alice', exp: (now - 1) / 1_000 }, now)).toBe(0)
    expect(getSocketSessionExpiryDelay({ userId: 'user1', username: 'alice' }, now)).toBe(0)
    expect(getSocketSessionExpiryDelay({ userId: 'user1', username: 'alice', exp: Number.POSITIVE_INFINITY }, now)).toBe(0)
  })
})

describe('proxy trust boundary', () => {
  function handshakeRequest(remoteAddress: string, forwardedFor?: string) {
    return {
      socket: { remoteAddress },
      headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    }
  }

  it('ignores forwarding headers from directly connected public peers', () => {
    expect(getHandshakeIp(handshakeRequest('203.0.113.20', '198.51.100.9') as never)).toBe('203.0.113.20')
    expect(isTrustedProxyAddress('203.0.113.20')).toBe(false)
  })

  it('uses only the rightmost address from one trusted loopback or Docker bridge hop', () => {
    expect(getHandshakeIp(handshakeRequest('::ffff:172.18.0.1', '192.0.2.99, 198.51.100.7') as never)).toBe('198.51.100.7')
    expect(getHandshakeIp(handshakeRequest('127.0.0.1', '198.51.100.8') as never)).toBe('198.51.100.8')
    expect(trustImmediateProxy('172.18.0.1', 0)).toBe(true)
    expect(trustImmediateProxy('172.18.0.1', 1)).toBe(false)
  })
})
