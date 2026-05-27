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
    <div className="bg-gray-800 rounded-xl p-4 text-center">
      <p className="text-gray-400 text-sm mb-2">Share this code to invite a friend</p>
      <div className="flex items-center gap-2 justify-center">
        <span className="text-2xl font-mono font-bold tracking-widest">{gameCode}</span>
        <button
          onClick={copyCode}
          className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
