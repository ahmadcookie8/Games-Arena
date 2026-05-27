import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import GameBoard from './pages/GameBoard'
import GameHistory from './pages/GameHistory'
import { useAuth } from './hooks/useAuth'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>
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
        <Route path="/history" element={<ProtectedRoute><GameHistory /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
