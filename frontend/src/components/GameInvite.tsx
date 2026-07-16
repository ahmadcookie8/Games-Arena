import { useEffect, useRef, useState } from 'react'
import { Button } from './ui'

interface Props {
  gameCode: string
}

export default function GameInvite({ gameCode }: Props) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
  }, [])

  async function copyCode() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(gameCode)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }

    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = window.setTimeout(() => setCopyStatus('idle'), 2400)
  }

  return (
    <div className="rounded-2xl border border-warning/30 bg-warning-subtle p-4 text-center shadow-sm">
      <p className="mb-2 text-sm text-warning-text">Share this code to invite a player</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="font-mono text-2xl font-bold tracking-widest text-text-primary">{gameCode}</span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => { void copyCode() }}
          className={copyStatus === 'copied' ? 'animate-pulse-once' : undefined}
        >
          {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'failed' ? 'Copy failed' : 'Copy code'}
        </Button>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {copyStatus === 'copied' ? 'Game code copied to clipboard.' : copyStatus === 'failed' ? 'Game code could not be copied.' : ''}
      </span>
    </div>
  )
}
