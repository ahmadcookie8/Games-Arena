import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  AnimatedSheetBody,
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from '.'
import { shouldDismissBottomSheet } from './dialog'

function OpenSheet({ onOpenChange = () => undefined }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(true)

  return (
    <BottomSheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        onOpenChange(nextOpen)
      }}
    >
      <BottomSheetContent
        onSwipeDismiss={() => {
          setOpen(false)
          onOpenChange(false)
        }}
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Game details</BottomSheetTitle>
          <BottomSheetDescription>Players and game controls.</BottomSheetDescription>
        </BottomSheetHeader>
        <p>Panel content</p>
      </BottomSheetContent>
    </BottomSheet>
  )
}

function ExternallyOpenedSheet() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open game details</button>
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent onSwipeDismiss={() => setOpen(false)}>
          <BottomSheetHeader>
            <BottomSheetTitle>Game details</BottomSheetTitle>
            <BottomSheetDescription>Players and game controls.</BottomSheetDescription>
          </BottomSheetHeader>
          <p>Panel content</p>
        </BottomSheetContent>
      </BottomSheet>
    </>
  )
}

describe('BottomSheet', () => {
  it('stays open when a non-Radix dock control opens it', async () => {
    const user = userEvent.setup()
    render(<ExternallyOpenedSheet />)

    const trigger = screen.getByRole('button', { name: 'Open game details' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Game details' })
    expect(dialog).toHaveClass('arena-bottom-sheet')
    expect(document.querySelector('.arena-dialog-overlay')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Game details' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('dismisses through the visible close control', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<OpenSheet onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('dismisses when the backdrop is pressed', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<OpenSheet onOpenChange={onOpenChange} />)

    const overlay = document.querySelector<HTMLElement>('.arena-dialog-overlay')
    expect(overlay).not.toBeNull()
    await user.click(overlay!)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('uses the requested distance and velocity dismissal thresholds', () => {
    expect(shouldDismissBottomSheet(95, 0.64)).toBe(false)
    expect(shouldDismissBottomSheet(96, 0)).toBe(true)
    expect(shouldDismissBottomSheet(20, 0.65)).toBe(true)
    expect(shouldDismissBottomSheet(20, 0.65, true)).toBe(false)
  })

  it('follows a handle drag and dismisses after 96 pixels', () => {
    const onOpenChange = vi.fn()
    render(<OpenSheet onOpenChange={onOpenChange} />)

    const dialog = screen.getByRole('dialog', { name: 'Game details' })
    const handle = document.querySelector<HTMLElement>('[data-bottom-sheet-handle]')
    expect(handle).not.toBeNull()

    fireEvent.pointerDown(handle!, { button: 0, clientY: 100, pointerId: 1, isPrimary: true })
    fireEvent.pointerMove(handle!, { clientY: 220, pointerId: 1, isPrimary: true })
    expect(dialog.style.getPropertyValue('--sheet-drag-offset')).toBe('120px')

    fireEvent.pointerUp(handle!, { clientY: 220, pointerId: 1, isPrimary: true })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('snaps back after a cancelled short drag', async () => {
    const onOpenChange = vi.fn()
    render(<OpenSheet onOpenChange={onOpenChange} />)

    const dialog = screen.getByRole('dialog', { name: 'Game details' })
    const handle = document.querySelector<HTMLElement>('[data-bottom-sheet-handle]')
    expect(handle).not.toBeNull()

    fireEvent.pointerDown(handle!, { button: 0, clientY: 100, pointerId: 2, isPrimary: true })
    fireEvent.pointerMove(handle!, { clientY: 140, pointerId: 2, isPrimary: true })
    fireEvent.pointerCancel(handle!, { clientY: 140, pointerId: 2, isPrimary: true })

    await act(async () => {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    })

    expect(dialog.style.getPropertyValue('--sheet-drag-offset')).toBe('0px')
    expect(dialog).not.toHaveAttribute('data-dragging')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})

describe('AnimatedSheetBody', () => {
  it('animates measured height only when its deliberate content key changes', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
      const height = this.textContent?.includes('Tall panel') ? 240 : 80
      return {
        x: 0,
        y: 0,
        top: 0,
        right: 0,
        bottom: height,
        left: 0,
        width: 0,
        height,
        toJSON: () => ({}),
      }
    })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })

    const { rerender } = render(
      <AnimatedSheetBody contentKey="players">Short panel</AnimatedSheetBody>,
    )
    const body = document.querySelector<HTMLElement>('.arena-animated-sheet-body')
    expect(body).not.toBeNull()
    expect(body).not.toHaveAttribute('data-animating')

    rerender(<AnimatedSheetBody contentKey="history">Tall panel</AnimatedSheetBody>)
    expect(body).toHaveAttribute('data-animating', 'true')
    expect(body?.style.height).toBe('240px')
    const panel = body?.querySelector<HTMLElement>('.arena-animated-sheet-body__content')
    expect(panel).toHaveAttribute('data-entering', 'true')

    fireEvent.transitionEnd(body!, { propertyName: 'height' })
    fireEvent.animationEnd(panel!)
    expect(body).not.toHaveAttribute('data-animating')
    expect(body?.style.height).toBe('auto')
    expect(panel).not.toHaveAttribute('data-entering')
  })

  it('reveals a changed panel immediately when reduced motion is enabled', () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string): MediaQueryList => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
      const height = this.textContent?.includes('Tall panel') ? 240 : 80
      return {
        x: 0,
        y: 0,
        top: 0,
        right: 0,
        bottom: height,
        left: 0,
        width: 0,
        height,
        toJSON: () => ({}),
      }
    })

    const { rerender } = render(
      <AnimatedSheetBody contentKey="players">Short panel</AnimatedSheetBody>,
    )
    const body = document.querySelector<HTMLElement>('.arena-animated-sheet-body')
    rerender(<AnimatedSheetBody contentKey="history">Tall panel</AnimatedSheetBody>)

    expect(body).not.toHaveAttribute('data-animating')
    expect(body?.style.height).toBe('auto')
    expect(body?.querySelector('.arena-animated-sheet-body__content')).not.toHaveAttribute('data-entering')
  })
})
