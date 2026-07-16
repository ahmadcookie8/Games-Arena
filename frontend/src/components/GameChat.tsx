import { useEffect, useId, useRef, useState } from 'react'
import type { ChatMessage } from '../types/game'

interface Props {
  messages: ChatMessage[]
  currentUserId?: string
  onSend: (text: string) => Promise<{ success: boolean; error?: string; handledGlobally?: boolean }>
  variant?: 'card' | 'embedded'
}

export default function GameChat({ messages, currentUserId, onSend, variant = 'card' }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputId = useId()
  const errorId = `${inputId}-error`

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setIsSending(true)
    setError(null)
    try {
      const result = await onSend(trimmed)
      if (result.success) {
        setText('')
      } else if (!result.handledGlobally) {
        setError(result.error || 'Message failed')
      }
    } catch {
      setError('Message failed. Check your connection and try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className={variant === 'card' ? 'rounded-2xl border border-border/90 bg-surface/94 p-4 shadow-sm backdrop-blur-xl' : 'min-w-0'}>
      {variant === 'card' && <h3 className="mb-3 text-base font-semibold text-text-primary">Chat</h3>}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Game chat messages"
        className={`${variant === 'embedded' ? 'max-h-[min(23rem,48svh)]' : 'max-h-64'} space-y-2 overflow-y-auto rounded-xl bg-page/70 p-2`}
      >
        {messages.length === 0 && <p className="px-3 py-6 text-center text-sm text-text-muted">No messages yet</p>}
        {messages.map((message) => {
          const isMine = message.userId === currentUserId
          return (
            <div key={message.messageId} className={`rounded-lg border px-3 py-2 text-sm ${isMine ? 'border-accent/30 bg-accent-subtle text-accent' : 'border-border bg-elevated text-text-primary'}`}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold">{message.username}</span>
                <time className="shrink-0 text-[0.65rem] text-text-muted">{formatTime(message.timestamp)}</time>
              </div>
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
            </div>
          )
        })}
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label htmlFor={inputId} className="sr-only">Message this lobby</label>
        <input
          id={inputId}
          name="game-chat-message"
          value={text}
          maxLength={500}
          onChange={(event) => setText(event.target.value)}
          placeholder="Message this lobby"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/20"
        />
        <button type="submit" disabled={isSending || !text.trim()} className="ui-action-primary interactive-lift min-h-11 rounded-xl px-3 py-2 text-sm font-semibold shadow-accent disabled:cursor-not-allowed disabled:opacity-50">
          Send
        </button>
      </form>
      {error && <p id={errorId} role="alert" className="mt-2 text-xs text-danger-text">{error}</p>}
    </div>
  )
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
