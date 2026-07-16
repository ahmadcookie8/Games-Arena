import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  secondaryAction?: ReactNode
  compact?: boolean
}

export function EmptyState({
  icon,
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-elevated/55 px-5 text-center',
        compact ? 'min-h-48 py-7' : 'min-h-72 py-10',
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-muted/35 bg-accent-subtle text-accent shadow-sm">
          {icon}
        </div>
      )}
      {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>}
      <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-text-primary">{title}</h2>
      {description && <div className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">{description}</div>}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
