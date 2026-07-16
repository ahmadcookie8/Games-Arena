import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import AppShell from './components/AppShell'
import RouteLoading from './components/RouteLoading'
import { useAuth } from './hooks/useAuth'

const Auth = lazy(() => import('./pages/Auth'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const GameBoard = lazy(() => import('./pages/GameBoard'))
const GameHistory = lazy(() => import('./pages/GameHistory'))
const MazeChaseGame = lazy(() => import('./pages/MazeChaseGame'))
const NotFound = lazy(() => import('./pages/NotFound'))
const SinglePlayerGame = lazy(() => import('./pages/SinglePlayerGame'))
const SnakeGame = lazy(() => import('./pages/SnakeGame'))

function getRouteTitle(pathname: string): string {
  if (pathname === '/') return 'Game lobby'
  if (pathname === '/auth') return 'Player access'
  if (pathname === '/history') return 'Game history'
  if (pathname.startsWith('/single-player/snake/')) return 'Snake'
  if (pathname.startsWith('/single-player/maze-chase/')) return 'Maze Chase'
  if (pathname.startsWith('/single-player/tic-tac-toe/')) return 'Solo Tic Tac Toe'
  if (pathname.startsWith('/game/')) return 'Multiplayer game'
  return 'Arena not found'
}

function RouteFocusManager() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = `${getRouteTitle(pathname)} | Games Arena`
    let focused = false

    const focusRoute = () => {
      if (focused) return
      const main = document.querySelector<HTMLElement>('main#main-content, main')
      if (!main) return
      const isLoadingState = Boolean(main.querySelector('[role="status"]')) && !main.querySelector('h1, h2')
      if (isLoadingState) return
      main.focus({ preventScroll: true })
      focused = true
    }

    const frame = window.requestAnimationFrame(focusRoute)
    const observer = new MutationObserver(focusRoute)
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => {
      focusRoute()
      observer.disconnect()
    }, 2000)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
      observer.disconnect()
    }
  }, [pathname])

  return null
}

function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return <RouteLoading label="Restoring your arena" />
  }

  if (!user) return <Navigate to="/auth" replace />

  return (
    <AppShell>
      <Suspense fallback={<RouteLoading label="Opening arena" compact />}>
        <Outlet />
      </Suspense>
    </AppShell>
  )
}

function AuthRoute() {
  const { user, loading } = useAuth()

  if (loading) return <RouteLoading label="Checking your session" />
  if (user) return <Navigate to="/" replace />

  return (
    <Suspense fallback={<RouteLoading label="Preparing sign in" />}>
      <Auth />
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <RouteFocusManager />
      <Routes>
        <Route path="/auth" element={<AuthRoute />} />
        <Route element={<ProtectedLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="game/:gameId" element={<GameBoard />} />
          <Route path="single-player/tic-tac-toe/:gameId" element={<SinglePlayerGame />} />
          <Route path="single-player/snake/:gameId" element={<SnakeGame />} />
          <Route path="single-player/maze-chase/:gameId" element={<MazeChaseGame />} />
          <Route path="history" element={<GameHistory />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
