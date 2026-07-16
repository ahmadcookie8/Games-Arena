import { Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { IconButton } from './ui'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'

  return (
    <IconButton
      onClick={toggleTheme}
      label={`Switch to ${nextTheme} mode`}
      title={`Using ${resolvedTheme} mode`}
      className={`group shadow-none ${className}`}
    >
      <span className="relative grid h-5 w-5 place-items-center overflow-hidden">
        {resolvedTheme === 'dark' ? (
          <Sun className="h-[1.1rem] w-[1.1rem] transition-transform duration-180 group-hover:rotate-12" aria-hidden="true" />
        ) : (
          <Moon className="h-[1.1rem] w-[1.1rem] transition-transform duration-180 group-hover:-rotate-12" aria-hidden="true" />
        )}
      </span>
    </IconButton>
  )
}
