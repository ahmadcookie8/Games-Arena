import { useEffect, useRef, useCallback, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { connectSocket, disconnectSocket } from '../lib/socket'

export interface SocketAcknowledgementError {
  code: string
  message: string
}

export type SocketAcknowledgement<T> =
  | { ok: true; data: T }
  | { ok: false; error: SocketAcknowledgementError }

const ACK_TIMEOUT_MS = 10_000

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<SocketAcknowledgementError | null>(null)

  useEffect(() => {
    const socket = connectSocket()
    socketRef.current = socket
    setConnected(socket.connected)

    const handleConnect = () => {
      setConnected(true)
      setConnectionError(null)
    }
    const handleDisconnect = (reason?: string) => {
      setConnected(false)
      if (reason === 'io server disconnect') {
        setConnectionError({
          code: 'SOCKET_SESSION_ENDED',
          message: 'The server ended this live session. Refresh the page or sign in again to reconnect.',
        })
      }
    }
    const handleConnectError = (error: Error) => {
      setConnected(false)
      const normalizedError = normalizeConnectionError(error)
      setConnectionError(normalizedError)
      if (['SOCKET_CONNECTION_LIMIT', 'SOCKET_RATE_LIMITED', 'UNAUTHORIZED', 'SOCKET_ORIGIN_REJECTED'].includes(normalizedError.code)) {
        // Socket.IO otherwise retries rejected handshakes indefinitely, which
        // consumes more rate-limit capacity and hides the actionable reason.
        socket.disconnect()
      }
    }
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      disconnectSocket()
    }
  }, [])

  const emitWithAck = useCallback(<T>(event: string, data?: unknown): Promise<SocketAcknowledgement<T>> => {
    return new Promise((resolve) => {
      const socket = socketRef.current
      if (!socket?.connected) {
        resolve({
          ok: false,
          error: { code: 'SOCKET_DISCONNECTED', message: 'The live connection is unavailable. Reconnect and try again.' },
        })
        return
      }

      socket.timeout(ACK_TIMEOUT_MS).emit(
        event,
        data,
        (timeoutError: Error | null, acknowledgement?: SocketAcknowledgement<T>) => {
          if (timeoutError) {
            resolve({
              ok: false,
              error: { code: 'ACK_TIMEOUT', message: 'The server did not confirm the action in time. Try again.' },
            })
            return
          }

          if (!isSocketAcknowledgement<T>(acknowledgement)) {
            resolve({
              ok: false,
              error: { code: 'INVALID_ACK', message: 'The server returned an invalid response. Refresh and try again.' },
            })
            return
          }

          resolve(acknowledgement)
        },
      )
    })
  }, [])

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler)
    return () => {
      socketRef.current?.off(event, handler)
    }
  }, [])

  return { socket: socketRef.current, emitWithAck, on, connected, connectionError }
}

interface SocketTransportError extends Error {
  context?: { responseText?: unknown }
}

export function normalizeConnectionError(error: Error): SocketAcknowledgementError {
  const message = error.message || 'The live connection could not be established.'
  const responseMessage = readTransportResponseMessage((error as SocketTransportError).context?.responseText)
  const normalized = `${message} ${responseMessage ?? ''}`.toLowerCase()

  if (normalized.includes('too many active connections')) {
    return {
      code: 'SOCKET_CONNECTION_LIMIT',
      message: 'This account already has 10 active game connections. Leave another active game tab, then reconnect.',
    }
  }
  if (normalized.includes('rate limit')) {
    return { code: 'SOCKET_RATE_LIMITED', message: 'Too many connection attempts. Wait a moment before reconnecting.' }
  }
  if (normalized.includes('unauthorized')) {
    return { code: 'UNAUTHORIZED', message: 'Your session is no longer valid. Sign in again to reconnect.' }
  }
  if (normalized.includes('invalid origin')) {
    return { code: 'SOCKET_ORIGIN_REJECTED', message: 'This page is not authorized to open a live game connection.' }
  }
  if (normalized.includes('service unavailable')) {
    return { code: 'SOCKET_UNAVAILABLE', message: 'The live game service is temporarily unavailable.' }
  }
  return { code: 'SOCKET_CONNECT_ERROR', message }
}

function readTransportResponseMessage(responseText: unknown): string | null {
  if (typeof responseText !== 'string' || !responseText.trim()) return null
  try {
    const parsed = JSON.parse(responseText) as unknown
    if (parsed && typeof parsed === 'object' && 'message' in parsed && typeof parsed.message === 'string') {
      return parsed.message
    }
  } catch {
    // Some Engine.IO transports expose a short plain-text rejection body.
  }
  return responseText.slice(0, 256)
}

function isSocketAcknowledgement<T>(value: unknown): value is SocketAcknowledgement<T> {
  if (!value || typeof value !== 'object' || !('ok' in value)) return false
  const acknowledgement = value as { ok?: unknown; data?: unknown; error?: unknown }
  if (acknowledgement.ok === true) return 'data' in acknowledgement
  if (acknowledgement.ok !== false || !acknowledgement.error || typeof acknowledgement.error !== 'object') return false
  const error = acknowledgement.error as { code?: unknown; message?: unknown }
  return typeof error.code === 'string' && typeof error.message === 'string'
}
