import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme, type ThemePreference } from './ThemeProvider'

function ThemeProbe() {
  const { preference, resolvedTheme, setPreference } = useTheme()
  const options: ThemePreference[] = ['system', 'light', 'dark']

  return (
    <div>
      <output aria-label="Theme state">{preference}:{resolvedTheme}</output>
      {options.map((option) => (
        <button key={option} type="button" onClick={() => setPreference(option)}>
          {option}
        </button>
      ))}
    </div>
  )
}

function installMatchMedia(initiallyDark: boolean) {
  let changeListener: ((event: MediaQueryListEvent) => void) | undefined
  const mediaQuery = {
    matches: initiallyDark,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === 'change') changeListener = listener
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList & { matches: boolean }

  vi.mocked(window.matchMedia).mockReturnValue(mediaQuery)
  return {
    setDark(matches: boolean) {
      mediaQuery.matches = matches
      changeListener?.({ matches } as MediaQueryListEvent)
    },
  }
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.themePreference
  })

  it('defaults to the system theme and follows system changes', async () => {
    const media = installMatchMedia(true)
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)

    expect(screen.getByLabelText('Theme state')).toHaveTextContent('system:dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).toHaveAttribute('data-theme-preference', 'system')

    media.setDark(false)
    expect(await screen.findByText('system:light')).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('light')
  })

  it('restores and persists an explicit preference', async () => {
    const user = userEvent.setup()
    installMatchMedia(false)
    window.localStorage.setItem('ga-theme', 'dark')
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)

    expect(screen.getByLabelText('Theme state')).toHaveTextContent('dark:dark')
    await user.click(screen.getByRole('button', { name: 'light' }))
    expect(screen.getByLabelText('Theme state')).toHaveTextContent('light:light')
    expect(window.localStorage.getItem('ga-theme')).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })
})
