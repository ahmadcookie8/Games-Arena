import { AlertTriangle, CircleCheck, Info, ShieldAlert } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui'
import type { ButtonProps } from './ui'

export type ModalVariant = 'info' | 'warning' | 'danger' | 'success'

export interface ModalAction {
  label: string
  onClick: () => void
  variant?: ButtonProps['variant']
  loading?: boolean
  loadingText?: ReactNode
  disabled?: boolean
}

interface ModalProps {
  isOpen: boolean
  title: string
  children: ReactNode
  variant?: ModalVariant
  primaryAction?: ModalAction
  secondaryAction?: ModalAction
  onClose: () => void
}

const variantStyles: Record<ModalVariant, string> = {
  info: 'border-info/30 bg-info-subtle text-info-text',
  warning: 'border-warning/30 bg-warning-subtle text-warning-text',
  danger: 'border-danger/30 bg-danger-subtle text-danger-text',
  success: 'border-success/30 bg-success-subtle text-success-text',
}

const variantIcons = {
  info: Info,
  warning: AlertTriangle,
  danger: ShieldAlert,
  success: CircleCheck,
} satisfies Record<ModalVariant, typeof Info>

export default function Modal({
  isOpen,
  title,
  children,
  variant = 'info',
  primaryAction,
  secondaryAction,
  onClose,
}: ModalProps) {
  const primary = primaryAction ?? { label: 'Close', onClick: onClose }
  const VariantIcon = variantIcons[variant]
  const childrenAreDescription = typeof children === 'string' || typeof children === 'number'
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)

  if (isOpen && !wasOpenRef.current && typeof document !== 'undefined') {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  }
  wasOpenRef.current = isOpen

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          const restoreTarget = restoreFocusRef.current
          if (!restoreTarget?.isConnected) return
          event.preventDefault()
          restoreTarget.focus()
          restoreFocusRef.current = null
        }}
      >
        <DialogHeader className="grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 pr-10">
          <div className={`row-span-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${variantStyles[variant]}`}>
            <VariantIcon aria-hidden="true" className="h-5 w-5" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          {childrenAreDescription ? (
            <DialogDescription asChild>
              <div className="mt-1 text-sm leading-6 text-text-secondary">{children}</div>
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">Complete the controls in this dialog or close it to return to the game.</DialogDescription>
          )}
        </DialogHeader>

        {!childrenAreDescription && <div className="text-sm leading-6 text-text-secondary">{children}</div>}

        <DialogFooter>
          {secondaryAction && (
            <Button
              type="button"
              variant={secondaryAction.variant ?? 'secondary'}
              loading={secondaryAction.loading}
              loadingText={secondaryAction.loadingText}
              disabled={secondaryAction.disabled}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
          <Button
            type="button"
            variant={primary.variant ?? (variant === 'danger' ? 'danger' : variant === 'success' ? 'success' : 'primary')}
            loading={primary.loading}
            loadingText={primary.loadingText}
            disabled={primary.disabled}
            onClick={primary.onClick}
          >
            {primary.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
