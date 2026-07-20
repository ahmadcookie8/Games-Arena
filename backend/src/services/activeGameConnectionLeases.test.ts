import {
  ActiveGameConnectionLeaseManager,
  MAX_ACTIVE_GAME_CONNECTIONS_PER_USER,
} from './activeGameConnectionLeases'

class MemoryLeaseStore {
  readonly slotsByUser = new Map<string, Set<string>>()
  acquireCalls: Array<{ userId: string; socketId: string }> = []
  releaseCalls: Array<{ userId: string; socketId: string }> = []
  acquireError: Error | null = null
  releaseError: Error | null = null

  async acquire(userId: string, socketId: string): Promise<{ allowed: boolean; count: number }> {
    this.acquireCalls.push({ userId, socketId })
    if (this.acquireError) throw this.acquireError
    let slots = this.slotsByUser.get(userId)
    if (!slots) {
      slots = new Set<string>()
      this.slotsByUser.set(userId, slots)
    }
    if (slots.has(socketId)) return { allowed: true, count: slots.size }
    if (slots.size >= MAX_ACTIVE_GAME_CONNECTIONS_PER_USER) {
      return { allowed: false, count: slots.size }
    }
    slots.add(socketId)
    return { allowed: true, count: slots.size }
  }

  async release(userId: string, socketId: string): Promise<void> {
    this.releaseCalls.push({ userId, socketId })
    if (this.releaseError) throw this.releaseError
    this.slotsByUser.get(userId)?.delete(socketId)
  }
}

describe('active-game connection leases', () => {
  it('allows ten active socket leases for a user and rejects the eleventh', async () => {
    const store = new MemoryLeaseStore()
    const manager = new ActiveGameConnectionLeaseManager(store)

    for (let index = 0; index < MAX_ACTIVE_GAME_CONNECTIONS_PER_USER; index += 1) {
      await expect(manager.activate(`socket-${index}`, 'user-1', `game-${index}`)).resolves.toMatchObject({
        socketId: `socket-${index}`,
        userId: 'user-1',
      })
    }

    await expect(manager.activate('socket-over-limit', 'user-1', 'game-over-limit')).rejects.toMatchObject({
      code: 'SOCKET_CONNECTION_LIMIT',
      statusCode: 429,
    })
    expect(store.slotsByUser.get('user-1')?.size).toBe(MAX_ACTIVE_GAME_CONNECTIONS_PER_USER)
  })

  it('reuses one slot when the same socket moves between active games', async () => {
    const store = new MemoryLeaseStore()
    const manager = new ActiveGameConnectionLeaseManager(store)

    await manager.activate('socket-1', 'user-1', 'game-1')
    await manager.activate('socket-1', 'user-1', 'game-2')

    expect(store.slotsByUser.get('user-1')).toEqual(new Set(['socket-1']))
    expect(manager.get('socket-1')).toEqual({ socketId: 'socket-1', userId: 'user-1', gameId: 'game-2' })
    expect(await manager.releaseGame('game-1')).toBe(0)
    expect(await manager.releaseGame('game-2')).toBe(1)
    expect(store.slotsByUser.get('user-1')).toEqual(new Set())
  })

  it('releases every locally joined socket for a terminal game without touching other games', async () => {
    const store = new MemoryLeaseStore()
    const manager = new ActiveGameConnectionLeaseManager(store)
    await manager.activate('socket-1', 'user-1', 'game-terminal')
    await manager.activate('socket-2', 'user-2', 'game-terminal')
    await manager.activate('socket-3', 'user-1', 'game-active')

    await expect(manager.releaseGame('game-terminal')).resolves.toBe(2)

    expect(manager.has('socket-1')).toBe(false)
    expect(manager.has('socket-2')).toBe(false)
    expect(manager.has('socket-3')).toBe(true)
    expect(store.releaseCalls).toEqual(expect.arrayContaining([
      { userId: 'user-1', socketId: 'socket-1' },
      { userId: 'user-2', socketId: 'socket-2' },
    ]))
  })

  it('makes explicit leave idempotent and frees capacity immediately', async () => {
    const store = new MemoryLeaseStore()
    const manager = new ActiveGameConnectionLeaseManager(store)
    await manager.activate('socket-1', 'user-1', 'game-1')

    await expect(manager.releaseSocket('socket-1')).resolves.toBe(true)
    await expect(manager.releaseSocket('socket-1')).resolves.toBe(false)
    await expect(manager.activate('replacement', 'user-1', 'game-2')).resolves.toBeDefined()

    expect(store.releaseCalls).toEqual([{ userId: 'user-1', socketId: 'socket-1' }])
  })

  it('refreshes only sockets that currently own an active-game lease', async () => {
    const store = new MemoryLeaseStore()
    const manager = new ActiveGameConnectionLeaseManager(store)

    await expect(manager.refresh('idle-socket')).resolves.toBe(true)
    expect(store.acquireCalls).toHaveLength(0)

    await manager.activate('active-socket', 'user-1', 'game-1')
    store.acquireCalls = []
    await expect(manager.refresh('active-socket')).resolves.toBe(true)
    expect(store.acquireCalls).toEqual([{ userId: 'user-1', socketId: 'active-socket' }])

    await manager.releaseSocket('active-socket')
    store.acquireCalls = []
    await expect(manager.refresh('active-socket')).resolves.toBe(true)
    expect(store.acquireCalls).toHaveLength(0)
  })

  it('fails closed on acquisition errors while local release stays final when Redis release fails', async () => {
    const unavailableStore = new MemoryLeaseStore()
    unavailableStore.acquireError = new Error('redis unavailable')
    const unavailableManager = new ActiveGameConnectionLeaseManager(unavailableStore)
    await expect(unavailableManager.activate('socket-1', 'user-1', 'game-1')).rejects.toMatchObject({
      code: 'SOCKET_CONNECTION_LIMIT_UNAVAILABLE',
      statusCode: 503,
    })

    const releaseStore = new MemoryLeaseStore()
    const releaseManager = new ActiveGameConnectionLeaseManager(releaseStore)
    await releaseManager.activate('socket-1', 'user-1', 'game-1')
    releaseStore.releaseError = new Error('redis unavailable')
    await expect(releaseManager.releaseSocket('socket-1')).rejects.toThrow('redis unavailable')
    expect(releaseManager.has('socket-1')).toBe(false)
    await expect(releaseManager.releaseSocket('socket-1')).resolves.toBe(false)
  })
})
