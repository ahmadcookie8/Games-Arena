(() => {
  try {
    const savedTheme = localStorage.getItem('ga-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', savedTheme === 'dark' || (!savedTheme && prefersDark))
  } catch {
    // Storage can be unavailable in hardened browser contexts; the light theme is a safe fallback.
  }
})()
