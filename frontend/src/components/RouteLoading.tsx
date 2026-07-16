import BrandMascot from './BrandMascot'
import PageBackdrop from './PageBackdrop'

interface RouteLoadingProps {
  label?: string
  compact?: boolean
}

export default function RouteLoading({ label = 'Loading Games Arena', compact = false }: RouteLoadingProps) {
  if (compact) {
    return (
      <main id="main-content" tabIndex={-1} className="relative flex min-h-[18rem] items-center justify-center px-4 py-12 outline-none">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface/90 px-5 py-3 text-sm font-medium text-text-secondary shadow-md backdrop-blur-xl" role="status" aria-live="polite">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center" aria-hidden="true">
            <span className="absolute inset-1 animate-pulse rounded-full bg-accent/20 blur-md" />
            <BrandMascot eager sizes="44px" className="relative h-11 w-11 object-contain" />
          </span>
          <span>{label}</span>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex min-h-screen min-h-[100dvh] items-center justify-center overflow-hidden bg-page px-4">
      <PageBackdrop intensity="quiet" />
      <div className="relative flex flex-col items-center text-center" role="status" aria-live="polite">
        <div className="relative mb-5">
          <div className="absolute inset-1 animate-pulse rounded-full bg-accent/20 blur-xl" aria-hidden="true" />
          <BrandMascot eager sizes="80px" className="relative h-20 w-20 object-contain" />
        </div>
        <p className="font-display text-lg font-semibold tracking-wide text-text-primary">{label}</p>
        <div className="mt-4 h-1.5 w-40 overflow-hidden rounded-full bg-overlay" aria-hidden="true">
          <span className="block h-full w-full animate-pulse rounded-full bg-accent" />
        </div>
      </div>
    </main>
  )
}
