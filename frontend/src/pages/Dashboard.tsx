import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  ArrowRight,
  Clock3,
  Gamepad2,
  History,
  MoreHorizontal,
  Radio,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Leaderboard from '../components/Leaderboard'
import Modal, { type ModalAction, type ModalVariant } from '../components/Modal'
import SinglePlayerLeaderboard from '../components/SinglePlayerLeaderboard'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  RouteState,
  SegmentedControl,
  Skeleton,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import api from '../lib/api'
import { canParticipantCloseGame, getCloseGamePrompt } from '../lib/gameClose'
import {
  MULTIPLAYER_GAMES,
  SINGLE_PLAYER_GAMES,
  getCatalogEntry,
  getCatalogMode,
  getGameMode,
  getGamePath,
  type GameCatalogEntry,
} from '../lib/gameCatalog'
import type { Game, GameMode, TicTacToeDifficulty } from '../types/game'

type DashboardTab = GameMode

interface GameLists {
  active: Game[]
  waiting: Game[]
  completed: Game[]
}

interface ModalState {
  title: string
  message: string
  variant: ModalVariant
  primaryAction?: ModalAction
  secondaryAction?: ModalAction
  actionPendingKey?: string
}

const EMPTY_GAMES: GameLists = { active: [], waiting: [], completed: [] }
const GAME_CODE_PATTERN = /^(?:[A-Z0-9]{6}|[A-Z0-9]{8})$/

function getDifficultyLabel(difficulty?: TicTacToeDifficulty): string {
  const value = difficulty || 'easy'
  return `${value[0].toUpperCase()}${value.slice(1)}`
}

function getScore(game: Game): string {
  const fromResult = String(game.result?.winType || '').replace(/^score:/, '')
  if (fromResult) return fromResult
  const stateScore = game.gameState.score
  return typeof stateScore === 'number' ? String(stateScore) : '0'
}

function getSnakeSettingsLabel(game: Game): string {
  const size = game.metadata?.boardSize || 'medium'
  return `${size[0].toUpperCase()}${size.slice(1)} grid · ${game.metadata?.wallLooping ? 'looping walls' : 'solid walls'}`
}

