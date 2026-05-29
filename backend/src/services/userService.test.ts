import { buildGlobalLeaderboard, buildSinglePlayerScoreLeaderboard } from './userService'

describe('buildGlobalLeaderboard', () => {
  it('counts wins across all completed games and ranks users by wins', () => {
    const leaderboard = buildGlobalLeaderboard([
      {
        players: [
          { userId: 'u1', username: 'alice' },
          { userId: 'u2', username: 'bob' },
        ],
        result: { winner: 'u1', winnerName: 'alice', isDraw: false },
      },
      {
        players: [
          { userId: 'u1', username: 'alice' },
          { userId: 'u3', username: 'carol' },
        ],
        result: { winner: 'u1', winnerName: 'alice', isDraw: false },
      },
      {
        players: [
          { userId: 'u2', username: 'bob' },
          { userId: 'u3', username: 'carol' },
        ],
        result: { winner: 'u2', winnerName: 'bob', isDraw: false },
      },
    ])

    expect(leaderboard).toEqual([
      { rank: 1, username: 'alice', wins: 2, losses: 0, winRate: 1 },
      { rank: 2, username: 'bob', wins: 1, losses: 1, winRate: 0.5 },
      { rank: 3, username: 'carol', wins: 0, losses: 2, winRate: 0 },
    ])
  })

  it('ignores draws when building the leaderboard', () => {
    const leaderboard = buildGlobalLeaderboard([
      {
        players: [
          { userId: 'u1', username: 'alice' },
          { userId: 'u2', username: 'bob' },
        ],
        result: { winner: 'u1', winnerName: 'alice', isDraw: false },
      },
      {
        players: [
          { userId: 'u1', username: 'alice' },
          { userId: 'u2', username: 'bob' },
        ],
        result: { isDraw: true },
      },
    ])

    expect(leaderboard).toEqual([
      { rank: 1, username: 'alice', wins: 1, losses: 0, winRate: 1 },
      { rank: 2, username: 'bob', wins: 0, losses: 1, winRate: 0 },
    ])
  })

  it('counts a resignation-style result as a win for the opponent and a loss for the resigning player', () => {
    const leaderboard = buildGlobalLeaderboard([
      {
        players: [
          { userId: 'u1', username: 'alice' },
          { userId: 'u2', username: 'bob' },
        ],
        result: { winner: 'u2', winnerName: 'bob', isDraw: false },
      },
    ])

    expect(leaderboard).toEqual([
      { rank: 1, username: 'bob', wins: 1, losses: 0, winRate: 1 },
      { rank: 2, username: 'alice', wins: 0, losses: 1, winRate: 0 },
    ])
  })

  it('counts losses for every non-winning player in multiplayer games', () => {
    const leaderboard = buildGlobalLeaderboard([
      {
        players: [
          { userId: 'u1', username: 'alice' },
          { userId: 'u2', username: 'bob' },
          { userId: 'u3', username: 'carol' },
        ],
        result: { winner: 'u3', winnerName: 'carol', isDraw: false },
      },
    ])

    expect(leaderboard).toEqual([
      { rank: 1, username: 'carol', wins: 1, losses: 0, winRate: 1 },
      { rank: 2, username: 'alice', wins: 0, losses: 1, winRate: 0 },
      { rank: 3, username: 'bob', wins: 0, losses: 1, winRate: 0 },
    ])
  })
})

describe('buildSinglePlayerScoreLeaderboard', () => {
  it('ranks Maze Chase by each player best score', () => {
    const leaderboard = buildSinglePlayerScoreLeaderboard('mazeChase', [
      {
        players: [{ userId: 'u1', username: 'alice' }],
        result: { winner: 'u1', winnerName: 'alice', isDraw: false, winType: 'score:120' },
      },
      {
        players: [{ userId: 'u1', username: 'alice' }],
        result: { winner: 'u1', winnerName: 'alice', isDraw: false, winType: 'score:300' },
      },
      {
        players: [{ userId: 'u2', username: 'bob' }],
        result: { winner: 'u2', winnerName: 'bob', isDraw: false, winType: 'score:220' },
      },
    ])

    expect(leaderboard).toEqual([
      expect.objectContaining({ rank: 1, username: 'alice', score: 300 }),
      expect.objectContaining({ rank: 2, username: 'bob', score: 220 }),
    ])
  })
})
