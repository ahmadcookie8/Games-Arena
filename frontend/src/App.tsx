import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import GameBoard from './pages/GameBoard'
import GameHistory from './pages/GameHistory'
import SinglePlayerGame from './pages/SinglePlayerGame'
import { useAuth } from './hooks/useAuth'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-text-primary">
        <div className="rounded-2xl border border-border bg-surface px-5 py-4 text-sm shadow-sm">Loading Games Arena...</div>
      </div>
    )
  }
  return user ? <>{children}</> : <Navigate to="/auth" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/game/:gameId" element={<ProtectedRoute><GameBoard /></ProtectedRoute>} />
        <Route path="/single-player/tic-tac-toe/:gameId" element={<ProtectedRoute><SinglePlayerGame /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><GameHistory /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
