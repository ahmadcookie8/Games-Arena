import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

export const badgeVariants = cva(
  'inline-flex min-h-6 items-center justify-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none tracking-[0.01em]',
  {
    variants: {
      variant: {
        default: 'border-border bg-elevated text-text-secondary',
        neutral: 'border-border bg-overlay text-text-primary',
        accent: 'border-accent-muted/45 bg-accent-subtle text-accent',
        success: 'border-success/30 bg-success-subtle text-success-text',
        warning: 'border-warning/30 bg-warning-subtle text-warning-text',
        danger: 'border-danger/30 bg-danger-subtle text-danger-text',
        info: 'border-info/30 bg-info-subtle text-info-text',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
