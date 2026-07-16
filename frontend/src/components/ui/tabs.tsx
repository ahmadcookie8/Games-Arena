import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode, useRef } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/cn'

export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn('inline-flex min-h-11 items-center gap-1 rounded-xl border border-border bg-elevated p-1 text-text-secondary', className)}
      {...props}
    />
  )
})

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex min-h-9 flex-1 select-none items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold outline-none transition-[color,background-color,box-shadow,transform] duration-180 focus-visible:ring-3 focus-visible:ring-border-focus disabled:pointer-events-none disabled:text-text-disabled data-[state=active]:bg-surface data-[state=active]:text-text-primary data-[state=active]:shadow-sm hover:text-text-primary',
        className,
      )}
      {...props}
    />
  )
})

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn('mt-4 outline-none data-[state=active]:animate-fade-in focus-visible:ring-3 focus-visible:ring-border-focus', className)}
      {...props}
    />
  )
})

export interface SegmentedControlItem {
  value: string
  label: ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps {
  items: SegmentedControlItem[]
  value: string
  onValueChange: (value: string) => void
  ariaLabel: string
  className?: string
}

export function SegmentedControl({ items, value, onValueChange, ariaLabel, className }: SegmentedControlProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  function selectAt(index: number) {
    if (items.length === 0) return
    let nextIndex = (index + items.length) % items.length
    let attempts = 0
    while (items[nextIndex]?.disabled && attempts < items.length) {
      nextIndex = (nextIndex + 1) % items.length
      attempts += 1
    }
    const item = items[nextIndex]
    if (!item || item.disabled) return
    onValueChange(item.value)
    window.requestAnimationFrame(() => itemRefs.current[nextIndex]?.focus())
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      selectAt(index + 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      selectAt(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectAt(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      selectAt(items.length - 1)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid min-h-11 w-full gap-1 rounded-xl border border-border bg-elevated p-1 text-text-secondary', className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item, index) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(element) => { itemRefs.current[index] = element }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className="inline-flex min-h-9 select-none items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold outline-none transition-[color,background-color,box-shadow,transform] duration-180 focus-visible:ring-3 focus-visible:ring-border-focus disabled:pointer-events-none disabled:text-text-disabled aria-checked:bg-surface aria-checked:text-text-primary aria-checked:shadow-sm hover:text-text-primary"
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
