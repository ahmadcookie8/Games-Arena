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

  useEffect(() => {
    const socket = connectSocket()
    socketRef.current = socket
    setConnected(socket.connected)

    const handleConnect = () => setConnected(true)
    const handleDisconnect = () => setConnected(false)
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
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

  return { socket: socketRef.current, emitWithAck, on, connected }
}

function isSocketAcknowledgement<T>(value: unknown): value is SocketAcknowledgement<T> {
  if (!value || typeof value !== 'object' || !('ok' in value)) return false
  const acknowledgement = value as { ok?: unknown; data?: unknown; error?: unknown }
  if (acknowledgement.ok === true) return 'data' in acknowledgement
  if (acknowledgement.ok !== false || !acknowledgement.error || typeof acknowledgement.error !== 'object') return false
  const error = acknowledgement.error as { code?: unknown; message?: unknown }
  return typeof error.code === 'string' && typeof error.message === 'string'
}
