import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('ga-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('ga-theme', 'light')
    }
  }, [isDark])

  return (
    <button
      type="button"
      onClick={() => setIsDark((current) => !current)}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-overlay hover:text-text-primary md:h-9 md:w-9"
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}
