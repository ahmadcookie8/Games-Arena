import { ReactNode, useEffect, useRef } from 'react'

export type ModalVariant = 'info' | 'warning' | 'danger' | 'success'

interface ModalAction {
  label: string
  onClick: () => void
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

const variantClasses: Record<ModalVariant, string> = {
  info: 'bg-info-subtle text-info',
  warning: 'bg-warning-subtle text-warning-text',
  danger: 'bg-danger-subtle text-danger-text',
  success: 'bg-success-subtle text-success-text',
}

export default function Modal({
  isOpen,
  title,
  children,
  variant = 'info',
  primaryAction,
  secondaryAction,
  onClose,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!isOpen) return

    previousFocusRef.current = document.activeElement
    panelRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const primary = primaryAction ?? { label: 'Close', onClick: onClose }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" role="presentation">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 cursor-pointer bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="relative w-full max-w-md animate-scale-in rounded-2xl border border-border/90 bg-surface/95 p-4 shadow-lg outline-none backdrop-blur-xl sm:p-5"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${variantClasses[variant]}`}>
            <span className="text-base font-bold" aria-hidden="true">!</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="text-lg font-semibold text-text-primary">{title}</h2>
            <div className="mt-1 text-sm leading-6 text-text-secondary">{children}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-overlay hover:text-text-primary"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="min-h-11 cursor-pointer rounded-lg border border-border bg-elevated px-4 py-2 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-overlay"
            >
              {secondaryAction.label}
            </button>
          )}
          <button
            type="button"
            onClick={primary.onClick}
            className="min-h-11 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent shadow-accent transition-colors duration-150 hover:bg-accent-hover"
          >
            {primary.label}
          </button>
        </div>
      </div>
    </div>
  )
}
