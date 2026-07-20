import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'
import './tactile-button.css'

export const buttonVariants = cva(
  'tactile-button relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-semibold tracking-[-0.01em] transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-180 ease-out focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'tactile-button--primary ui-action-primary border-transparent',
        secondary: 'tactile-button--secondary border-border-control bg-surface text-text-primary hover:border-accent-muted hover:bg-elevated',
        ghost: 'tactile-button--ghost border-border bg-transparent text-text-secondary hover:border-border-control hover:bg-overlay hover:text-text-primary',
        danger: 'tactile-button--danger ui-action-danger border-transparent',
        success: 'tactile-button--success ui-action-success border-transparent',
      },
      size: {
        sm: 'min-h-9 px-3 py-1.5 text-xs',
        md: 'min-h-11 px-4 py-2.5',
        lg: 'min-h-12 px-5 py-3 text-base',
        icon: 'h-11 w-11 p-0',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  loadingText?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    fullWidth,
    loading = false,
    loadingText,
    disabled,
    type = 'button',
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {loading && loadingText !== undefined ? loadingText : children}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'aria-label'> {
  label: string
  icon?: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, children, variant = 'ghost', title, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      size="icon"
      variant={variant}
      aria-label={label}
      title={title ?? label}
      {...props}
    >
      {icon ?? children}
    </Button>
  )
})
