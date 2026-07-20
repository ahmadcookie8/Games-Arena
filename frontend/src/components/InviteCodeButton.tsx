import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { Button } from './ui'

interface InviteCodeButtonProps {
  gameCode: string
  copyable?: boolean
  onCopyError?: (message: string, trigger: HTMLButtonElement | null) => void
  className?: string
}

export default function InviteCodeButton({
  gameCode,
  copyable = true,
  onCopyError,
  className,
}: InviteCodeButtonProps) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<number | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
  }, [])

  async function copyCode() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard access is unavailable in this browser.')
      await navigator.clipboard.writeText(gameCode)
      setCopied(true)
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
      onCopyError?.(`The invite code could not be copied. The code is ${gameCode}; select it here and copy it manually.`, triggerRef.current)
    }
  }

  if (!copyable) {
    return (
      <span className={cn('inline-flex items-center gap-2 text-xs font-semibold text-text-secondary', className)}>
        <span>Game code</span>
        <span className="rounded-lg border border-border bg-elevated px-2.5 py-1 font-mono tracking-[0.14em] text-text-primary">
          {gameCode}
        </span>
      </span>
    )
  }

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => { void copyCode() }}
        className={cn('font-mono tracking-[0.12em]', copied && 'animate-pulse-once')}
        aria-label={copied ? `Invite code ${gameCode} copied` : `Copy invite code ${gameCode}`}
      >
        {copied ? <Check aria-hidden="true" className="h-4 w-4 text-success" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
        <span className="select-text">{gameCode}</span>
        <span className="font-sans text-[0.65rem] font-bold uppercase tracking-[0.08em] text-text-muted">
          {copied ? 'Copied' : 'Copy'}
        </span>
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Invite code copied to clipboard.' : ''}
      </span>
    </span>
  )
}
