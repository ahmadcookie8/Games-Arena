import { useCallback, useEffect, useState } from 'react'
import { Bot, Crown, RefreshCw, Trophy } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import api from '../lib/api'
import type { TicTacToeDifficulty } from '../types/game'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  SegmentedControl,
  Skeleton,
} from './ui'

type SoloLeaderboardGame = 'ticTacToe' | 'snake' | 'mazeChase'

interface SinglePlayerLeaderboardEntry {
  rank: number
  username: string
  gameType?: SoloLeaderboardGame
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

const EMPTY_ENTRIES: Record<SoloLeaderboardGame, SinglePlayerLeaderboardEntry[]> = {
  ticTacToe: [],
  snake: [],
  mazeChase: [],
}

export default function SinglePlayerLeaderboard() {
  const { user } = useAuth()
  const { on } = useSocket()
  const [activeGame, setActiveGame] = useState<SoloLeaderboardGame>('ticTacToe')
  const [entries, setEntries] = useState<Record<SoloLeaderboardGame, SinglePlayerLeaderboardEntry[]>>(EMPTY_ENTRIES)
  const [failedGames, setFailedGames] = useState<Set<SoloLeaderboardGame>>(() => new Set())
  const [isLoading, setIsLoading] = useState(true)

  const fetchLeaderboard = useCallback(async (background = false) => {
    if (!background) setIsLoading(true)
    const gameTypes: SoloLeaderboardGame[] = ['ticTacToe', 'snake', 'mazeChase']
    const results = await Promise.allSettled(
      gameTypes.map((gameType) => api.get<{ leaderboard?: SinglePlayerLeaderboardEntry[] }>(`/api/leaderboards/single-player/${gameType}`)),
    )

    const nextEntries = { ...EMPTY_ENTRIES }
    const nextFailed = new Set<SoloLeaderboardGame>()
    results.forEach((result, index) => {
      const gameType = gameTypes[index]
      if (result.status === 'fulfilled') nextEntries[gameType] = result.value.data.leaderboard || []
      else nextFailed.add(gameType)
    })
    setEntries(nextEntries)
    setFailedGames(nextFailed)
    if (!background) setIsLoading(false)
  }, [])

  useEffect(() => {
    void fetchLeaderboard()
  }, [fetchLeaderboard])

  useEffect(() => on('gamesChanged', () => {
    void fetchLeaderboard(true)
  }), [fetchLeaderboard, on])

  const activeEntries = entries[activeGame]
  const activeFailed = failedGames.has(activeGame)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy size={17} aria-hidden="true" /> Solo high scores
            </CardTitle>
            <CardDescription>Only server-reproduced results rank</CardDescription>
          </div>
          <Badge variant="success">Verified</Badge>
        </div>
        <SegmentedControl
          ariaLabel="Solo leaderboard game"
          value={activeGame}
          onValueChange={(value) => {
            if (value === 'ticTacToe' || value === 'snake' || value === 'mazeChase') setActiveGame(value)
          }}
          items={[
            { value: 'ticTacToe', label: 'Tic Tac Toe' },
            { value: 'snake', label: 'Snake' },
            { value: 'mazeChase', label: 'Maze' },
          ]}
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LeaderboardSkeleton />
        ) : activeFailed ? (
          <EmptyState
            title="Scores unavailable"
            description="This ranking could not refresh."
            action={(
              <Button variant="secondary" size="sm" onClick={() => { void fetchLeaderboard() }}>
                <RefreshCw size={14} aria-hidden="true" /> Retry
              </Button>
            )}
            className="min-h-48 bg-elevated/60"
          />
        ) : activeEntries.length === 0 ? (
          <EmptyState
            icon={<Bot aria-hidden="true" />}
            title="No verified scores yet"
            description="Complete a fresh verified run to take the first spot."
            className="min-h-48 bg-elevated/60"
          />
        ) : (
          <ol className="space-y-1.5" aria-label={`${getGameLabel(activeGame)} rankings`}>
            {activeEntries.map((entry) => (
              <li
                key={`${activeGame}:${entry.rank}:${entry.username}:${entry.difficulty || entry.boardSize || ''}:${entry.wallLooping || false}`}
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors duration-180 ${entry.username === user?.username ? 'border-accent-muted bg-accent-subtle' : 'border-transparent hover:border-border hover:bg-elevated'}`}
              >
                <Rank rank={entry.rank} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
                  {entry.username}{entry.username === user?.username && <span className="sr-only"> (you)</span>}
                </span>
                <EntryMetric entry={entry} gameType={activeGame} />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function EntryMetric({ entry, gameType }: { entry: SinglePlayerLeaderboardEntry; gameType: SoloLeaderboardGame }) {
  if (gameType === 'ticTacToe') {
    return (
      <div className="flex items-center gap-1.5">
        <DifficultyBadge difficulty={entry.difficulty || 'easy'} />
        <span className="font-mono text-xs font-semibold text-success-text">{entry.wins}W</span>
        <span className="w-9 text-right font-mono text-[0.7rem] text-text-muted">{Math.round((entry.winRate || 0) * 100)}%</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {gameType === 'snake' && (
        <span className="hidden text-[0.68rem] font-medium capitalize text-text-muted sm:inline">
          {entry.boardSize || 'medium'} · {entry.wallLooping ? 'loop' : 'solid'}
        </span>
      )}
      <span className="font-mono text-sm font-bold text-success-text">{entry.score || 0}</span>
    </div>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: TicTacToeDifficulty }) {
  const variant = difficulty === 'hard' ? 'danger' : difficulty === 'medium' ? 'warning' : 'success'
  return <Badge variant={variant} className="capitalize">{difficulty}</Badge>
}

function Rank({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-warning-subtle text-warning-text" aria-label="Rank 1">
        <Crown size={15} aria-hidden="true" />
      </span>
    )
  }
  return <span className="w-7 shrink-0 text-center font-mono text-xs font-semibold text-text-muted" aria-label={`Rank ${rank}`}>#{rank}</span>
}

function getGameLabel(gameType: SoloLeaderboardGame): string {
  if (gameType === 'ticTacToe') return 'Tic Tac Toe'
  return gameType === 'mazeChase' ? 'Maze Chase' : 'Snake'
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading solo rankings" aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-11 rounded-xl" />)}
    </div>
  )
}
