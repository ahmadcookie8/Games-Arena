import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
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
        'arena-dialog-overlay fixed inset-0 z-50 bg-[oklch(8%_0.025_265_/_0.72)] backdrop-blur-sm',
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
          'fixed left-1/2 top-1/2 z-[51] grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-border bg-surface p-5 text-text-primary shadow-lg outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in sm:p-6',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-text-muted transition-[color,background-color,transform] duration-120 hover:bg-overlay hover:text-text-primary active:translate-y-px active:scale-95 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-border-focus"
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

const SHEET_DISMISS_DISTANCE_PX = 96
const SHEET_DISMISS_VELOCITY_PX_PER_MS = 0.65

interface SheetDragState {
  pointerId: number
  startY: number
  startTime: number
  lastY: number
  lastTime: number
  velocity: number
}

/** Kept as a pure helper so the distance and velocity contract is easy to verify. */
export function shouldDismissBottomSheet(distance: number, velocity: number, reducedMotion = false): boolean {
  return distance >= SHEET_DISMISS_DISTANCE_PX
    || (!reducedMotion && velocity >= SHEET_DISMISS_VELOCITY_PX_PER_MS)
}

export interface AnimatedSheetBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Changes only for deliberate panel/tab navigation, never for live game updates. */
  contentKey?: string | number
}

export interface BottomSheetContentProps extends DialogContentProps {
  /** Closes the controlled sheet after a completed drag gesture. */
  onSwipeDismiss?: () => void
}

/**
 * Smooths deliberate bottom-sheet panel changes without animating live content.
 * ResizeObserver keeps the last natural height current; contentKey is the only
 * value that can trigger the height transition.
 */
export function AnimatedSheetBody({
  children,
  className,
  contentKey,
  ...props
}: AnimatedSheetBodyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const previousHeightRef = useRef<number | null>(null)
  const previousKeyRef = useRef(contentKey)
  const firstLayoutRef = useRef(true)

  useLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    let frameId: number | undefined
    let resetTimer: number | undefined
    let panelTimer: number | undefined
    const nextHeight = content.getBoundingClientRect().height || content.scrollHeight
    const previousHeight = previousHeightRef.current
    const keyChanged = !firstLayoutRef.current && previousKeyRef.current !== contentKey
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const finishTransition = () => {
      if (frameId !== undefined) window.cancelAnimationFrame(frameId)
      if (resetTimer !== undefined) window.clearTimeout(resetTimer)
      container.style.height = 'auto'
      container.style.overflow = ''
      delete container.dataset.animating
    }

    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target === container && event.propertyName === 'height') finishTransition()
    }

    const finishPanelTransition = () => {
      if (panelTimer !== undefined) window.clearTimeout(panelTimer)
      delete content.dataset.entering
    }

    const handlePanelAnimationEnd = (event: AnimationEvent) => {
      if (event.target === content) finishPanelTransition()
    }

    if (keyChanged && !reduceMotion) {
      // Restart the one-shot panel transition even when tabs change rapidly.
      delete content.dataset.entering
      void content.offsetHeight
      content.dataset.entering = 'true'
      content.addEventListener('animationend', handlePanelAnimationEnd)
      panelTimer = window.setTimeout(finishPanelTransition, 320)
    } else {
      finishPanelTransition()
    }

    if (
      keyChanged
      && !reduceMotion
      && previousHeight !== null
      && Math.abs(previousHeight - nextHeight) > 1
    ) {
      container.dataset.animating = 'true'
      container.style.height = `${previousHeight}px`
      container.style.overflow = 'hidden'
      // Commit the starting height before transitioning to the newly measured panel.
      void container.offsetHeight
      frameId = window.requestAnimationFrame(() => {
        container.style.height = `${nextHeight}px`
      })
      container.addEventListener('transitionend', handleTransitionEnd)
      resetTimer = window.setTimeout(finishTransition, 320)
    } else {
      finishTransition()
    }

    previousHeightRef.current = nextHeight
    previousKeyRef.current = contentKey
    firstLayoutRef.current = false

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver((entries) => {
          if (container.dataset.animating === 'true') return
          const observedHeight = entries[0]?.contentRect.height
          previousHeightRef.current = observedHeight || content.getBoundingClientRect().height || content.scrollHeight
        })
    resizeObserver?.observe(content)

    return () => {
      resizeObserver?.disconnect()
      container.removeEventListener('transitionend', handleTransitionEnd)
      content.removeEventListener('animationend', handlePanelAnimationEnd)
      if (frameId !== undefined) window.cancelAnimationFrame(frameId)
      if (resetTimer !== undefined) window.clearTimeout(resetTimer)
      if (panelTimer !== undefined) window.clearTimeout(panelTimer)
      delete content.dataset.entering
    }
  }, [contentKey])

  return (
    <div ref={containerRef} className={cn('arena-animated-sheet-body', className)} {...props}>
      <div ref={contentRef} className="arena-animated-sheet-body__content">
        {children}
      </div>
    </div>
  )
}

