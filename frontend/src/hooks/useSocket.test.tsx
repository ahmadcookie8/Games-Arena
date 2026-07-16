import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeConnectionError, useSocket } from './useSocket'

const mocks = vi.hoisted(() => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}))

vi.mock('../lib/socket', () => ({
  connectSocket: mocks.connectSocket,
  disconnectSocket: mocks.disconnectSocket,
}))

type SocketHandler = (...args: unknown[]) => void

function createSocketDouble() {
  const handlers = new Map<string, SocketHandler>()
  const socket = {
    connected: false,
    on: vi.fn((event: string, handler: SocketHandler) => {
      handlers.set(event, handler)
      return socket
    }),
    off: vi.fn((event: string, handler: SocketHandler) => {
      if (handlers.get(event) === handler) handlers.delete(event)
      return socket
    }),
    disconnect: vi.fn(() => socket),
    timeout: vi.fn(() => socket),
    emit: vi.fn(() => socket),
  }
  return { socket, handlers }
}

describe('live socket connection errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads a connection-limit rejection from an Engine.IO JSON response body', () => {
    const error = Object.assign(new Error('xhr poll error'), {
      context: {
        responseText: JSON.stringify({
          code: 'SOCKET_CONNECTION_LIMIT',
          message: 'Too many active connections for this account',
        }),
      },
    })

    expect(normalizeConnectionError(error)).toEqual({
      code: 'SOCKET_CONNECTION_LIMIT',
      message: 'This account already has the maximum number of live game connections. Close another game tab and reconnect.',
    })
  })

  it('stops reconnecting and surfaces the limit when a connected socket is later rejected', () => {
    const { socket, handlers } = createSocketDouble()
    mocks.connectSocket.mockReturnValue(socket)
    const { result, unmount } = renderHook(() => useSocket())

    act(() => {
      socket.connected = true
      handlers.get('connect')?.()
    })
    expect(result.current.connected).toBe(true)

    const error = Object.assign(new Error('transport rejected'), {
      context: {
        responseText: JSON.stringify({ message: 'Too many active connections for this account' }),
      },
    })
    act(() => {
      handlers.get('connect_error')?.(error)
    })

    expect(result.current.connected).toBe(false)
    expect(result.current.connectionError?.code).toBe('SOCKET_CONNECTION_LIMIT')
    expect(socket.disconnect).toHaveBeenCalledTimes(1)

    unmount()
    expect(mocks.disconnectSocket).toHaveBeenCalledTimes(1)
  })
})
