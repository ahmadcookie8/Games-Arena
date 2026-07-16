import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { CalendarDays, Gamepad2, History, RefreshCw, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  AVAILABLE_GAMES,
  getCatalogEntry,
  getGameMode,
  getGamePath,
} from '../lib/gameCatalog'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'
import type { Game, GameMode, GameStatus, GameType } from '../types/game'
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  RouteState,
  SegmentedControl,
  Select,
  Skeleton,
} from '../components/ui'

type ModeFilter = 'all' | GameMode
type StatusFilter = 'all' | Extract<GameStatus, 'active' | 'completed'>

interface GameLists {
  active: Game[]
  waiting: Game[]
  completed: Game[]
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseError = error.response?.data?.error
    if (typeof responseError === 'string') return responseError
    if (responseError && typeof responseError.message === 'string') return responseError.message
    return error.message || 'Something went wrong'
  }
  return error instanceof Error ? error.message : 'Something went wrong'
}

export default function GameHistory() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [games, setGames] = useState<Game[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')
  const [gameFilter, setGameFilter] = useState<GameType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const fetchHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const [multiplayerResponse, singlePlayerResponse] = await Promise.all([
        api.get<GameLists>('/api/games'),
        api.get<GameLists>('/api/games?mode=singlePlayer'),
      ])
      const nextGames = [
        ...multiplayerResponse.data.waiting,
        ...multiplayerResponse.data.active,
        ...multiplayerResponse.data.completed,
        ...singlePlayerResponse.data.waiting,
        ...singlePlayerResponse.data.active,
        ...singlePlayerResponse.data.completed,
      ]
        .filter((game) => getCatalogEntry(game.gameType).available)
        .filter((game, index, allGames) => allGames.findIndex((candidate) => candidate._id === game._id) === index)
        .sort((left, right) => new Date(right.lastMoveAt).getTime() - new Date(left.lastMoveAt).getTime())
      setGames(nextGames)
      setLoadError(null)
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchHistory()
  }, [fetchHistory])

  const gameOptions = useMemo(() => {
    const entries = AVAILABLE_GAMES.filter((entry) => modeFilter === 'all' || Boolean(entry.modes[modeFilter]))
    return [
      { value: 'all', label: 'All games' },
      ...entries.map((entry) => ({ value: entry.gameType, label: entry.label })),
    ]
  }, [modeFilter])

  useEffect(() => {
    if (gameFilter !== 'all' && !gameOptions.some((option) => option.value === gameFilter)) {
      setGameFilter('all')
    }
  }, [gameFilter, gameOptions])

  const filteredGames = useMemo(() => games.filter((game) => {
    if (modeFilter !== 'all' && getGameMode(game) !== modeFilter) return false
    if (gameFilter !== 'all' && game.gameType !== gameFilter) return false
    if (statusFilter !== 'all' && game.status !== statusFilter) return false
    return true
  }), [gameFilter, games, modeFilter, statusFilter])

  const activeCount = filteredGames.filter((game) => game.status === 'active').length
  const completedCount = filteredGames.filter((game) => game.status === 'completed').length

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative z-10 mx-auto w-full max-w-[92rem] px-4 py-5 outline-none sm:px-6 sm:py-8 lg:px-8"
    >
      <section className="mb-6 overflow-hidden rounded-3xl border border-border/80 bg-surface/90 p-5 shadow-md backdrop-blur-xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="accent" className="mb-3 gap-1.5">
              <History size={13} aria-hidden="true" /> Player archive
            </Badge>
            <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Game history</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
              Resume open matches, review recent outcomes, and see which solo runs reached the ranked board.
            </p>
          </div>
          {!isLoading && !loadError && (
            <div className="flex gap-2" aria-label="History summary">
              <Badge variant="info">{activeCount} active</Badge>
              <Badge variant="neutral">{completedCount} completed</Badge>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="history-filters-heading" className="mb-6 rounded-2xl border border-border bg-surface/85 p-4 shadow-sm backdrop-blur-xl">
        <h2 id="history-filters-heading" className="sr-only">Filter game history</h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(12rem,0.45fr)_minmax(12rem,0.45fr)] lg:items-end">
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Mode</span>
            <SegmentedControl
              ariaLabel="Filter by game mode"
              value={modeFilter}
              onValueChange={(value) => {
                if (value === 'all' || value === 'multiplayer' || value === 'singlePlayer') setModeFilter(value)
              }}
              items={[
                { value: 'all', label: 'All' },
                { value: 'multiplayer', label: 'Multiplayer' },
                { value: 'singlePlayer', label: 'Single player' },
              ]}
            />
          </div>
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Game</span>
            <Select
              label="Filter by game"
              value={gameFilter}
              onValueChange={(value) => setGameFilter(value as GameType | 'all')}
              options={gameOptions}
            />
          </div>
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Status</span>
            <Select
              label="Filter by status"
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { value: 'all', label: 'Any status' },
                { value: 'active', label: 'Active' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
        </div>
      </section>

      {isLoading ? (
        <HistorySkeleton />
      ) : loadError ? (
        <RouteState
          tone="danger"
          title="Your history could not load"
          description={loadError}
          action={(
            <Button onClick={() => { void fetchHistory() }}>
              <RefreshCw size={16} aria-hidden="true" /> Try again
            </Button>
          )}
        />
      ) : filteredGames.length === 0 ? (
        <EmptyState
          icon={<Trophy aria-hidden="true" />}
          eyebrow="No matches"
          title="Nothing matches these filters"
          description={games.length === 0
            ? 'Your finished games and active rooms will appear here.'
            : 'Try another mode, game, or status to widen the search.'}
          action={games.length === 0 ? <Button onClick={() => navigate('/')}>Explore games</Button> : undefined}
          className="min-h-[22rem] border border-dashed border-border bg-surface/80"
        />
      ) : (
        <section aria-label="Game history results" className="space-y-3">
          {filteredGames.map((game) => (
            <HistoryRow
              key={game._id}
              game={game}
              username={user?.username}
              onResume={() => {
                const path = getGamePath(game)
                if (path) navigate(path)
              }}
            />
          ))}
        </section>
      )}
    </main>
  )
}

