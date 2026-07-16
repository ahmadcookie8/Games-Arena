import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'
import { TicTacToeDifficulty } from '../types/game'

interface SinglePlayerLeaderboardEntry {
  rank: number
  username: string
  gameType?: 'ticTacToe' | 'snake' | 'mazeChase'
  difficulty?: TicTacToeDifficulty
  boardSize?: 'small' | 'medium' | 'large'
  wallLooping?: boolean
  score?: number
  wins: number
  losses: number
  draws: number
  gamesPlayed: number
  winRate: number
}

function getDifficultyClass(difficulty: TicTacToeDifficulty): string {
  switch (difficulty) {
    case 'hard': return 'bg-danger-subtle text-danger-text'
    case 'medium': return 'bg-warning-subtle text-warning-text'
    case 'easy': return 'bg-success-subtle text-success-text'
  }
}

export default function SinglePlayerLeaderboard() {
  const { user } = useAuth()
  const [ticTacToeEntries, setTicTacToeEntries] = useState<SinglePlayerLeaderboardEntry[]>([])
  const [snakeEntries, setSnakeEntries] = useState<SinglePlayerLeaderboardEntry[]>([])
  const [mazeEntries, setMazeEntries] = useState<SinglePlayerLeaderboardEntry[]>([])

  const fetchLeaderboard = useCallback(() => {
    void Promise.allSettled([
      api.get('/api/leaderboards/single-player/ticTacToe'),
      api.get('/api/leaderboards/single-player/snake'),
      api.get('/api/leaderboards/single-player/mazeChase'),
    ]).then(([ticTacToe, snake, maze]) => {
      setTicTacToeEntries(ticTacToe.status === 'fulfilled' ? ticTacToe.value.data.leaderboard || [] : [])
      setSnakeEntries(snake.status === 'fulfilled' ? snake.value.data.leaderboard || [] : [])
      setMazeEntries(maze.status === 'fulfilled' ? maze.value.data.leaderboard || [] : [])
    })
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  return (
    <div className="rounded-2xl border border-border/90 bg-surface/92 p-4 shadow-sm backdrop-blur-xl">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text-primary">Solo High Scores</h3>
        <p className="text-xs text-text-muted">Only server-verified results are ranked.</p>
      </div>

      <div className="mb-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Tic Tac Toe</h4>
        <div className="space-y-1">
        {ticTacToeEntries.map((entry) => (
          <div
            key={`ttt-${entry.rank}-${entry.username}-${entry.difficulty}`}
            className={`flex items-center gap-2 rounded-lg px-2 py-2 transition-colors duration-150 ${entry.username === user?.username ? 'bg-accent-subtle' : 'hover:bg-elevated'}`}
          >
            <span className="w-7 text-center text-sm text-text-muted">#{entry.rank}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{entry.username}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getDifficultyClass(entry.difficulty || 'easy')}`}>{entry.difficulty || 'easy'}</span>
            <span className="text-sm font-medium text-success">{entry.wins}W</span>
            <span className="font-mono text-xs text-text-muted">{(entry.winRate * 100).toFixed(0)}%</span>
          </div>
        ))}
        {ticTacToeEntries.length === 0 && <p className="rounded-lg bg-page px-3 py-4 text-center text-sm text-text-muted">No Tic Tac Toe scores yet</p>}
        </div>
      </div>

      <div className="mb-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Snake</h4>
        <div className="space-y-1">
          {snakeEntries.map((entry) => (
            <div
              key={`snake-${entry.rank}-${entry.username}-${entry.boardSize}-${entry.wallLooping}`}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 transition-colors duration-150 ${entry.username === user?.username ? 'bg-accent-subtle' : 'hover:bg-elevated'}`}
            >
              <span className="w-7 text-center text-sm text-text-muted">#{entry.rank}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{entry.username}</span>
              <span className="rounded-full bg-overlay px-2 py-0.5 text-xs font-medium capitalize text-text-secondary">
                {entry.boardSize || 'medium'} · {entry.wallLooping ? 'loop' : 'solid'}
              </span>
              <span className="font-mono text-sm font-semibold text-success">{entry.score || 0}</span>
            </div>
          ))}
          {snakeEntries.length === 0 && <p className="rounded-lg bg-page px-3 py-4 text-center text-sm text-text-muted">No verified Snake scores yet</p>}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Maze Chase</h4>
        <div className="space-y-1">
          {mazeEntries.map((entry) => (
            <div
              key={`maze-${entry.rank}-${entry.username}`}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 transition-colors duration-150 ${entry.username === user?.username ? 'bg-accent-subtle' : 'hover:bg-elevated'}`}
            >
              <span className="w-7 text-center text-sm text-text-muted">#{entry.rank}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{entry.username}</span>
              <span className="font-mono text-sm font-semibold text-success">{entry.score || 0}</span>
            </div>
          ))}
          {mazeEntries.length === 0 && <p className="rounded-lg bg-page px-3 py-4 text-center text-sm text-text-muted">No verified Maze Chase scores yet</p>}
        </div>
      </div>
    </div>
  )
}
