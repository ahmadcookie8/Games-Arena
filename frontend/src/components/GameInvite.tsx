import { useState } from 'react'

interface Props {
  gameCode: string
}

export default function GameInvite({ gameCode }: Props) {
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(gameCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-warning/30 bg-warning-subtle p-4 text-center shadow-sm">
      <p className="mb-2 text-sm text-warning-text">Share this code to invite a player</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="font-mono text-2xl font-bold tracking-widest text-text-primary">{gameCode}</span>
        <button
          onClick={copyCode}
          className="cursor-pointer rounded-lg bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-overlay"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
