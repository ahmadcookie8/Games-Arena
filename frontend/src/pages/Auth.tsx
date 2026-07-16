import axios from 'axios'
import { AlertCircle, Eye, EyeOff, Gamepad2, Radio, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BrandMascot from '../components/BrandMascot'
import PageBackdrop from '../components/PageBackdrop'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button, Card, Field, IconButton, Input, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

type AuthMode = 'login' | 'signup'
type FieldName = 'identifier' | 'username' | 'email' | 'password' | 'confirmPassword'
type FieldErrors = Partial<Record<FieldName, string>>

const usernamePattern = /^[a-zA-Z0-9_]+$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Auth() {
  const { login, signup, loading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [mode, setMode] = useState<AuthMode>('login')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [requestError, setRequestError] = useState('')

  function validateField(field: FieldName): string | undefined {
    if (field === 'identifier') {
      if (mode === 'login' && !identifier.trim()) return 'Enter your username or email.'
      if (identifier.trim().length > 254) return 'Username or email is too long.'
    }

    if (field === 'username' && mode === 'signup') {
      const value = username.trim()
      if (!value) return 'Choose a username.'
      if (value.length < 3 || value.length > 20) return 'Use between 3 and 20 characters.'
      if (!usernamePattern.test(value)) return 'Use only letters, numbers, and underscores.'
    }

    if (field === 'email' && mode === 'signup' && email.trim() && !emailPattern.test(email.trim())) {
      return 'Enter a valid email address or leave this blank.'
    }

    if (field === 'password') {
      if (!password) return 'Enter your password.'
      if (mode === 'signup' && password.length < 8) return 'Use at least 8 characters.'
      if (password.length > 128) return 'Password must be 128 characters or fewer.'
    }

    if (field === 'confirmPassword' && mode === 'signup') {
      if (!confirmPassword) return 'Confirm your password.'
      if (password !== confirmPassword) return 'Passwords do not match.'
    }

    return undefined
  }

  function validateAndStore(field: FieldName) {
    const message = validateField(field)
    setFieldErrors((current) => ({ ...current, [field]: message }))
  }

  function clearFieldError(field: FieldName) {
    if (requestError) setRequestError('')
    if (!fieldErrors[field]) return
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function validateForm() {
    const fields: FieldName[] = mode === 'login'
      ? ['identifier', 'password']
      : ['username', 'email', 'password', 'confirmPassword']
    const errors: FieldErrors = {}

    for (const field of fields) {
      const message = validateField(field)
      if (message) errors[field] = message
    }

    setFieldErrors(errors)
    const firstInvalidField = fields.find((field) => errors[field])
    if (firstInvalidField) {
      window.requestAnimationFrame(() => document.getElementById(firstInvalidField)?.focus())
    }
    return !firstInvalidField
  }

  function handleModeChange(value: string) {
    const nextMode = value as AuthMode
    setMode(nextMode)
    setRequestError('')
    setFieldErrors({})
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRequestError('')
    if (!validateForm()) return

    try {
      if (mode === 'login') {
        await login(identifier.trim(), password)
      } else {
        await signup(username.trim(), password, email.trim() || undefined)
      }
      navigate('/', { replace: true })
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error
        setRequestError(typeof apiError === 'string' ? apiError : 'We could not complete that request. Try again.')
      } else {
        setRequestError(error instanceof Error ? error.message : 'We could not complete that request. Try again.')
      }
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="relative isolate min-h-screen min-h-[100dvh] overflow-hidden bg-page pb-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(5rem+env(safe-area-inset-top))] outline-none sm:pb-8 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:py-8">
      <PageBackdrop intensity="strong" />
      <div className="absolute right-4 top-4 z-20 pt-[env(safe-area-inset-top)] sm:right-6 sm:top-6">
        <ThemeToggle className="border border-border bg-surface/80 shadow-sm backdrop-blur-xl" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-6.5rem)] w-full max-w-6xl items-center gap-8 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.75fr)] lg:gap-14">
        <section className="hidden max-w-2xl lg:block" aria-labelledby="auth-welcome-title">
          <div className="flex items-center gap-4">
            <span className="relative grid h-24 w-24 place-items-center rounded-[1.75rem] border border-accent/20 bg-surface/45 shadow-hero backdrop-blur-xl">
              <span className="absolute inset-2 rounded-2xl bg-accent/15 blur-xl" aria-hidden="true" />
              <BrandMascot eager sizes="88px" className="relative h-[5.5rem] w-[5.5rem] object-contain" />
            </span>
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.26em] text-accent">The arcade is open</p>
              <p id="auth-welcome-title" className="mt-2 font-display text-5xl font-bold leading-[1.05] tracking-tight text-text-primary xl:text-6xl">
                Enter the <span className="text-gradient">Electric Arena</span>
              </p>
            </div>
          </div>
          <p className="mt-7 max-w-xl text-lg leading-8 text-text-secondary">
            Challenge friends live, chase a new high score, and keep every rivalry moving from one game night to the next.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {[
              { icon: Radio, label: 'Live rooms', value: 'Real-time' },
              { icon: Gamepad2, label: 'Arcade lineup', value: '7 arenas' },
              { icon: ShieldCheck, label: 'Your session', value: 'Secure' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-2xl border border-border/80 bg-surface/55 p-4 shadow-sm backdrop-blur-xl">
                  <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                  <p className="mt-3 font-display text-base font-bold text-text-primary">{item.value}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{item.label}</p>
                </div>
              )
            })}
          </div>
        </section>

        <div className="mx-auto w-full max-w-md animate-slide-up">
          <Card className="relative overflow-hidden border-border/90 bg-surface/92 p-5 shadow-lg backdrop-blur-2xl sm:p-7">
            <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
            <div className="relative mb-6 text-center lg:text-left">
              <BrandMascot eager sizes="80px" className="mx-auto mb-3 h-20 w-20 object-contain drop-shadow-[0_0_24px_oklch(60%_0.2_250_/_0.35)] lg:hidden" />
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.24em] text-accent">Player access</p>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text-primary">Welcome to Games Arena</h1>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Sign in to resume a match or create a new player account.</p>
            </div>

            <Tabs value={mode} onValueChange={handleModeChange}>
              <TabsList
                aria-label="Choose sign in or account creation"
                className="mb-6 grid grid-cols-2 rounded-xl border border-border bg-elevated p-1"
              >
                <TabsTrigger
                  value="login"
                  disabled={loading}
                  className="min-h-11 rounded-lg px-3 text-sm font-semibold text-text-secondary outline-none transition-[background-color,color,box-shadow] duration-180 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus/30 data-[state=active]:bg-surface data-[state=active]:text-text-primary data-[state=active]:shadow-sm"
                >
                  Sign in
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  disabled={loading}
                  className="min-h-11 rounded-lg px-3 text-sm font-semibold text-text-secondary outline-none transition-[background-color,color,box-shadow] duration-180 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus/30 data-[state=active]:bg-surface data-[state=active]:text-text-primary data-[state=active]:shadow-sm"
                >
                  Create account
                </TabsTrigger>
              </TabsList>

              <form noValidate onSubmit={handleSubmit} className="space-y-4">
                <TabsContent value="login" className="mt-0 space-y-4 outline-none">
                  <Field id="identifier" label="Username or email" required error={fieldErrors.identifier}>
                    <Input
                      name="identifier"
                      value={identifier}
                      onChange={(event) => {
                        setIdentifier(event.target.value)
                        clearFieldError('identifier')
                      }}
                      onBlur={() => validateAndStore('identifier')}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      inputMode="email"
                      required
                      maxLength={254}
                      placeholder="penguin_player or you@example.com"
                      disabled={loading}
                    />
                  </Field>
                </TabsContent>

                <TabsContent value="signup" className="mt-0 space-y-4 outline-none">
                  <Field
                    id="username"
                    label="Username"
                    required
                    hint="3–20 letters, numbers, or underscores."
                    error={fieldErrors.username}
                  >
                    <Input
                      name="username"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value)
                        clearFieldError('username')
                      }}
                      onBlur={() => validateAndStore('username')}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      minLength={3}
                      maxLength={20}
                      placeholder="penguin_player"
                      disabled={loading}
                    />
                  </Field>
                  <Field id="email" label="Email" hint="Optional. You can also use it to sign in." error={fieldErrors.email}>
                    <Input
                      name="email"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value)
                        clearFieldError('email')
                      }}
                      onBlur={() => validateAndStore('email')}
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={254}
                      placeholder="you@example.com"
                      disabled={loading}
                    />
                  </Field>
                </TabsContent>

                <Field
                  id="password"
                  label="Password"
                  required
                  hint={mode === 'signup' ? 'Use at least 8 characters.' : undefined}
                  error={fieldErrors.password}
                >
                  <div className="relative">
                    <Input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        clearFieldError('password')
                        if (fieldErrors.confirmPassword) clearFieldError('confirmPassword')
                      }}
                      onBlur={() => validateAndStore('password')}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      minLength={mode === 'signup' ? 8 : 1}
                      maxLength={128}
                      placeholder={mode === 'signup' ? 'Create a strong password' : 'Enter your password'}
                      className="pr-12"
                      disabled={loading}
                    />
                    <IconButton
                      label={showPassword ? 'Hide password' : 'Show password'}
                      icon={showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 shadow-none"
                      disabled={loading}
                    />
                  </div>
                </Field>

                {mode === 'signup' && (
                  <Field id="confirmPassword" label="Confirm password" required error={fieldErrors.confirmPassword}>
                    <div className="relative">
                      <Input
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => {
                          setConfirmPassword(event.target.value)
                          clearFieldError('confirmPassword')
                        }}
                        onBlur={() => validateAndStore('confirmPassword')}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={128}
                        placeholder="Type it again"
                        className="pr-12"
                        disabled={loading}
                      />
                      <IconButton
                        label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                        icon={showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className="absolute inset-y-0 right-0 shadow-none"
                        disabled={loading}
                      />
                    </div>
                  </Field>
                )}

                {requestError && (
                  <div role="alert" aria-live="assertive" className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-subtle px-3.5 py-3 text-sm leading-5 text-danger-text">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{requestError}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  loading={loading}
                  loadingText={mode === 'login' ? 'Entering arena…' : 'Creating player…'}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {mode === 'login' ? 'Enter the arena' : 'Create player account'}
                </Button>
              </form>
            </Tabs>
          </Card>

          <p className="mt-5 text-center text-xs leading-5 text-text-muted">
            Your secure session stays in an HttpOnly cookie on this device.
          </p>
        </div>
      </div>
    </main>
  )
}