function getActiveGameDetail(game: Game): string {
  if (getGameMode(game) === 'singlePlayer') {
    if (game.gameType === 'snake') return getSnakeSettingsLabel(game)
    if (game.gameType === 'mazeChase') return `Current score ${getScore(game)}`
    return `${getDifficultyLabel(game.metadata?.difficulty)} difficulty`
  }

  const mode = getCatalogMode(getCatalogEntry(game.gameType), 'multiplayer')
  const joined = `${game.players.length} joined`
  return mode ? `${joined} · ${mode.playerCount}` : joined
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

function getCloseGameModal(game: Game, onConfirm: () => void, onCancel: () => void): ModalState {
  const prompt = getCloseGamePrompt(game)
  return {
    ...prompt,
    variant: 'warning',
    primaryAction: { label: 'Close game', onClick: onConfirm, variant: 'danger' },
    secondaryAction: { label: 'Cancel', onClick: onCancel },
    actionPendingKey: `close:${game._id}`,
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { on } = useSocket()
  const activeTab: DashboardTab = searchParams.get('tab') === 'singlePlayer' ? 'singlePlayer' : 'multiplayer'
  const [multiplayerGames, setMultiplayerGames] = useState<GameLists>(EMPTY_GAMES)
  const [singlePlayerGames, setSinglePlayerGames] = useState<GameLists>(EMPTY_GAMES)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [pendingActions, setPendingActions] = useState<Set<string>>(() => new Set())
  const pendingActionsRef = useRef<Set<string>>(new Set())
  const [modal, setModal] = useState<ModalState | null>(null)

  const currentGames = activeTab === 'multiplayer' ? multiplayerGames : singlePlayerGames
  const catalog = activeTab === 'multiplayer' ? MULTIPLAYER_GAMES : SINGLE_PLAYER_GAMES
  const activeGames = useMemo(
    () => Array.from(
      new Map(
        [...currentGames.waiting, ...currentGames.active]
          .filter((game) => getGamePath(game) !== null)
          .map((game) => [game._id, game]),
      ).values(),
    ),
    [currentGames.active, currentGames.waiting],
  )
  const recentGames = useMemo(
    () => currentGames.completed.filter((game) => getCatalogEntry(game.gameType).available).slice(0, 5),
    [currentGames.completed],
  )

  const refreshGames = useCallback(async (background = false) => {
    if (!background) setIsLoading(true)
    try {
      const [multiplayerResponse, singlePlayerResponse] = await Promise.all([
        api.get<GameLists>('/api/games'),
        api.get<GameLists>('/api/games?mode=singlePlayer'),
      ])
      setMultiplayerGames(multiplayerResponse.data)
      setSinglePlayerGames(singlePlayerResponse.data)
      setLoadError(null)
    } catch (error) {
      if (!background) setLoadError(getErrorMessage(error))
    } finally {
      if (!background) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshGames()
  }, [refreshGames])

  useEffect(() => on('gamesChanged', () => {
    void refreshGames(true)
  }), [on, refreshGames])

  function setActiveTab(tab: string) {
    if (tab !== 'multiplayer' && tab !== 'singlePlayer') return
    const next = new URLSearchParams(searchParams)
    if (tab === 'singlePlayer') next.set('tab', 'singlePlayer')
    else next.delete('tab')
    setSearchParams(next)
  }

  function setPending(key: string, value: boolean) {
    if (value) pendingActionsRef.current.add(key)
    else pendingActionsRef.current.delete(key)
    setPendingActions(new Set(pendingActionsRef.current))
  }

  async function handleCreate(entry: GameCatalogEntry) {
    const mode = getCatalogMode(entry, activeTab)
    if (!mode) return
    const pendingKey = `create:${activeTab}:${entry.gameType}`
    if (pendingActionsRef.current.has(pendingKey)) return

    setPending(pendingKey, true)
    try {
      const response = await api.post(mode.createEndpoint, mode.createPayload)
      const gameId = response.data.gameId || response.data.game?._id
      if (!gameId) throw new Error('The game was created without a game ID.')
      const path = getGamePath({
        _id: gameId,
        gameType: entry.gameType,
        metadata: { mode: activeTab },
      })
      if (!path) throw new Error('This game route is unavailable.')
      navigate(path)
    } catch (error) {
      showGenericErrorModal(error, `Could not start ${entry.label}`)
      setPending(pendingKey, false)
    }
  }

  async function handleJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedCode = joinCode.trim().toUpperCase()
    if (!GAME_CODE_PATTERN.test(normalizedCode)) {
      setJoinError('Enter a six- or eight-character game code.')
      return
    }

    const pendingKey = 'join'
    if (pendingActionsRef.current.has(pendingKey)) return
    setJoinError(null)
    setPending(pendingKey, true)
    try {
      const response = await api.post('/api/games/join', { gameCode: normalizedCode })
      navigate(`/game/${response.data.game._id}`)
    } catch (error) {
      showJoinErrorModal(error, normalizedCode)
      setPending(pendingKey, false)
    }
  }

  async function confirmCloseGame(game: Game) {
    const pendingKey = `close:${game._id}`
    if (pendingActionsRef.current.has(pendingKey)) return
    setPending(pendingKey, true)
    try {
      await api.post(`/api/games/${game._id}/close`)
      closeModal()
      await refreshGames(true)
    } catch (error) {
      showGenericErrorModal(error, 'Could not close game')
    } finally {
      setPending(pendingKey, false)
    }
  }

  function promptCloseGame(game: Game) {
    if (!canParticipantCloseGame(game, user?._id)) return
    setModal(getCloseGameModal(game, () => {
      void confirmCloseGame(game)
    }, closeModal))
  }

  function closeModal() {
    setModal(null)
  }

  function showGenericErrorModal(error: unknown, title: string) {
    setModal({ title, message: getErrorMessage(error), variant: 'danger' })
  }

  function showJoinErrorModal(error: unknown, normalizedCode: string) {
    const message = getErrorMessage(error)
    const matchingGame = [
      ...multiplayerGames.active,
      ...multiplayerGames.waiting,
      ...multiplayerGames.completed,
    ].find((game) => game.gameCode === normalizedCode)

    if (message === 'Already in this game') {
      const matchingPath = matchingGame ? getGamePath(matchingGame) : null
      setModal({
        title: 'You are already in this game',
        message: 'This room is already connected to your account. You can resume it here instead.',
        variant: 'info',
        primaryAction: matchingPath
          ? { label: 'Resume game', onClick: () => { closeModal(); navigate(matchingPath) } }
          : undefined,
        secondaryAction: matchingPath ? { label: 'Close', onClick: closeModal } : undefined,
      })
      return
    }

    const knownErrors: Record<string, Omit<ModalState, 'variant'>> = {
      'Game is full': {
        title: 'This room is full',
        message: matchingGame
          ? `${getCatalogEntry(matchingGame.gameType).label} has reached its player limit. Try another code or create a new room.`
          : 'This room has reached its player limit. Try another code or create a new room.',
      },
      'Game is not active': {
        title: 'This room is no longer active',
        message: 'The game may be completed, paused, or closed. Ask the host for a new room code.',
      },
      'Game not found': {
        title: 'Game not found',
        message: 'Check the code and try again. Current codes use eight characters; older invites may use six.',
      },
    }
    const known = knownErrors[message]
    setModal(known
      ? { ...known, variant: message === 'Game not found' ? 'danger' : 'warning' }
      : { title: 'Could not join game', message, variant: 'danger' })
  }

  return (
    <>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 mx-auto w-full max-w-[92rem] px-4 py-5 outline-none sm:px-6 sm:py-8 lg:px-8"
      >
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-border/80 bg-surface/90 p-5 shadow-lg backdrop-blur-xl sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,oklch(68%_0.18_252/.22),transparent_32%),linear-gradient(125deg,oklch(52%_0.20_245/.10),transparent_48%)]" aria-hidden="true" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)] lg:items-end">
            <div>
              <Badge variant="accent" className="mb-4 gap-1.5">
                <Radio size={13} aria-hidden="true" /> Live arena
              </Badge>
              <p className="mb-1 text-sm font-semibold text-accent">Welcome back, @{user?.username}</p>
              <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
                Pick your next <span className="text-gradient">challenge.</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
                Create a room, continue a run, or jump straight into a friend’s arena.
              </p>
            </div>

            <form onSubmit={handleJoin} className="rounded-2xl border border-border bg-elevated/85 p-4 shadow-sm">
              <Field
                id="dashboard-game-code"
                label="Quick join"
                hint="Use an 8-character invite or a legacy 6-character code."
                error={joinError || undefined}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="dashboard-game-code"
                    value={joinCode}
                    onChange={(event) => {
                      setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
                      if (joinError) setJoinError(null)
                    }}
                    placeholder="ABCD2345"
                    minLength={6}
                    maxLength={8}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="font-mono uppercase tracking-[0.16em]"
                  />
                  <Button
                    type="submit"
                    loading={pendingActions.has('join')}
                    loadingText="Joining"
                    className="shrink-0 sm:min-w-28"
                  >
                    Join room
                  </Button>
                </div>
              </Field>
            </form>
          </div>

          <div className="relative mt-6 max-w-lg">
            <SegmentedControl
              ariaLabel="Game mode"
              value={activeTab}
              onValueChange={setActiveTab}
              items={[
                { value: 'multiplayer', label: 'Multiplayer' },
                { value: 'singlePlayer', label: 'Single player' },
              ]}
            />
          </div>
        </section>

        {isLoading ? (
          <DashboardSkeleton />
        ) : loadError ? (
          <RouteState
            tone="danger"
            title="The lobby could not load"
            description={loadError}
            action={(
              <Button onClick={() => { void refreshGames() }}>
                <RefreshCw size={16} aria-hidden="true" /> Try again
              </Button>
            )}
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-6">
              <section aria-labelledby="continue-heading">
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Back in action</p>
                    <h2 id="continue-heading" className="mt-1 font-display text-xl font-semibold text-text-primary sm:text-2xl">Continue playing</h2>
                  </div>
                  {activeGames.length > 0 && <Badge variant="neutral">{activeGames.length} active</Badge>}
                </div>
                {activeGames.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {activeGames.map((game) => (
                      <ActiveGameCard
                        key={game._id}
                        game={game}
                        canClose={canParticipantCloseGame(game, user?._id)}
                        closePending={pendingActions.has(`close:${game._id}`)}
                        onResume={() => {
                          const path = getGamePath(game)
                          if (path) navigate(path)
                        }}
                        onClose={() => promptCloseGame(game)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Clock3 aria-hidden="true" />}
                    title={activeTab === 'multiplayer' ? 'No open rooms' : 'No runs in progress'}
                    description={activeTab === 'multiplayer'
                      ? 'Create an arena below and invite your crew.'
                      : 'Start a solo challenge below—your active run will appear here.'}
                    className="border border-dashed border-border bg-surface/70"
                  />
                )}
              </section>

              <section aria-labelledby="arena-heading">
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Game select</p>
                  <h2 id="arena-heading" className="mt-1 font-display text-xl font-semibold text-text-primary sm:text-2xl">Choose your arena</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    {activeTab === 'multiplayer' ? 'Room settings live inside each game so everyone can agree before play.' : 'Difficulty and run settings are waiting inside each game.'}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {catalog.map((entry) => {
                    const mode = getCatalogMode(entry, activeTab)
                    if (!mode) return null
                    const pendingKey = `create:${activeTab}:${entry.gameType}`
                    return (
                      <Card key={`${activeTab}:${entry.gameType}`} className="group overflow-hidden">
                        <div className="relative aspect-[16/8] overflow-hidden bg-elevated">
                          {entry.artwork && (
                            <picture className="block h-full w-full">
                              <source
                                type="image/avif"
                                srcSet={entry.artwork.avifSrcSet}
                                sizes="(min-width: 1280px) 32rem, (min-width: 640px) 50vw, 100vw"
                              />
                              <source
                                type="image/webp"
                                srcSet={entry.artwork.webpSrcSet}
                                sizes="(min-width: 1280px) 32rem, (min-width: 640px) 50vw, 100vw"
                              />
                              <img
                                src={entry.artwork.fallbackSrc}
                                alt=""
                                width={entry.artwork.width}
                                height={entry.artwork.height}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover transition-transform duration-[240ms] group-hover:scale-[1.035]"
                              />
                            </picture>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" aria-hidden="true" />
                          <Badge variant="neutral" className="absolute bottom-3 left-3 border-white/15 bg-black/45 text-white backdrop-blur-md">
                            <Users size={12} aria-hidden="true" /> {mode.playerCount}
                          </Badge>
                        </div>
                        <CardHeader className="pb-3">
                          <CardTitle>{entry.label}</CardTitle>
                          <CardDescription>{mode.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Button
                            fullWidth
                            onClick={() => { void handleCreate(entry) }}
                            loading={pendingActions.has(pendingKey)}
                            loadingText={activeTab === 'multiplayer' ? 'Creating room' : 'Starting run'}
                          >
                            {activeTab === 'multiplayer' ? <Gamepad2 size={17} aria-hidden="true" /> : <Zap size={17} aria-hidden="true" />}
                            {mode.actionLabel}
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            </div>

            <aside aria-label="Arena rankings and recent results" className="space-y-6">
              {activeTab === 'multiplayer' ? <Leaderboard /> : <SinglePlayerLeaderboard />}
              <RecentResults
                games={recentGames}
                username={user?.username}
                mode={activeTab}
                onViewHistory={() => navigate('/history')}
              />
            </aside>
          </div>
        )}
      </main>

      <Modal
        isOpen={Boolean(modal)}
        title={modal?.title || ''}
        variant={modal?.variant}
        primaryAction={modal?.primaryAction ? {
          ...modal.primaryAction,
          loading: Boolean(modal.actionPendingKey && pendingActions.has(modal.actionPendingKey)),
          loadingText: modal.actionPendingKey ? 'Closing game…' : modal.primaryAction.loadingText,
        } : undefined}
        secondaryAction={modal?.secondaryAction}
        onClose={closeModal}
      >
        {modal?.message}
      </Modal>
    </>
  )
}

function ActiveGameCard({
  game,
  canClose,
  closePending,
  onResume,
  onClose,
}: {
  game: Game
  canClose: boolean
  closePending: boolean
  onResume: () => void
  onClose: () => void
}) {
  const entry = getCatalogEntry(game.gameType)
  const isMultiplayer = getGameMode(game) === 'multiplayer'
  const minimumPlayers = game.gameType === 'wisecracker' ? 3 : 2
  const isWaiting = isMultiplayer && game.players.length < minimumPlayers

  return (
    <Card className="card-glow overflow-hidden">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-elevated">
            {entry.artwork ? (
              <picture className="block h-full w-full">
                <source type="image/avif" srcSet={entry.artwork.avifSrcSet} sizes="44px" />
                <source type="image/webp" srcSet={entry.artwork.webpSrcSet} sizes="44px" />
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
            ) : <Gamepad2 size={20} aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold text-text-primary">{entry.label}</h3>
              <Badge variant={isWaiting ? 'warning' : 'info'}>
                {isWaiting ? 'Waiting for players' : 'In progress'}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-text-muted">{getActiveGameDetail(game)}</p>
          </div>
          {canClose && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`More options for ${entry.label}`}>
                  <MoreHorizontal size={18} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onClose} disabled={closePending} tone="danger">
                  Close game
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3">
          {isMultiplayer ? (
            <span className="font-mono text-xs font-semibold tracking-[0.12em] text-text-secondary">{game.gameCode}</span>
          ) : (
            <span className="text-xs text-text-muted">Last played {formatDate(game.lastMoveAt)}</span>
          )}
          <Button size="sm" onClick={onResume}>
            Resume <ArrowRight size={15} aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RecentResults({
  games,
  username,
  mode,
  onViewHistory,
}: {
  games: Game[]
  username?: string
  mode: GameMode
  onViewHistory: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History size={17} aria-hidden="true" /> Recent results
          </CardTitle>
          <CardDescription>{mode === 'singlePlayer' ? 'Your latest solo finishes' : 'Your latest completed rooms'}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewHistory}>View all</Button>
      </CardHeader>
      <CardContent>
        {games.length === 0 ? (
          <EmptyState
            icon={<Sparkles aria-hidden="true" />}
            title="No results yet"
            description="Finish a game and your result will show up here."
            className="min-h-44 bg-elevated/60"
          />
        ) : (
          <ol className="space-y-2">
            {games.map((game) => {
              const result = getResultPresentation(game, username)
              const isSolo = getGameMode(game) === 'singlePlayer'
              return (
                <li key={game._id} className="flex items-center gap-3 rounded-xl border border-border/80 bg-elevated/65 p-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent">
                    <Trophy size={17} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{getCatalogEntry(game.gameType).label}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{formatDate(game.lastMoveAt)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={result.variant}>{result.label}</Badge>
                    {isSolo && <VerificationBadge game={game} />}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function VerificationBadge({ game }: { game: Game }) {
  const ranked = game.result?.verification === 'replay' || game.result?.verification === 'server'
  return (
    <span className={`text-[0.68rem] font-semibold ${ranked ? 'text-success-text' : 'text-text-muted'}`}>
      {ranked ? 'Ranked' : 'Unranked'}
    </span>
  )
}

function getResultPresentation(game: Game, username?: string): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (game.gameType === 'snake') return { label: `Length ${getScore(game)}`, variant: 'success' }
  if (game.gameType === 'mazeChase') return { label: `Score ${getScore(game)}`, variant: 'success' }
  if (game.result?.isDraw) return { label: 'Draw', variant: 'warning' }
  if (!game.result?.winnerName) return { label: 'Complete', variant: 'neutral' }
  return game.result.winnerName === username
    ? { label: 'Win', variant: 'success' }
    : { label: 'Loss', variant: 'danger' }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-label="Loading your games" aria-busy="true">
      <div className="space-y-8">
        <section>
          <Skeleton className="mb-3 h-7 w-52" />
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </section>
        <section>
          <Skeleton className="mb-3 h-7 w-44" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-72 rounded-2xl" />)}
          </div>
        </section>
      </div>
      <Skeleton className="h-[32rem] rounded-2xl" />
    </div>
  )
}