function HistoryRow({ game, username, onResume }: { game: Game; username?: string; onResume: () => void }) {
  const entry = getCatalogEntry(game.gameType)
  const mode = getGameMode(game)
  const isActive = game.status === 'active'
  const result = getResultPresentation(game, username)
  const opponentText = mode === 'singlePlayer'
    ? getSoloDetail(game)
    : game.players.map((player) => player.username).join(' · ') || 'Waiting for players'

  return (
    <Card className="card-glow">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-elevated text-accent">
            {entry.artwork ? (
              <picture className="block h-full w-full">
                <source type="image/avif" srcSet={entry.artwork.avifSrcSet} sizes="48px" />
                <source type="image/webp" srcSet={entry.artwork.webpSrcSet} sizes="48px" />
                <img
                  src={entry.artwork.fallbackSrc}
                  alt=""
                  width={entry.artwork.width}
                  height={entry.artwork.height}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </picture>
            ) : (
              <Gamepad2 size={21} aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-semibold text-text-primary">{entry.label}</h2>
              <Badge variant={mode === 'singlePlayer' ? 'accent' : 'info'}>{mode === 'singlePlayer' ? 'Solo' : 'Multiplayer'}</Badge>
              {isActive ? <Badge variant="warning">Active</Badge> : <Badge variant={result.variant}>{result.label}</Badge>}
            </div>
            <p className="mt-1 truncate text-sm text-text-secondary">{opponentText}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1"><CalendarDays size={12} aria-hidden="true" />{formatDate(game.lastMoveAt)}</span>
              {mode === 'multiplayer' && <span className="font-mono tracking-[0.1em]">{game.gameCode}</span>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border pt-3 sm:justify-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          {mode === 'singlePlayer' && game.status === 'completed' && <VerificationBadge game={game} />}
          {isActive && (
            <Button size="sm" onClick={onResume}>
              Resume game
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function VerificationBadge({ game }: { game: Game }) {
  const ranked = game.result?.verification === 'replay' || game.result?.verification === 'server'
  return (
    <Badge variant={ranked ? 'success' : 'neutral'}>
      {ranked ? 'Ranked · verified' : 'Unranked'}
    </Badge>
  )
}

function getSoloDetail(game: Game): string {
  if (game.gameType === 'snake') {
    const score = String(game.result?.winType || '').replace(/^score:/, '') || String(game.gameState.score || 0)
    return game.status === 'completed' ? `Final length ${score}` : 'Snake run in progress'
  }
  if (game.gameType === 'mazeChase') {
    const score = String(game.result?.winType || '').replace(/^score:/, '') || String(game.gameState.score || 0)
    return game.status === 'completed' ? `Final score ${score}` : 'Maze run in progress'
  }
  const difficulty = game.metadata?.difficulty || 'easy'
  return `${difficulty[0].toUpperCase()}${difficulty.slice(1)} difficulty`
}

function getResultPresentation(game: Game, username?: string): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (game.gameType === 'snake') {
    const score = String(game.result?.winType || '').replace(/^score:/, '') || String(game.gameState.score || 0)
    return { label: `Length ${score}`, variant: 'success' }
  }
  if (game.gameType === 'mazeChase') {
    const score = String(game.result?.winType || '').replace(/^score:/, '') || String(game.gameState.score || 0)
    return { label: `Score ${score}`, variant: 'success' }
  }
  if (game.result?.isDraw) return { label: 'Draw', variant: 'warning' }
  if (!game.result?.winnerName) return { label: 'Complete', variant: 'neutral' }
  return game.result.winnerName === username
    ? { label: 'Win', variant: 'success' }
    : { label: 'Loss', variant: 'danger' }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function HistorySkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading game history" aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-24 rounded-2xl" />
      ))}
    </div>
  )
}
