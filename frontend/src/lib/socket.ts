import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null
let socketConsumers = 0

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', {
      autoConnect: false,
      withCredentials: true,
    })
  }
  return socket
}

export function connectSocket(): Socket {
  socketConsumers += 1
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket(): void {
  socketConsumers = Math.max(0, socketConsumers - 1)
  if (socketConsumers === 0) socket?.disconnect()
}
