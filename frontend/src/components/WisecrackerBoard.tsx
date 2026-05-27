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
          <strong className="text-emerald-300">{playerAnswers[0]}</strong>
        </p>
      )
    }

    return (
      <p>
        {segments.map((segment, index) => (
          <span key={`${playerId}-${index}`}>
            {segment}
            {index < playerAnswers.length && <strong className="text-emerald-300">{playerAnswers[index]}</strong>}
          </span>
        ))}
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <StatusPanel title="Phase" value={phaseLabel(state.phase)} />
        <StatusPanel title="Chooser" value={state.chooserUserId ? playersById[state.chooserUserId]?.username || 'Unknown' : 'Not chosen'} />
        <StatusPanel title="Target" value={`${state.maxScore} point${state.maxScore === 1 ? '' : 's'}`} />
      </div>

      {isWaiting && (
        <div className="rounded-lg bg-amber-950/50 border border-amber-700 px-4 py-3 text-amber-100">
          You joined mid-round. You will enter when the next round starts.
        </div>
      )}

      {state.phase === 'lobby' && (
        <section className="rounded-lg bg-gray-800 p-5">
          <h2 className="text-lg font-semibold mb-3">Lobby</h2>
          <p className="text-gray-300 mb-4">Share code <span className="font-mono text-white">{game.gameCode}</span>. Wisecracker needs at least 3 players.</p>
          {isHost && (
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <label className="text-sm text-gray-300">
                Max score
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxScore}
                  onChange={(event) => setMaxScore(Number(event.target.value))}
                  className="mt-1 w-32 rounded-lg bg-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <button
                onClick={() => onMove({ type: 'startMatch', maxScore })}
                disabled={state.activePlayerIds.length < 3}
                className="rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700"
              >
                Start Match
              </button>
            </div>
          )}
          {!isHost && <p className="text-gray-400">Waiting for the host to start.</p>}
        </section>
      )}

      {state.phase === 'prompt' && (
        <section className="rounded-lg bg-gray-800 p-5">
          {isChooser ? (
            <>
              <h2 className="text-lg font-semibold mb-3">Choose A Prompt</h2>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                className="w-full resize-none rounded-lg bg-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-sm text-gray-400">Use underscores for blanks. No blank means everyone submits one punchline.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={refreshPrompt} disabled={isRefreshingPrompt} className="rounded-lg bg-gray-700 px-4 py-2 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-70">
                  {isRefreshingPrompt ? 'Refreshing...' : 'New Prompt'}
                </button>
                <button onClick={usePrompt} className="rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700">
                  Use Prompt
                </button>
              </div>
            </>
          ) : (
            <p className="text-gray-300">{playersById[state.chooserUserId || '']?.username || 'The chooser'} is choosing a prompt.</p>
          )}
        </section>
      )}

      {state.phase === 'answering' && (
        <section className="rounded-lg bg-gray-800 p-5">
          <h2 className="text-lg font-semibold mb-3">{playersById[state.chooserUserId || '']?.username}'s Prompt</h2>
          <p className="mb-4 rounded-lg bg-gray-900 p-4 text-lg">{state.prompt}</p>
          {!isChooser && isActive && !answersAreLocked && (
            <div className="space-y-3">
              {answers.map((answer, index) => (
                <input
                  key={index}
                  value={answer}
                  disabled={isSubmittingAnswers}
                  onChange={(event) => setAnswers((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                  placeholder={state.answerSlots === 1 ? 'Answer' : `Blank ${index + 1}`}
                  className="w-full rounded-lg bg-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                />
              ))}
              <button
                onClick={submitAnswers}
                disabled={isSubmittingAnswers}
                className="rounded-lg bg-green-600 px-4 py-2 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmittingAnswers ? 'Submitting...' : 'Submit Answers'}
              </button>
            </div>
          )}
          {isSubmittingAnswers && !answersAreLocked && <p className="text-green-300">Submitting...</p>}
          {answersAreLocked && <p className="text-green-300">Your answers are locked in.</p>}
          {isChooser && <p className="text-gray-300">Waiting for players to write their answers.</p>}
          <WaitingList title="Still answering" ids={typers.filter((id) => !submittedIds.includes(id))} playersById={playersById} />
        </section>
      )}

      {(state.phase === 'revealing' || state.phase === 'roundResult' || state.phase === 'completed') && (
        <section className="rounded-lg bg-gray-800 p-5">
          <h2 className="text-lg font-semibold mb-3">Answers</h2>
          <div className="space-y-3">
            {revealedIds.map((playerId, index) => {
              const canSelect = isChooser && state.phase === 'revealing' && allAnswersRevealed
              return (
                <button
                  key={playerId}
                  onClick={() => canSelect && onMove({ type: 'selectRoundWinner', userId: playerId })}
                  disabled={!canSelect}
                  className="w-full rounded-lg bg-gray-900 px-4 py-3 text-left disabled:cursor-default"
                >
                  <span className="mb-2 block text-sm text-gray-400">
                    {state.roundWinnerUserId || state.matchWinnerUserId ? playersById[playerId]?.username : `Answer ${index + 1}`}
                  </span>
                  {renderFilledAnswer(playerId)}
                </button>
              )
            })}
          </div>
          {isChooser && state.phase === 'revealing' && !allAnswersRevealed && (
            <button onClick={() => onMove({ type: 'revealNextAnswer' })} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700">
              Reveal Answer
            </button>
          )}
          {isChooser && state.phase === 'revealing' && allAnswersRevealed && <p className="mt-4 text-gray-300">Choose your favorite answer.</p>}
          {!isChooser && localAnswersLocked && <p className="mt-4 text-green-300">Your answers are locked in.</p>}
        </section>
      )}

      {(state.phase === 'roundResult' || state.phase === 'completed') && (
        <section className="rounded-lg bg-gray-800 p-5">
          <h2 className="text-lg font-semibold mb-3">{state.phase === 'completed' ? 'Match Complete' : 'Round Result'}</h2>
          <p className="mb-4 text-gray-300">
            {state.phase === 'completed'
              ? `${playersById[state.matchWinnerUserId || '']?.username} won the match.`
              : `${playersById[state.roundWinnerUserId || '']?.username} won the round.`}
          </p>
          {!isHost && state.phase === 'completed' && (
            <p className="mb-4 text-gray-400">Waiting for the host to play again with this lobby.</p>
          )}
          {isHost && state.phase === 'roundResult' && (
            <button onClick={() => onMove({ type: 'startNextRound' })} className="rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700">
              Start Next Round
            </button>
          )}
          {isHost && state.phase === 'completed' && (
            <button onClick={() => onMove({ type: 'returnToLobby' })} className="rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-700">
              Play Again
            </button>
          )}
        </section>
      )}

      <section className="rounded-lg bg-gray-800 p-5">
        <h2 className="text-lg font-semibold mb-3">Scoreboard</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {state.activePlayerIds.map((id) => (
            <div key={id} className="flex justify-between rounded-lg bg-gray-900 px-3 py-2">
              <span>{playersById[id]?.username || 'Unknown'}</span>
              <span className="font-mono">{state.scores[id] || 0}</span>
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
    <div className="rounded-lg bg-gray-800 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  )
}

function WaitingList({ title, ids, playersById }: { title: string; ids: string[]; playersById: Record<string, { username: string }> }) {
  if (ids.length === 0) return null
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm text-gray-400">{title}</p>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => <span key={id} className="rounded-full bg-gray-700 px-3 py-1 text-sm">{playersById[id]?.username || 'Unknown'}</span>)}
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
