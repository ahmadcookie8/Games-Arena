import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import brandMark from '../assets/brand-mark.png'
import authBg from '../assets/auth-bg-dark.png'
import { ThemeToggle } from '../components/ThemeToggle'

export default function Auth() {
  const { login, signup, loading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'login') {
        await login(identifier, password)
      } else {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          return
        }
        await signup(username, password, email.trim() || undefined)
      }
      navigate('/')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Something went wrong')
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page px-4 py-8">
      <div className="absolute inset-0 bg-cover bg-center opacity-25 dark:opacity-45" style={{ backgroundImage: `url(${authBg})` }} />
      <div className="absolute inset-0 bg-page/65" />
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md animate-slide-up rounded-2xl border border-border bg-surface/95 p-5 shadow-lg backdrop-blur sm:p-6">
        <div className="mb-6 text-center">
          <img src={brandMark} alt="" className="mx-auto mb-3 h-16 w-16 rounded-2xl object-cover shadow-accent" />
          <h1 className="text-4xl font-extrabold text-text-primary">Games Arena</h1>
          <p className="mt-2 text-sm text-text-secondary">Jump back into live multiplayer matches.</p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-lg bg-overlay p-1">
          <button
            className={`min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${mode === 'login' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            onClick={() => setMode('login')}
            type="button"
          >
            Login
          </button>
          <button
            className={`min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${mode === 'signup' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            onClick={() => setMode('signup')}
            type="button"
          >
            Sign Up
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'login' ? (
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Username or email"
                required
                aria-describedby={error ? 'auth-error' : undefined}
                className="w-full rounded-lg border border-border bg-overlay px-3 py-2 text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/20"
              />
            ) : (
              <>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  required
                  aria-describedby={error ? 'auth-error' : undefined}
                  className="w-full rounded-lg border border-border bg-overlay px-3 py-2 text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/20"
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full rounded-lg border border-border bg-overlay px-3 py-2 text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/20"
                />
              </>
            )}
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={8}
            maxLength={128}
            aria-describedby={error ? 'auth-error' : undefined}
            className="w-full rounded-lg border border-border bg-overlay px-3 py-2 text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/20"
          />
          {mode === 'signup' && (
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              required
              minLength={8}
              maxLength={128}
              aria-describedby={error ? 'auth-error' : undefined}
              className="w-full rounded-lg border border-border bg-overlay px-3 py-2 text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/20"
            />
          )}
          {error && <p id="auth-error" className="rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger-text">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
