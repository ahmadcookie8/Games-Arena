import { reconcileVerifiedStats } from './statsReconciliation'

describe('reconcileVerifiedStats', () => {
  it('only counts verified multiplayer results', () => {
    const stats = reconcileVerifiedStats([
      {
        players: [{ userId: 'a' }, { userId: 'b' }],
        metadata: { mode: 'multiplayer' },
        result: { winner: 'a', isDraw: false, verification: 'server' },
      },
      {
        players: [{ userId: 'a' }, { userId: 'b' }],
        metadata: { mode: 'multiplayer' },
        result: { winner: 'b', isDraw: false, verification: 'unverified' },
      },
      {
        players: [{ userId: 'a' }],
        metadata: { mode: 'singlePlayer' },
        result: { winner: 'a', isDraw: false, verification: 'server' },
      },
    ])

    expect(stats.get('a')).toEqual({ gamesPlayed: 1, gamesWon: 1, gamesLost: 0, gamesDraw: 0, winRate: 1 })
    expect(stats.get('b')).toEqual({ gamesPlayed: 1, gamesWon: 0, gamesLost: 1, gamesDraw: 0, winRate: 0 })
  })

  it('counts verified draws once per distinct participant', () => {
    const stats = reconcileVerifiedStats([{
      players: [{ userId: 'a' }, { userId: 'a' }, { userId: 'b' }],
      result: { isDraw: true, verification: 'replay' },
    }])

    expect(stats.get('a')?.gamesDraw).toBe(1)
    expect(stats.get('b')?.gamesDraw).toBe(1)
  })

  it('ignores malformed winners and does not create partial statistics', () => {
    const stats = reconcileVerifiedStats([
      {
        players: [{ userId: 'a' }, { userId: 'b' }],
        result: { winner: 'attacker', isDraw: false, verification: 'server' },
      },
      {
        players: [{ userId: 'a' }],
        result: { winner: 'a', isDraw: false, verification: 'server' },
      },
    ])

    expect(stats.size).toBe(0)
  })

  it('is deterministic and does not mutate migration input', () => {
    const games = [{
      players: [{ userId: 'a' }, { userId: 'b' }],
      result: { winner: 'b', isDraw: false, verification: 'server' as const },
    }]
    const before = JSON.stringify(games)

    const first = reconcileVerifiedStats(games)
    const second = reconcileVerifiedStats(games)

    expect(Array.from(second.entries())).toEqual(Array.from(first.entries()))
    expect(JSON.stringify(games)).toBe(before)
  })
})
