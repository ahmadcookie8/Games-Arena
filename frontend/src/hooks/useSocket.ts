import { useEffect, useRef, useCallback } from 'react'
import { Socket } from 'socket.io-client'
import { connectSocket, disconnectSocket } from '../lib/socket'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    socketRef.current = connectSocket()

    return () => {
      disconnectSocket()
    }
  }, [])

  const emit = useCallback(<T>(event: string, data?: unknown, callback?: (response: T) => void) => {
    socketRef.current?.emit(event, data, callback)
  }, [])

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler)
    return () => {
      socketRef.current?.off(event, handler)
    }
  }, [])

  return { socket: socketRef.current, emit, on }
}
