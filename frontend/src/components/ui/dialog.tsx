import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-[oklch(8%_0.025_265_/_0.72)] backdrop-blur-sm data-[state=open]:animate-fade-in',
        className,
      )}
      {...props}
    />
  )
})

export interface DialogContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean
  closeLabel?: string
}

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  { className, children, showCloseButton = true, closeLabel = 'Close dialog', ...props },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-[51] grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-border bg-surface p-5 text-text-primary shadow-lg outline-none data-[state=open]:animate-pop-in sm:p-6',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-text-muted transition-colors duration-120 hover:bg-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-border-focus"
            aria-label={closeLabel}
            title={closeLabel}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})

export const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('grid gap-2 pr-10 text-left', className)} {...props} />
)

export const DialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end', className)} {...props} />
)

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('font-display text-xl font-bold leading-tight tracking-[-0.02em] text-text-primary', className)}
      {...props}
    />
  )
})

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm leading-6 text-text-secondary', className)}
      {...props}
    />
  )
})

export const BottomSheet = DialogPrimitive.Root
export const BottomSheetTrigger = DialogPrimitive.Trigger
export const BottomSheetClose = DialogPrimitive.Close
export const BottomSheetTitle = DialogTitle
export const BottomSheetDescription = DialogDescription
export const BottomSheetHeader = DialogHeader
export const BottomSheetFooter = DialogFooter

export const BottomSheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function BottomSheetContent(
  { className, children, showCloseButton = true, closeLabel = 'Close panel', ...props },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[51] grid max-h-[min(88dvh,48rem)] gap-4 overflow-y-auto rounded-t-3xl border border-b-0 border-border bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-7 text-text-primary shadow-lg outline-none data-[state=open]:animate-sheet-in sm:left-1/2 sm:max-w-2xl sm:-translate-x-1/2 sm:px-6',
          className,
        )}
        {...props}
      >
        <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-12 -translate-x-1/2 rounded-full bg-border-strong" />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-text-muted transition-colors duration-120 hover:bg-overlay hover:text-text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-border-focus"
            aria-label={closeLabel}
            title={closeLabel}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
