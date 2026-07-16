import { ArrowLeft, RefreshCw } from 'lucide-react'
import BrandMascot from './BrandMascot'
import PageBackdrop from './PageBackdrop'
import RouteLoading from './RouteLoading'
import { Button, RouteState } from './ui'

interface GameRouteUnavailableProps {
  title?: string
  description?: string | null
  onBack: () => void
  onRetry?: () => void
}

export function GameRouteLoading({ label }: { label: string }) {
  return <RouteLoading label={label} compact />
}

export function GameRouteUnavailable({
  title = 'This arena is unavailable',
  description,
  onBack,
  onRetry,
}: GameRouteUnavailableProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative isolate min-h-[calc(100dvh-4rem)] overflow-hidden px-4 py-10 outline-none sm:px-6"
    >
      <PageBackdrop intensity="quiet" />
      <RouteState
        fullPage
        tone="not-found"
        icon={<BrandMascot sizes="48px" className="h-12 w-12 object-contain" />}
        title={title}
        description={description || 'The game may have been closed, removed, or opened from an expired link.'}
        action={onRetry ? (
          <Button onClick={onRetry}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </Button>
        ) : undefined}
        secondaryAction={(
          <Button variant={onRetry ? 'secondary' : 'primary'} onClick={onBack}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to lobby
          </Button>
        )}
        className="relative z-10"
      />
    </main>
  )
}
