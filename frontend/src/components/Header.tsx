import {
  ChevronDown,
  Gamepad2,
  History,
  LogOut,
  Monitor,
  Moon,
  Sun,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import BrandMascot from './BrandMascot'
import type { ThemePreference } from './ThemeProvider'
import { useTheme } from './ThemeProvider'
import { ThemeToggle } from './ThemeToggle'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui'

const themeOptions: Array<{
  value: ThemePreference
  label: string
  description: string
  icon: typeof Monitor
}> = [
  { value: 'system', label: 'System', description: 'Match this device', icon: Monitor },
  { value: 'light', label: 'Light', description: 'Bright arena', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Night arena', icon: Moon },
]

function DesktopNavLink({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => [
        'relative flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold transition-[color,background-color,transform] duration-180 active:scale-[0.98]',
        isActive
          ? 'bg-accent-subtle text-accent after:absolute after:inset-x-4 after:-bottom-[0.82rem] after:h-0.5 after:rounded-full after:bg-accent'
          : 'text-text-secondary hover:bg-overlay hover:text-text-primary',
      ].join(' ')}
    >
      {children}
    </NavLink>
  )
}

export default function Header() {
  const { user, logout } = useAuth()
  const { preference, setPreference } = useTheme()
  const navigate = useNavigate()
  const [logoutFailed, setLogoutFailed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
      navigate('/auth', { replace: true })
    } catch {
      // The HttpOnly cookie must only be cleared after the server confirms revocation.
      setLogoutFailed(true)
    } finally {
      setLoggingOut(false)
    }
  }

  const initials = user?.username.slice(0, 2).toUpperCase() || 'GA'

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/90 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-surface/78">
        <div className="mx-auto flex min-h-16 w-full max-w-[92rem] items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            to="/"
            aria-label="Games Arena lobby"
            className="group flex min-w-0 items-center gap-2.5 rounded-xl py-1 pr-2 text-text-primary"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center">
              <BrandMascot
                eager
                sizes="40px"
                className="relative h-10 w-10 object-contain transition-transform duration-180 group-hover:-translate-y-0.5 group-hover:scale-105"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-base font-bold leading-tight tracking-wide sm:text-lg">
                Games <span className="text-accent">Arena</span>
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            <DesktopNavLink to="/">Lobby</DesktopNavLink>
            <DesktopNavLink to="/history">History</DesktopNavLink>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex min-h-11 max-w-[11.5rem] items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 text-left transition-[background-color,border-color,transform] duration-180 hover:border-border hover:bg-overlay active:scale-[0.98] sm:px-2"
                  aria-label={`Open account menu for ${user?.username || 'player'}`}
                >
                  <span className="ui-action-primary grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold tracking-wide shadow-accent">
                    {initials}
                  </span>
                  <span className="hidden min-w-0 flex-1 sm:block">
                    <span className="block truncate text-sm font-semibold text-text-primary">{user?.username}</span>
                    <span className="block text-xs text-text-muted">Player menu</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 shrink-0 text-text-muted transition-transform duration-180 group-data-[state=open]:rotate-180 sm:block" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                collisionPadding={12}
                className="w-[min(20rem,calc(100vw-1.5rem))] origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-2xl border-border-strong bg-elevated/98 text-text-primary backdrop-blur-xl"
              >
                  <div className="flex items-center gap-3 px-3 py-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent">
                      <UserRound className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{user?.username}</p>
                      <p className="truncate text-xs text-text-muted">{user?.email || 'Games Arena player'}</p>
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuLabel>
                    Navigate
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <NavLink
                      to="/"
                      end
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-text-secondary outline-none transition-colors duration-120 hover:bg-overlay hover:text-text-primary focus:bg-overlay focus:text-text-primary aria-[current=page]:bg-accent-subtle aria-[current=page]:text-accent"
                    >
                      <Gamepad2 className="h-4 w-4" aria-hidden="true" />
                      Lobby
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <NavLink
                      to="/history"
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-text-secondary outline-none transition-colors duration-120 hover:bg-overlay hover:text-text-primary focus:bg-overlay focus:text-text-primary aria-[current=page]:bg-accent-subtle aria-[current=page]:text-accent"
                    >
                      <History className="h-4 w-4" aria-hidden="true" />
                      Match history
                    </NavLink>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>
                    Appearance
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={preference}
                    onValueChange={(value) => setPreference(value as ThemePreference)}
                  >
                    {themeOptions.map((option) => {
                      const Icon = option.icon
                      return (
                        <DropdownMenuRadioItem
                          key={option.value}
                          value={option.value}
                          aria-label={`${option.label}: ${option.description}`}
                          className="min-h-11 gap-2 text-text-secondary data-[state=checked]:bg-accent-subtle data-[state=checked]:text-accent"
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          <span className="font-medium">{option.label}</span>
                          <span className="ml-auto text-xs text-text-muted">{option.description}</span>
                        </DropdownMenuRadioItem>
                      )
                    })}
                  </DropdownMenuRadioGroup>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={loggingOut}
                    onSelect={() => void handleLogout()}
                    tone="danger"
                    className="min-h-11 gap-3 px-3 font-semibold data-[disabled]:cursor-wait"
                  >
                    {loggingOut ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-danger/25 border-t-danger" aria-hidden="true" />
                    ) : (
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                    )}
                    {loggingOut ? 'Signing out…' : 'Sign out'}
                  </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <Dialog open={logoutFailed} onOpenChange={setLogoutFailed}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Could not sign out</DialogTitle>
            <DialogDescription>
              Your session could not be revoked, so you are still signed in. Check your connection and try again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setLogoutFailed(false)}>Stay signed in</Button>
            <Button variant="danger" loading={loggingOut} loadingText="Trying again…" onClick={() => void handleLogout()}>
              Try again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
