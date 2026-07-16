import { useCallback, useEffect, useState } from 'react'
import { Crown, RefreshCw, Trophy } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import api from '../lib/api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from './ui'

interface LeaderboardEntry {
  rank: number
  username: string
  wins: number
  losses: number
  winRate: number
}

export default function Leaderboard() {
  const { user } = useAuth()
  const { on } = useSocket()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const fetchLeaderboard = useCallback(async (background = false) => {
    if (!background) setIsLoading(true)
    try {
      const response = await api.get<{ leaderboard?: LeaderboardEntry[]; global?: LeaderboardEntry[] }>('/api/leaderboards')
      setEntries(response.data.leaderboard || response.data.global || [])
      setHasError(false)
    } catch {
      if (!background) setHasError(true)
    } finally {
      if (!background) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLeaderboard()
  }, [fetchLeaderboard])

  useEffect(() => on('gamesChanged', () => {
    void fetchLeaderboard(true)
  }), [fetchLeaderboard, on])

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Trophy size={17} aria-hidden="true" /> Arena leaders
          </CardTitle>
          <CardDescription>Verified multiplayer wins</CardDescription>
        </div>
        <Badge variant="accent">Global</Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LeaderboardSkeleton />
        ) : hasError ? (
          <EmptyState
            title="Rankings unavailable"
            description="The leaderboard could not refresh."
            action={(
              <Button variant="secondary" size="sm" onClick={() => { void fetchLeaderboard() }}>
                <RefreshCw size={14} aria-hidden="true" /> Retry
              </Button>
            )}
            className="min-h-48 bg-elevated/60"
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Crown aria-hidden="true" />}
            title="The podium is open"
            description="Complete a verified multiplayer game to claim the first spot."
            className="min-h-48 bg-elevated/60"
          />
        ) : (
          <ol className="space-y-1.5" aria-label="Global multiplayer rankings">
            {entries.map((entry) => {
              const isCurrentUser = entry.username === user?.username
              return (
                <li
                  key={`${entry.rank}:${entry.username}`}
                  className={`flex min-h-11 items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors duration-180 ${isCurrentUser ? 'border-accent-muted bg-accent-subtle' : 'border-transparent hover:border-border hover:bg-elevated'}`}
                >
                  <Rank rank={entry.rank} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
                    {entry.username}{isCurrentUser && <span className="sr-only"> (you)</span>}
                  </span>
                  <span className="font-mono text-sm font-semibold text-success-text">{entry.wins}W</span>
                  <span className="w-10 text-right font-mono text-xs text-text-muted">{formatPercentage(entry.winRate)}</span>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
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

function formatPercentage(rate: number): string {
  const normalized = Number.isFinite(rate) ? Math.max(0, rate) : 0
  return `${Math.round(normalized * 100)}%`
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading multiplayer rankings" aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-11 rounded-xl" />)}
    </div>
  )
}
