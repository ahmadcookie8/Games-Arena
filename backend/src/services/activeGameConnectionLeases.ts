import {
  acquireRedisConcurrencySlot,
  releaseRedisConcurrencySlot,
} from '../middleware/rateLimit'
import { AppError } from '../utils/errors'

export const MAX_ACTIVE_GAME_CONNECTIONS_PER_USER = 10
export const ACTIVE_GAME_CONNECTION_LEASE_TTL_SECONDS = 2 * 60

const ACTIVE_GAME_CONNECTION_SCOPE = 'socket-active-game-user'

export interface ActiveGameConnectionLease {
  socketId: string
  userId: string
  gameId: string
}

interface ActiveGameConnectionLeaseStore {
  acquire(userId: string, socketId: string): Promise<{ allowed: boolean; count: number }>
  release(userId: string, socketId: string): Promise<void>
}

const redisLeaseStore: ActiveGameConnectionLeaseStore = {
  acquire: (userId, socketId) => acquireRedisConcurrencySlot(
    ACTIVE_GAME_CONNECTION_SCOPE,
    userId,
    socketId,
    MAX_ACTIVE_GAME_CONNECTIONS_PER_USER,
    ACTIVE_GAME_CONNECTION_LEASE_TTL_SECONDS
  ),
  release: (userId, socketId) => releaseRedisConcurrencySlot(
    ACTIVE_GAME_CONNECTION_SCOPE,
    userId,
    socketId
  ),
}

/**
 * Tracks the one active-game concurrency lease a Socket.IO connection may own.
 * Redis is the cross-process authority; the local indexes let terminal game
 * transitions release every lease associated with that game immediately.
 */
export class ActiveGameConnectionLeaseManager {
  private readonly leasesBySocket = new Map<string, ActiveGameConnectionLease>()
  private readonly socketIdsByGame = new Map<string, Set<string>>()

  constructor(private readonly store: ActiveGameConnectionLeaseStore = redisLeaseStore) {}

  get(socketId: string): ActiveGameConnectionLease | undefined {
    const lease = this.leasesBySocket.get(socketId)
    return lease ? { ...lease } : undefined
  }

  has(socketId: string): boolean {
    return this.leasesBySocket.has(socketId)
  }

  /** Acquire a new slot or reuse this socket's existing slot for another active game. */
  async activate(socketId: string, userId: string, gameId: string): Promise<ActiveGameConnectionLease> {
    const existing = this.leasesBySocket.get(socketId)
    if (existing && existing.userId !== userId) {
      throw new AppError('Connection identity changed', 401, 'UNAUTHORIZED')
    }

    let result
    try {
      result = await this.store.acquire(userId, socketId)
    } catch {
      throw new AppError('Service temporarily unavailable', 503, 'SOCKET_CONNECTION_LIMIT_UNAVAILABLE')
    }

    if (!result.allowed) {
      if (existing) this.removeLocal(existing)
      throw new AppError(
        `You can have at most ${MAX_ACTIVE_GAME_CONNECTIONS_PER_USER} active game connections`,
        429,
        'SOCKET_CONNECTION_LIMIT'
      )
    }

    if (existing && existing.gameId !== gameId) this.removeFromGameIndex(existing)

    const lease = { socketId, userId, gameId }
    this.leasesBySocket.set(socketId, lease)
    let socketIds = this.socketIdsByGame.get(gameId)
    if (!socketIds) {
      socketIds = new Set<string>()
      this.socketIdsByGame.set(gameId, socketIds)
    }
    socketIds.add(socketId)
    return { ...lease }
  }

  /** Refresh only an existing active lease. A false result means the slot was lost. */
  async refresh(socketId: string): Promise<boolean> {
    const lease = this.leasesBySocket.get(socketId)
    if (!lease) return true

    let result
    try {
      result = await this.store.acquire(lease.userId, socketId)
    } catch {
      throw new AppError('Service temporarily unavailable', 503, 'SOCKET_CONNECTION_LIMIT_UNAVAILABLE')
    }

    const current = this.leasesBySocket.get(socketId)
    if (!current) {
      try {
        await this.store.release(lease.userId, socketId)
      } catch {
        // The stale Redis member expires after the bounded lease TTL.
      }
      return true
    }

    if (!result.allowed) {
      this.removeLocal(current)
      return false
    }
    return true
  }

  async releaseSocket(socketId: string): Promise<boolean> {
    const lease = this.leasesBySocket.get(socketId)
    if (!lease) return false

    // Remove locally before I/O so heartbeats and terminal notifications cannot
    // renew a lease that is already being released.
    this.removeLocal(lease)
    await this.store.release(lease.userId, socketId)
    return true
  }

  async releaseGame(gameId: string): Promise<number> {
    const socketIds = [...(this.socketIdsByGame.get(gameId) || [])]
    if (socketIds.length === 0) return 0

    const leases = socketIds
      .map((socketId) => this.leasesBySocket.get(socketId))
      .filter((lease): lease is ActiveGameConnectionLease => Boolean(lease && lease.gameId === gameId))

    for (const lease of leases) this.removeLocal(lease)
    const results = await Promise.allSettled(
      leases.map((lease) => this.store.release(lease.userId, lease.socketId))
    )
    if (results.some((result) => result.status === 'rejected')) {
      throw new AppError('Service temporarily unavailable', 503, 'SOCKET_CONNECTION_LIMIT_UNAVAILABLE')
    }
    return leases.length
  }

  private removeLocal(lease: ActiveGameConnectionLease): void {
    if (this.leasesBySocket.get(lease.socketId) === lease) {
      this.leasesBySocket.delete(lease.socketId)
    }
    this.removeFromGameIndex(lease)
  }

  private removeFromGameIndex(lease: ActiveGameConnectionLease): void {
    const socketIds = this.socketIdsByGame.get(lease.gameId)
    if (!socketIds) return
    socketIds.delete(lease.socketId)
    if (socketIds.size === 0) this.socketIdsByGame.delete(lease.gameId)
  }
}

export const activeGameConnectionLeases = new ActiveGameConnectionLeaseManager()
