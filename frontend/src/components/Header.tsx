import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import mascot from '../assets/penguin-mascot.png'
import { ThemeToggle } from './ThemeToggle'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/auth')
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
      isActive ? 'bg-accent-subtle text-accent' : 'text-text-secondary hover:bg-overlay hover:text-text-primary'
    }`

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-page/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="group flex min-w-0 cursor-pointer items-center gap-3">
          <img src={mascot} alt="" className="h-10 w-10 object-contain drop-shadow-[0_0_18px_oklch(68%_0.18_252_/_0.45)] transition-transform duration-200 group-hover:scale-105" />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-text-primary">Games <span className="text-accent">Arena</span></p>
            <p className="hidden text-xs text-text-muted sm:block">Live multiplayer lobby</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          <NavLink to="/" end className={navClass}>Dashboard</NavLink>
          <NavLink to="/history" className={navClass}>History</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="hidden max-w-32 truncate text-sm text-text-muted sm:block">@{user?.username}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-11 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-overlay hover:text-text-primary md:min-h-0"
          >
            Logout
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden" aria-label="Mobile navigation">
        <NavLink to="/" end className={navClass}>Dashboard</NavLink>
        <NavLink to="/history" className={navClass}>History</NavLink>
      </nav>
    </header>
  )
}