export const BottomSheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  BottomSheetContentProps
>(function BottomSheetContent(
  {
    className,
    children,
    showCloseButton = true,
    closeLabel = 'Close panel',
    onSwipeDismiss,
    onOpenAutoFocus,
    onCloseAutoFocus,
    ...props
  },
  ref,
) {
  const contentRef = useRef<ElementRef<typeof DialogPrimitive.Content> | null>(null)
  const dragRef = useRef<SheetDragState | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const setContentRef = useCallback((node: ElementRef<typeof DialogPrimitive.Content> | null) => {
    contentRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as { current: ElementRef<typeof DialogPrimitive.Content> | null }).current = node
  }, [ref])

  const updateDragOffset = useCallback((distance: number) => {
    contentRef.current?.style.setProperty('--sheet-drag-offset', `${Math.max(0, distance)}px`)
  }, [])

  const handleOpenAutoFocus = useCallback((event: Event) => {
    const activeElement = document.activeElement
    returnFocusRef.current = activeElement instanceof HTMLElement
      && activeElement !== document.body
      && !contentRef.current?.contains(activeElement)
      ? activeElement
      : null
    onOpenAutoFocus?.(event)
  }, [onOpenAutoFocus])

  const handleCloseAutoFocus = useCallback((event: Event) => {
    onCloseAutoFocus?.(event)
    const returnTarget = returnFocusRef.current
    returnFocusRef.current = null
    if (!event.defaultPrevented && returnTarget?.isConnected) {
      event.preventDefault()
      returnTarget.focus({ preventScroll: true })
    }
  }, [onCloseAutoFocus])

  const handleDragStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.isPrimary === false) return
    const content = contentRef.current
    if (!content) return

    const time = event.timeStamp || performance.now()
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTime: time,
      lastY: event.clientY,
      lastTime: time,
      velocity: 0,
    }
    content.dataset.dragging = 'true'
    updateDragOffset(0)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }, [updateDragOffset])

  const handleDragMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return

    const time = event.timeStamp || performance.now()
    const elapsed = Math.max(time - drag.lastTime, 1)
    drag.velocity = (event.clientY - drag.lastY) / elapsed
    drag.lastY = event.clientY
    drag.lastTime = time
    updateDragOffset(event.clientY - drag.startY)
    event.preventDefault()
  }, [updateDragOffset])

  const finishDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    dragRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const content = contentRef.current
    if (!content) return
    delete content.dataset.dragging

    const time = event.timeStamp || performance.now()
    const distance = Math.max(0, event.clientY - drag.startY)
    const averageVelocity = distance / Math.max(time - drag.startTime, 1)
    const recentVelocity = time - drag.lastTime <= 100 ? drag.velocity : 0
    const velocity = Math.max(averageVelocity, recentVelocity)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!cancelled && onSwipeDismiss && shouldDismissBottomSheet(distance, velocity, reducedMotion)) {
      updateDragOffset(distance)
      content.dataset.swipeDismissed = 'true'
      onSwipeDismiss()
      return
    }

    window.requestAnimationFrame(() => updateDragOffset(0))
  }, [onSwipeDismiss, updateDragOffset])

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={setContentRef}
        className={cn(
          'arena-bottom-sheet fixed inset-x-0 bottom-0 z-[51] grid max-h-[min(88dvh,48rem)] gap-4 overflow-y-auto rounded-t-3xl border border-b-0 border-border bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-12 text-text-primary shadow-lg outline-none sm:left-1/2 sm:max-w-2xl sm:px-6',
          className,
        )}
        onOpenAutoFocus={handleOpenAutoFocus}
        onCloseAutoFocus={handleCloseAutoFocus}
        {...props}
      >
        <div
          aria-hidden="true"
          className="arena-bottom-sheet__drag-handle absolute left-1/2 top-0 flex h-11 w-28 -translate-x-1/2 touch-none items-center justify-center"
          data-bottom-sheet-handle=""
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={(event) => finishDrag(event, false)}
          onPointerCancel={(event) => finishDrag(event, true)}
          onLostPointerCapture={(event) => finishDrag(event, true)}
        >
          <span className="arena-bottom-sheet__handle-bar h-1 w-12 rounded-full bg-border-strong" />
        </div>
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-xl text-text-muted transition-[color,background-color,transform] duration-120 hover:bg-overlay hover:text-text-primary active:translate-y-px active:scale-95 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-border-focus"
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
