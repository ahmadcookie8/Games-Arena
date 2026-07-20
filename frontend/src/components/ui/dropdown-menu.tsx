import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '../../lib/cn'

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger
export const DropdownMenuGroup = DropdownPrimitive.Group
export const DropdownMenuPortal = DropdownPrimitive.Portal
export const DropdownMenuSub = DropdownPrimitive.Sub
export const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, collisionPadding = 12, ...props }, ref) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'z-[70] min-w-48 overflow-hidden rounded-xl border border-border bg-surface p-1.5 text-text-primary shadow-lg outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  )
})

interface DropdownMenuItemProps extends ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> {
  inset?: boolean
  tone?: 'default' | 'danger'
}

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.Item>,
  DropdownMenuItemProps
>(function DropdownMenuItem({ className, inset, tone = 'default', ...props }, ref) {
  return (
    <DropdownPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex min-h-11 select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-[color,background-color,transform] duration-120 active:translate-y-px active:scale-[0.99] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent-subtle data-[highlighted]:text-text-primary data-[highlighted]:outline data-[highlighted]:outline-2 data-[highlighted]:outline-border-focus data-[highlighted]:outline-offset-[-2px]',
        inset && 'pl-8',
        tone === 'danger' && 'text-danger-text data-[highlighted]:bg-danger-subtle data-[highlighted]:text-danger-text',
        className,
      )}
      {...props}
    />
  )
})

export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.CheckboxItem>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, checked, ...props }, ref) {
  return (
    <DropdownPrimitive.CheckboxItem
      ref={ref}
      checked={checked}
      className={cn(
        'relative flex min-h-11 select-none items-center rounded-lg py-2 pl-8 pr-2.5 text-sm outline-none transition-[color,background-color,transform] duration-120 active:translate-y-px active:scale-[0.99] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent-subtle data-[highlighted]:outline data-[highlighted]:outline-2 data-[highlighted]:outline-border-focus data-[highlighted]:outline-offset-[-2px]',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex h-4 w-4 items-center justify-center text-accent">
        <DropdownPrimitive.ItemIndicator><Check aria-hidden="true" className="h-4 w-4" /></DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.CheckboxItem>
  )
})

export const DropdownMenuRadioItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.RadioItem>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <DropdownPrimitive.RadioItem
      ref={ref}
      className={cn(
        'relative flex min-h-11 select-none items-center rounded-lg py-2 pl-8 pr-2.5 text-sm outline-none transition-[color,background-color,transform] duration-120 active:translate-y-px active:scale-[0.99] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent-subtle data-[highlighted]:outline data-[highlighted]:outline-2 data-[highlighted]:outline-border-focus data-[highlighted]:outline-offset-[-2px]',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex h-4 w-4 items-center justify-center text-accent">
        <DropdownPrimitive.ItemIndicator><Circle aria-hidden="true" className="h-2.5 w-2.5 fill-current" /></DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.RadioItem>
  )
})

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof DropdownPrimitive.Label>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Label> & { inset?: boolean }
>(function DropdownMenuLabel({ className, inset, ...props }, ref) {
  return (
    <DropdownPrimitive.Label
      ref={ref}
      className={cn('px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted', inset && 'pl-8', className)}
      {...props}
    />
  )
})

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <DropdownPrimitive.Separator ref={ref} className={cn('-mx-0.5 my-1 h-px bg-border', className)} {...props} />
})

export const DropdownMenuSubTrigger = forwardRef<
  ElementRef<typeof DropdownPrimitive.SubTrigger>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.SubTrigger> & { inset?: boolean }
>(function DropdownMenuSubTrigger({ className, inset, children, ...props }, ref) {
  return (
    <DropdownPrimitive.SubTrigger
      ref={ref}
      className={cn('flex min-h-11 select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-[color,background-color,transform] duration-120 active:translate-y-px active:scale-[0.99] data-[state=open]:bg-accent-subtle data-[highlighted]:bg-accent-subtle data-[highlighted]:outline data-[highlighted]:outline-2 data-[highlighted]:outline-border-focus data-[highlighted]:outline-offset-[-2px]', inset && 'pl-8', className)}
      {...props}
    >
      {children}
      <ChevronRight aria-hidden="true" className="ml-auto h-4 w-4 text-text-muted" />
    </DropdownPrimitive.SubTrigger>
  )
})

export const DropdownMenuSubContent = forwardRef<
  ElementRef<typeof DropdownPrimitive.SubContent>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.SubContent>
>(function DropdownMenuSubContent({ className, ...props }, ref) {
  return (
    <DropdownPrimitive.SubContent
      ref={ref}
      className={cn('z-[70] min-w-44 overflow-hidden rounded-xl border border-border bg-surface p-1.5 text-text-primary shadow-lg data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in', className)}
      {...props}
    />
  )
})
