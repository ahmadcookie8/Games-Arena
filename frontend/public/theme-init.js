(() => {
  const preferenceQuery = '(prefers-color-scheme: dark)'

  try {
    const stored = localStorage.getItem('ga-theme')
    const preference = stored === 'dark' || stored === 'light' || stored === 'system'
      ? stored
      : 'system'
    const systemTheme = window.matchMedia(preferenceQuery).matches ? 'dark' : 'light'
    const resolvedTheme = preference === 'system' ? systemTheme : preference
    const root = document.documentElement

    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.classList.toggle('light', resolvedTheme === 'light')
    root.dataset.theme = resolvedTheme
    root.dataset.themePreference = preference
    root.style.colorScheme = resolvedTheme
  } catch {
    const resolvedTheme = window.matchMedia?.(preferenceQuery).matches ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.classList.toggle('light', resolvedTheme === 'light')
    document.documentElement.style.colorScheme = resolvedTheme
  }
})()
