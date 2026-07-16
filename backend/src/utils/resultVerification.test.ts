import {
  classifyLegacyResult,
  isReplayLeaderboardEnabled,
  multiplayerModeFilter,
  replayVerifiedResultFilter,
  verifiedResultFilter,
} from './resultVerification'

describe('classifyLegacyResult', () => {
  it('trusts an internally consistent multiplayer server result', () => {
    expect(classifyLegacyResult({
      status: 'completed',
      gameType: 'ticTacToe',
      players: [{ userId: 'a' }, { userId: 'b' }],
      result: { winner: 'a', isDraw: false, winType: 'three_in_a_row' },
    })).toBe('server')
  })

  it('does not trust historical resignations or client-simulated scores', () => {
    expect(classifyLegacyResult({
      status: 'completed',
      gameType: 'ticTacToe',
      players: [{ userId: 'a' }, { userId: 'b' }],
      result: { winner: 'a', isDraw: false, winType: 'resignation' },
    })).toBe('unverified')

    expect(classifyLegacyResult({
      status: 'completed',
      gameType: 'snake',
      metadata: { mode: 'singlePlayer' },
      players: [{ userId: 'a' }],
      result: { winner: 'a', isDraw: false, winType: 'score:999999' },
    })).toBe('unverified')
  })

  it('does not overwrite an explicit classification', () => {
    expect(classifyLegacyResult({
      status: 'completed',
      gameType: 'snake',
      metadata: { mode: 'singlePlayer' },
      result: { isDraw: false, verification: 'replay' },
    })).toBe('replay')
  })

  it('rejects inconsistent multiplayer winners', () => {
    expect(classifyLegacyResult({
      status: 'completed',
      gameType: 'ticTacToe',
      players: [{ userId: 'a' }, { userId: 'b' }],
      result: { winner: 'attacker', isDraw: false, winType: 'three_in_a_row' },
    })).toBe('unverified')
  })

  it('classifies a missing legacy mode as multiplayer only when the result is internally consistent', () => {
    expect(classifyLegacyResult({
      status: 'completed',
      gameType: 'checkers',
      players: [{ userId: 'a' }, { userId: 'b' }],
      result: { winner: 'b', isDraw: false },
    })).toBe('server')

    expect(classifyLegacyResult({
      status: 'completed',
      gameType: 'checkers',
      players: [{ userId: 'a' }],
      result: { winner: 'a', isDraw: false },
    })).toBe('unverified')
  })

  it('rejects malformed draws and incomplete records', () => {
    expect(classifyLegacyResult({
      status: 'completed',
      players: [{ userId: 'a' }, { userId: 'b' }],
      result: { winner: 'a', isDraw: true },
    })).toBe('unverified')

    expect(classifyLegacyResult({
      status: 'active',
      players: [{ userId: 'a' }, { userId: 'b' }],
      result: { winner: 'a', isDraw: false },
    })).toBe('unverified')

    expect(classifyLegacyResult({
      status: 'completed',
      players: [{ userId: 'a' }, { userId: 'b' }],
    })).toBe('unverified')
  })
})

describe('public leaderboard query filters', () => {
  it('requires explicit verification and excludes known single-player records', () => {
    expect(verifiedResultFilter).toEqual({
      'result.verification': { $in: ['server', 'replay'] },
    })
    expect(multiplayerModeFilter).toEqual({
      $or: [
        { 'metadata.mode': 'multiplayer' },
        { 'metadata.mode': { $exists: false } },
      ],
    })
    expect(replayVerifiedResultFilter).toEqual({ 'result.verification': 'replay' })
  })
})

describe('isReplayLeaderboardEnabled', () => {
  it('enables only game types with trusted completion paths', () => {
    expect(isReplayLeaderboardEnabled('snake')).toBe(true)
    expect(isReplayLeaderboardEnabled('mazeChase')).toBe(true)
    expect(isReplayLeaderboardEnabled('ticTacToe')).toBe(true)
    expect(isReplayLeaderboardEnabled('unknown')).toBe(false)
  })
})
