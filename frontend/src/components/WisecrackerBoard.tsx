import { useEffect, useMemo, useState } from 'react'
import { Game, WisecrackerState } from '../types/game'
import { User } from '../types/user'

type WisecrackerMove =
  | { type: 'startMatch'; maxScore: number }
  | { type: 'refreshPrompt' }
  | { type: 'setPrompt'; prompt: string }
  | { type: 'submitAnswers'; answers: string[] }
  | { type: 'revealNextAnswer' }
  | { type: 'selectRoundWinner'; userId: string }
  | { type: 'startNextRound' }
  | { type: 'returnToLobby' }

interface Props {
  game: Game
  user: User | null
  onMove: (move: WisecrackerMove) => Promise<{ success: boolean; game?: Game; error?: string }>
}

export default function WisecrackerBoard({ game, user, onMove }: Props) {
  const state = game.gameState as unknown as WisecrackerState
  const [maxScore, setMaxScore] = useState(state.maxScore || 3)
  const [prompt, setPrompt] = useState(state.prompt || '')
  const [answers, setAnswers] = useState<string[]>([])
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false)
  const [localAnswersLocked, setLocalAnswersLocked] = useState(false)
  const [isRefreshingPrompt, setIsRefreshingPrompt] = useState(false)

  const playersById = useMemo(() => Object.fromEntries(game.players.map((player) => [player.userId, player])), [game.players])
  const myId = user?._id || ''
  const isHost = state.hostUserId === myId
  const isChooser = state.chooserUserId === myId
  const isActive = state.activePlayerIds.includes(myId)
  const isWaiting = state.waitingPlayerIds.includes(myId)
  const typers = state.activePlayerIds.filter((id) => id !== state.chooserUserId)
  const submittedIds = Object.keys(state.submittedAnswers || {})
  const hasSubmitted = Boolean(myId && state.submittedAnswers?.[myId])
  const answersAreLocked = hasSubmitted || localAnswersLocked
  const revealedIds = state.answerOrder.slice(0, state.revealedCount)
  const allAnswersRevealed = state.answerOrder.length > 0 && state.revealedCount >= state.answerOrder.length

  useEffect(() => {
    setPrompt(state.prompt || '')
  }, [state.prompt, state.phase])

  useEffect(() => {
    const slots = Math.max(state.answerSlots || 0, 0)
    setAnswers(Array.from({ length: slots }, () => ''))
  }, [state.answerSlots, state.phase])

  useEffect(() => {
    if (hasSubmitted) {
      setLocalAnswersLocked(true)
      setIsSubmittingAnswers(false)
    }
  }, [hasSubmitted])

  useEffect(() => {
    if (state.phase === 'prompt' || state.phase === 'lobby' || state.phase === 'roundResult' || state.phase === 'completed') {
      setLocalAnswersLocked(false)
      setIsSubmittingAnswers(false)
    }
  }, [state.phase])

  async function submitAnswers() {
    setIsSubmittingAnswers(true)
    const result = await onMove({ type: 'submitAnswers', answers })
    if (result.success) {
      setLocalAnswersLocked(true)
    } else {
      setIsSubmittingAnswers(false)
    }
  }

  async function refreshPrompt() {
    setIsRefreshingPrompt(true)
    const result = await onMove({ type: 'refreshPrompt' })
    if (!result.success) {
      setIsRefreshingPrompt(false)
    }
  }

  useEffect(() => {
    setIsRefreshingPrompt(false)
  }, [state.prompt])

  async function usePrompt() {
    await onMove({ type: 'setPrompt', prompt })
  }

  function renderFilledAnswer(playerId: string) {
    const playerAnswers = state.submittedAnswers[playerId] || []
    const segments = state.prompt ? state.prompt.split('_') : ['']

    if (!state.prompt.includes('_')) {
      return (
        <p>
          {state.prompt}
          <br />
          <strong className="text-success">{playerAnswers[0]}</strong>
        </p>
      )
    }

    return (
      <p>
        {segments.map((segment, index) => (
          <span key={`${playerId}-${index}`}>
            {segment}
            {index < playerAnswers.length && <strong className="text-success">{playerAnswers[index]}</strong>}
          </span>
        ))}
      </p>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <StatusPanel title="Phase" value={phaseLabel(state.phase)} />
        <StatusPanel title="Chooser" value={state.chooserUserId ? playersById[state.chooserUserId]?.username || 'Unknown' : 'Not chosen'} />
        <StatusPanel title="Target" value={`${state.maxScore} point${state.maxScore === 1 ? '' : 's'}`} />
      </div>

      {isWaiting && (
        <div className="rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-text">
          You joined mid-round. You will enter when the next round starts.
        </div>
      )}

      {state.phase === 'lobby' && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-base font-semibold text-text-primary">Lobby</h2>
          <p className="mb-4 text-sm text-text-secondary">Share code <span className="font-mono font-medium text-accent">{game.gameCode}</span>. Wisecracker needs at least 3 players.</p>
          {isHost && (
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <label className="text-sm font-medium text-text-secondary">
                Max score
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxScore}
                  onChange={(event) => setMaxScore(Number(event.target.value))}
                  className="mt-1 w-32 rounded-lg border border-border bg-overlay px-3 py-2 text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/20"
                />
              </label>
              <button
                onClick={() => onMove({ type: 'startMatch', maxScore })}
                disabled={state.activePlayerIds.length < 3}
                className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Match
              </button>
            </div>
          )}
          {!isHost && <p className="text-sm text-text-muted">Waiting for the host to start.</p>}
        </section>
      )}

      {state.phase === 'prompt' && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          {isChooser ? (
            <>
              <h2 className="mb-3 text-base font-semibold text-text-primary">Choose A Prompt</h2>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                className="min-h-24 w-full resize-none rounded-lg border border-border bg-overlay px-3 py-2 text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/20"
              />
              <p className="mt-2 text-sm text-text-muted">Use underscores for blanks. No blank means everyone submits one punchline.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={refreshPrompt} disabled={isRefreshingPrompt} className="rounded-lg border border-border bg-elevated px-4 py-2 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-overlay disabled:cursor-not-allowed disabled:opacity-70">
                  {isRefreshingPrompt ? 'Refreshing...' : 'New Prompt'}
                </button>
                <button onClick={usePrompt} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent transition-colors duration-150 hover:bg-accent-hover">
                  Use Prompt
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-secondary">{playersById[state.chooserUserId || '']?.username || 'The chooser'} is choosing a prompt.</p>
          )}
        </section>
      )}

      {state.phase === 'answering' && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-base font-semibold text-text-primary">{playersById[state.chooserUserId || '']?.username}'s Prompt</h2>
          <p className="mb-4 rounded-xl border border-border bg-elevated p-4 text-center text-lg text-text-primary">{state.prompt}</p>
          {!isChooser && isActive && !answersAreLocked && (
            <div className="space-y-3">
              {answers.map((answer, index) => (
                <input
                  key={index}
                  value={answer}
                  disabled={isSubmittingAnswers}
                  onChange={(event) => setAnswers((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                  placeholder={state.answerSlots === 1 ? 'Answer' : `Blank ${index + 1}`}
                  className="w-full rounded-lg border border-border bg-overlay px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/20 disabled:cursor-not-allowed disabled:opacity-70"
                />
              ))}
              <button
                onClick={submitAnswers}
                disabled={isSubmittingAnswers}
                className="min-h-11 rounded-lg bg-success px-4 py-2 text-sm font-medium text-text-on-accent transition-colors duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmittingAnswers ? 'Submitting...' : 'Submit Answers'}
              </button>
            </div>
          )}
          {isSubmittingAnswers && !answersAreLocked && <p className="text-sm text-success">Submitting...</p>}
          {answersAreLocked && <p className="rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-center text-sm text-success-text">Your answers are locked in.</p>}
          {isChooser && <p className="text-sm text-text-secondary">Waiting for players to write their answers.</p>}
          <WaitingList title="Still answering" ids={typers.filter((id) => !submittedIds.includes(id))} playersById={playersById} />
        </section>
      )}

      {(state.phase === 'revealing' || state.phase === 'roundResult' || state.phase === 'completed') && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-base font-semibold text-text-primary">Answers</h2>
          <div className="space-y-3">
            {revealedIds.map((playerId, index) => {
              const canSelect = isChooser && state.phase === 'revealing' && allAnswersRevealed
              return (
                <button
                  key={playerId}
                  onClick={() => canSelect && onMove({ type: 'selectRoundWinner', userId: playerId })}
                  disabled={!canSelect}
                  className="w-full rounded-xl border border-border bg-elevated px-4 py-3 text-left text-sm text-text-primary transition-all duration-150 hover:border-border-strong hover:bg-overlay disabled:cursor-default disabled:hover:bg-elevated"
                >
                  <span className="mb-2 block text-xs text-text-muted">
                    {state.roundWinnerUserId || state.matchWinnerUserId ? playersById[playerId]?.username : `Answer ${index + 1}`}
                  </span>
                  {renderFilledAnswer(playerId)}
                </button>
              )
            })}
          </div>
          {isChooser && state.phase === 'revealing' && !allAnswersRevealed && (
            <button onClick={() => onMove({ type: 'revealNextAnswer' })} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent transition-colors duration-150 hover:bg-accent-hover">
              Reveal Answer
            </button>
          )}
          {isChooser && state.phase === 'revealing' && allAnswersRevealed && <p className="mt-4 text-sm text-text-secondary">Choose your favorite answer.</p>}
          {!isChooser && localAnswersLocked && <p className="mt-4 text-sm text-success">Your answers are locked in.</p>}
        </section>
      )}

      {(state.phase === 'roundResult' || state.phase === 'completed') && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-base font-semibold text-text-primary">{state.phase === 'completed' ? 'Match Complete' : 'Round Result'}</h2>
          <p className="mb-4 text-sm text-text-secondary">
            {state.phase === 'completed'
              ? `${playersById[state.matchWinnerUserId || '']?.username} won the match.`
              : `${playersById[state.roundWinnerUserId || '']?.username} won the round.`}
          </p>
          {!isHost && state.phase === 'completed' && (
            <p className="mb-4 text-sm text-text-muted">Waiting for the host to play again with this lobby.</p>
          )}
          {isHost && state.phase === 'roundResult' && (
            <button onClick={() => onMove({ type: 'startNextRound' })} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent transition-colors duration-150 hover:bg-accent-hover">
              Start Next Round
            </button>
          )}
          {isHost && state.phase === 'completed' && (
            <button onClick={() => onMove({ type: 'returnToLobby' })} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent transition-colors duration-150 hover:bg-accent-hover">
              Play Again
            </button>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-base font-semibold text-text-primary">Scoreboard</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {state.activePlayerIds.map((id) => (
            <div key={id} className="flex justify-between rounded-lg border border-border bg-page px-3 py-2">
              <span className="text-sm font-medium text-text-primary">{playersById[id]?.username || 'Unknown'}</span>
              <span className="font-mono text-sm font-bold text-accent">{state.scores[id] || 0}</span>
            </div>
          ))}
        </div>
        <WaitingList title="Waiting for next round" ids={state.waitingPlayerIds} playersById={playersById} />
      </section>
    </div>
  )
}

function StatusPanel({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-elevated px-4 py-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">{title}</p>
      <p className="text-sm font-semibold text-text-primary">{value}</p>
    </div>
  )
}

function WaitingList({ title, ids, playersById }: { title: string; ids: string[]; playersById: Record<string, { username: string }> }) {
  if (ids.length === 0) return null
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">{title}</p>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => <span key={id} className="rounded-full bg-overlay px-3 py-1 text-sm text-text-secondary">{playersById[id]?.username || 'Unknown'}</span>)}
      </div>
    </div>
  )
}

function phaseLabel(phase: WisecrackerState['phase']): string {
  switch (phase) {
    case 'lobby': return 'Lobby'
    case 'prompt': return 'Prompt'
    case 'answering': return 'Answering'
    case 'revealing': return 'Revealing'
    case 'roundResult': return 'Round Result'
    case 'completed': return 'Completed'
  }
}
