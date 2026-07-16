import { type CSSProperties, type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  shape?: 'line' | 'block' | 'circle'
}

export function Skeleton({ className, width, height, shape = 'block', style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative isolate overflow-hidden bg-overlay after:absolute after:inset-0 after:animate-shimmer after:bg-[linear-gradient(90deg,transparent,oklch(100%_0_0_/_0.34),transparent)]',
        shape === 'line' && 'h-4 rounded-full',
        shape === 'block' && 'rounded-xl',
        shape === 'circle' && 'aspect-square rounded-full',
        className,
      )}
      style={{ width, height, ...style }}
      {...props}
    />
  )
}

export function SkeletonCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-border bg-surface p-5 shadow-sm', className)} {...props}>
      <Skeleton className="mb-4 aspect-[16/9] w-full" />
      <Skeleton shape="line" className="mb-3 w-2/3" />
      <Skeleton shape="line" className="mb-2 w-full" />
      <Skeleton shape="line" className="w-4/5" />
    </div>
  )
}
