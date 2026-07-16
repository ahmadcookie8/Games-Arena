import { AlertTriangle, LoaderCircle, RadioTower, SearchX, type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { EmptyState } from './empty-state'

export type RouteStateTone = 'neutral' | 'danger' | 'error' | 'warning' | 'offline' | 'not-found'

export interface RouteStateProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  secondaryAction?: ReactNode
  tone?: RouteStateTone
  loading?: boolean
  loadingLabel?: string
  className?: string
  fullPage?: boolean
}

const toneIcons: Record<Exclude<RouteStateTone, 'neutral'>, LucideIcon> = {
  danger: AlertTriangle,
  error: AlertTriangle,
  warning: AlertTriangle,
  offline: RadioTower,
  'not-found': SearchX,
}

export function RouteState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  tone = 'neutral',
  loading = false,
  loadingLabel = 'Loading',
  className,
  fullPage = false,
}: RouteStateProps) {
  const ToneIcon = tone === 'neutral' ? null : toneIcons[tone]
  const stateIcon = loading
    ? <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin" />
    : icon ?? (ToneIcon ? <ToneIcon aria-hidden="true" className="h-7 w-7" /> : undefined)
  const stateRole = loading || tone === 'warning' || tone === 'offline'
    ? 'status'
    : tone === 'danger' || tone === 'error'
      ? 'alert'
      : undefined

  return (
    <section
      role={stateRole}
      aria-live={loading ? 'polite' : undefined}
      aria-busy={loading || undefined}
      className={cn(fullPage && 'grid min-h-[60dvh] place-items-center', className)}
    >
      <EmptyState
        icon={stateIcon}
        eyebrow={loading ? loadingLabel : undefined}
        title={title}
        description={description}
        action={loading ? undefined : action}
        secondaryAction={loading ? undefined : secondaryAction}
        className={cn(
          'mx-auto max-w-2xl',
          (tone === 'danger' || tone === 'error') && '[&>div:first-child]:border-danger/30 [&>div:first-child]:bg-danger-subtle [&>div:first-child]:text-danger-text',
          tone === 'warning' && '[&>div:first-child]:border-warning/30 [&>div:first-child]:bg-warning-subtle [&>div:first-child]:text-warning-text',
        )}
      />
    </section>
  )
}
