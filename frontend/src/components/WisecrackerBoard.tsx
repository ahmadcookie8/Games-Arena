import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Clipboard,
  Clock3,
  Crown,
  History,
  Laugh,
  MessageCircle,
  Mic2,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
  Vote,
  WifiOff,
} from 'lucide-react'
import { Game, WisecrackerState } from '../types/game'
import { User } from '../types/user'
import {
  WisecrackerActionMode,
  getWisecrackerPhasePresentation,
  getWisecrackerRoundProgress,
  normalizeWisecrackerState,
  resolveWisecrackerActionMode,
  splitWisecrackerPrompt,
} from '../lib/wisecrackerUi'
import GameChat from './GameChat'
import MoveHistory from './MoveHistory'
import { TabletopBottomSheet, TabletopTab, TabletopTabs } from './TabletopShell'
import './wisecracker-tabletop.css'

type WisecrackerMove =
  | { type: 'startMatch'; maxScore: number }
  | { type: 'refreshPrompt' }
  | { type: 'setPrompt'; prompt: string }
  | { type: 'submitAnswers'; answers: string[] }
  | { type: 'revealNextAnswer' }
  | { type: 'selectRoundWinner'; userId: string }
  | { type: 'startNextRound' }
  | { type: 'returnToLobby' }

type InspectorTab = 'players' | 'history' | 'chat'

interface Props {
  game: Game
  user: User | null
  onMove: (move: WisecrackerMove) => Promise<{ success: boolean; game?: Game; error?: string }>
  onSendChat: (text: string) => Promise<{ success: boolean; error?: string }>
}

const INSPECTOR_TABS: TabletopTab<InspectorTab>[] = [
  { id: 'players', label: 'Players', icon: Users },
  { id: 'history', label: 'History', icon: History },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
]

export default function WisecrackerBoard({ game, user, onMove, onSendChat }: Props) {
  const state = normalizeWisecrackerState(game.gameState, game.players.map((player) => player.userId))
  const myId = user?._id || ''
  const [maxScore, setMaxScore] = useState(state.maxScore || 3)
  const [prompt, setPrompt] = useState(state.prompt || '')
  const [answers, setAnswers] = useState<string[]>([])
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false)
  const [localAnswersLocked, setLocalAnswersLocked] = useState(false)
  const [isRefreshingPrompt, setIsRefreshingPrompt] = useState(false)
  const [isStartingMatch, setIsStartingMatch] = useState(false)
  const [isUsingPrompt, setIsUsingPrompt] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [selectingWinnerId, setSelectingWinnerId] = useState<string | null>(null)
  const [isAdvancingRound, setIsAdvancingRound] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [activeTab, setActiveTab] = useState<InspectorTab>('players')
  const [sheetOpen, setSheetOpen] = useState(false)

  const playersById = useMemo(
    () => Object.fromEntries(game.players.map((player) => [player.userId, player])),
    [game.players],
  )
  const phasePresentation = getWisecrackerPhasePresentation(state.phase)
  const resolvedActionMode = resolveWisecrackerActionMode(state, myId)
  const actionMode: WisecrackerActionMode = resolvedActionMode === 'submitAnswers' && localAnswersLocked
    ? 'answersLocked'
    : resolvedActionMode
  const progress = getWisecrackerRoundProgress(state)
  const isHost = state.hostUserId === myId
  const isChooser = state.chooserUserId === myId
  const hasSubmitted = Boolean(myId && state.submittedAnswers?.[myId])
  const typers = state.activePlayerIds.filter((id) => id !== state.chooserUserId)
  const revealedIds = state.answerOrder.slice(0, state.revealedCount)
  const canSubmitAnswers = answers.length > 0 && answers.every((answer) => answer.trim().length > 0)
  const chooser = state.chooserUserId ? playersById[state.chooserUserId] : undefined
  const chooserIsConnected = chooser?.isConnected !== false
  const latestMove = game.moveHistory[game.moveHistory.length - 1]
  const myScore = state.scores[myId] ?? 0
  const validMaxScore = Number.isInteger(maxScore) && maxScore >= 1 && maxScore <= 50

  useEffect(() => {
    setPrompt(state.prompt || '')
  }, [state.prompt, state.phase])

  useEffect(() => {
    if (state.phase === 'lobby') setMaxScore(state.maxScore || 3)
  }, [state.maxScore, state.phase])

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
    setIsRefreshingPrompt(false)
    setIsStartingMatch(false)
    setIsUsingPrompt(false)
    setIsRevealing(false)
    setSelectingWinnerId(null)
    setIsAdvancingRound(false)
  }, [state.phase, state.prompt, state.revealedCount, state.roundWinnerUserId])

  async function copyGameCode() {
    try {
      await navigator.clipboard.writeText(game.gameCode)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      setCopyStatus('failed')
    }
  }

  async function submitAnswers(event: FormEvent) {
    event.preventDefault()
    if (!canSubmitAnswers || isSubmittingAnswers) return
    setIsSubmittingAnswers(true)
    const result = await onMove({ type: 'submitAnswers', answers })
    if (result.success) setLocalAnswersLocked(true)
    else setIsSubmittingAnswers(false)
  }

  async function refreshPrompt() {
    if (isRefreshingPrompt) return
    setIsRefreshingPrompt(true)
    await onMove({ type: 'refreshPrompt' })
    setIsRefreshingPrompt(false)
  }

  async function startMatch() {
    if (isStartingMatch || !validMaxScore || state.activePlayerIds.length < 3) return
    setIsStartingMatch(true)
    await onMove({ type: 'startMatch', maxScore })
    setIsStartingMatch(false)
  }

  async function applyPrompt() {
    if (!prompt.trim() || isUsingPrompt) return
    setIsUsingPrompt(true)
    await onMove({ type: 'setPrompt', prompt })
    setIsUsingPrompt(false)
  }

  async function revealNextAnswer() {
    if (isRevealing) return
    setIsRevealing(true)
    await onMove({ type: 'revealNextAnswer' })
    setIsRevealing(false)
  }

  async function selectWinner(userId: string) {
    if (selectingWinnerId) return
    setSelectingWinnerId(userId)
    await onMove({ type: 'selectRoundWinner', userId })
    setSelectingWinnerId(null)
  }

  async function advanceRound(move: Extract<WisecrackerMove, { type: 'startNextRound' | 'returnToLobby' }>) {
    if (isAdvancingRound) return
    setIsAdvancingRound(true)
    await onMove(move)
    setIsAdvancingRound(false)
  }

  function selectInspector(tabId: InspectorTab) {
    setActiveTab(tabId)
  }

  function openInspector(tabId: InspectorTab) {
    selectInspector(tabId)
    setSheetOpen(true)
  }

  function renderInspectorContent() {
    switch (activeTab) {
      case 'history':
        return <MoveHistory moves={game.moveHistory} variant="embedded" />
      case 'chat':
        return <GameChat messages={game.chatMessages || []} currentUserId={myId} onSend={onSendChat} variant="embedded" />
      default:
        return <PlayersInspector game={game} state={state} currentUserId={myId} />
    }
  }

  function renderLobbyStage() {
    const canStart = validMaxScore && state.activePlayerIds.length >= 3
    return (
      <div className="wc-stage-body wc-lobby">
        <div className="wc-invite">
          <div>
            <p className="wc-kicker">Private room</p>
            <p className="wc-invite__code">{game.gameCode}</p>
            <p className="wc-muted">Share the code. Wisecracker needs at least three players.</p>
          </div>
          <button type="button" className="wc-button wc-button--quiet" onClick={() => void copyGameCode()}>
            {copyStatus === 'copied' ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
            {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy code'}
          </button>
        </div>

        <div className="wc-lobby__count" aria-live="polite">
          <div className="wc-count-orb"><Users aria-hidden="true" /></div>
          <div>
            <strong>{state.activePlayerIds.length} player{state.activePlayerIds.length === 1 ? '' : 's'} at the table</strong>
            <span>{state.activePlayerIds.length >= 3 ? 'The room is ready.' : `${3 - state.activePlayerIds.length} more needed to start.`}</span>
          </div>
        </div>

        {isHost ? (
          <div className="wc-host-setting">
            <label htmlFor="wc-max-score">
              <span>Points to win</span>
              <input
                id="wc-max-score"
                type="number"
                min={1}
                max={50}
                inputMode="numeric"
                value={maxScore}
                onChange={(event) => setMaxScore(Number(event.target.value))}
                aria-describedby="wc-max-score-help"
              />
            </label>
            <p id="wc-max-score-help" className="wc-muted">Choose a target from 1 to 50.</p>
            <button
              type="button"
              className="wc-button wc-button--primary"
              disabled={!canStart || isStartingMatch}
              onClick={() => void startMatch()}
            >
              <Mic2 aria-hidden="true" />
              {isStartingMatch ? 'Starting match' : 'Start match'}
            </button>
          </div>
        ) : (
          <WaitingNotice icon={Clock3} title="Waiting for the host" detail="The host will choose the target and start the match." />
        )}
      </div>
    )
  }

  function renderPromptStage() {
    if (actionMode !== 'choosePrompt') {
      return (
        <div className="wc-stage-body wc-centered-state">
          <div className="wc-stage-icon"><Mic2 aria-hidden="true" /></div>
          <h3>{chooser?.username || 'The chooser'} is setting the scene</h3>
          <p>{chooserIsConnected ? 'A fresh prompt is coming up.' : 'The chooser is offline. The round will continue when they reconnect.'}</p>
          {!chooserIsConnected && <span className="wc-offline-callout"><WifiOff aria-hidden="true" /> Chooser offline</span>}
        </div>
      )
    }

    return (
      <div className="wc-stage-body">
        <div className="wc-cue-editor">
          <label htmlFor="wc-prompt">Your prompt</label>
          <textarea
            id="wc-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            maxLength={500}
          />
          <p className="wc-muted">Use underscores for blanks. With no underscore, everyone submits one punchline.</p>
        </div>
        <div className="wc-preview" aria-label="Prompt preview">
          <span className="wc-kicker">On the card</span>
          <PromptCard prompt={prompt || 'Your prompt will appear here.'} />
        </div>
        <div className="wc-action-row">
          <button type="button" className="wc-button wc-button--quiet" disabled={isRefreshingPrompt} onClick={() => void refreshPrompt()}>
            <RefreshCw className={isRefreshingPrompt ? 'wc-spin' : ''} aria-hidden="true" />
            {isRefreshingPrompt ? 'Refreshing' : 'New prompt'}
          </button>
          <button type="button" className="wc-button wc-button--primary" disabled={!prompt.trim() || isUsingPrompt} onClick={() => void applyPrompt()}>
            <Sparkles aria-hidden="true" />
            {isUsingPrompt ? 'Using prompt' : 'Use prompt'}
          </button>
        </div>
      </div>
    )
  }

  function renderAnsweringStage() {
    return (
      <div className="wc-stage-body">
        <PromptCard prompt={state.prompt} featured />

        {actionMode === 'submitAnswers' && (
          <form className="wc-answer-form" onSubmit={(event) => void submitAnswers(event)}>
            <div className="wc-answer-form__heading">
              <div>
                <p className="wc-kicker">Your turn</p>
                <h3>Write the punchline</h3>
              </div>
              <span>{answers.length} answer{answers.length === 1 ? '' : 's'}</span>
            </div>
            {answers.map((answer, index) => (
              <label key={index} htmlFor={`wc-answer-${index}`}>
                <span>{state.answerSlots === 1 ? 'Your answer' : `Blank ${index + 1}`}</span>
                <input
                  id={`wc-answer-${index}`}
                  value={answer}
                  disabled={isSubmittingAnswers}
                  maxLength={300}
                  autoComplete="off"
                  onChange={(event) => setAnswers((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                  placeholder={state.answerSlots === 1 ? 'Make it count...' : `Fill blank ${index + 1}`}
                />
              </label>
            ))}
            <button type="submit" className="wc-button wc-button--success wc-button--wide" disabled={!canSubmitAnswers || isSubmittingAnswers}>
              <Check aria-hidden="true" />
              {isSubmittingAnswers ? 'Submitting' : 'Lock in answers'}
            </button>
          </form>
        )}

        {actionMode === 'answersLocked' && (
          <WaitingNotice icon={Check} title="Answers locked in" detail="Sit tight while everyone else finishes writing." tone="success" />
        )}

        {actionMode === 'waitForAnswers' && (
          <WaitingNotice
            icon={Clock3}
            title={isChooser ? 'The room is writing' : 'Waiting for the remaining answers'}
            detail={isChooser ? 'You will reveal each response once every writer is ready.' : 'The reveal begins when every active writer submits.'}
          />
        )}

        <SubmissionProgress typers={typers} state={state} playersById={playersById} />
      </div>
    )
  }

  function renderRevealStage() {
    const canChoose = actionMode === 'chooseWinner'
    return (
      <div className="wc-stage-body">
        <PromptCard prompt={state.prompt} featured />
        <div className="wc-reveal-heading">
          <div>
            <p className="wc-kicker">Anonymous answers</p>
            <h3>{canChoose ? 'Choose the winning punchline' : 'The answers take the stage'}</h3>
          </div>
          <span>{progress.revealed}/{progress.totalAnswers} revealed</span>
        </div>
        <div className="wc-answer-stack" aria-live="polite">
          {revealedIds.length === 0 && <p className="wc-empty-answer">The first answer is waiting behind the curtain.</p>}
          {revealedIds.map((playerId, index) => {
            const card = (
              <>
                <span className="wc-answer-card__number">Answer {index + 1}</span>
                <FilledPrompt prompt={state.prompt} answers={state.submittedAnswers[playerId] || []} />
                {canChoose && <span className="wc-answer-card__vote"><Vote aria-hidden="true" /> Choose this answer</span>}
              </>
            )
            return canChoose ? (
              <button
                key={playerId}
                type="button"
                className="wc-answer-card wc-answer-card--selectable"
                disabled={Boolean(selectingWinnerId)}
                aria-label={`Choose answer ${index + 1} as the round winner`}
                onClick={() => void selectWinner(playerId)}
              >
                {card}
              </button>
            ) : (
              <article key={playerId} className="wc-answer-card">{card}</article>
            )
          })}
        </div>

        {actionMode === 'revealAnswer' && (
          <button type="button" className="wc-button wc-button--primary wc-button--wide" disabled={isRevealing} onClick={() => void revealNextAnswer()}>
            <Sparkles aria-hidden="true" />
            {isRevealing ? 'Revealing' : revealedIds.length === 0 ? 'Reveal first answer' : 'Reveal next answer'}
          </button>
        )}
        {actionMode === 'waitForReveal' && (
          <p className="wc-stage-note">{chooser?.username || 'The chooser'} controls the reveal and picks a favorite after every answer is shown.</p>
        )}
      </div>
    )
  }

  function renderResultStage() {
    const isComplete = state.phase === 'completed'
    const winnerId = isComplete ? state.matchWinnerUserId : state.roundWinnerUserId
    const winner = winnerId ? playersById[winnerId] : undefined
    const isHostAction = actionMode === 'roundResultHost' || actionMode === 'completedHost'

    return (
      <div className="wc-stage-body">
        <div className={`wc-winner ${isComplete ? 'wc-winner--final' : ''}`}>
          <div className="wc-winner__icon">{isComplete ? <Trophy aria-hidden="true" /> : <Crown aria-hidden="true" />}</div>
          <p className="wc-kicker">{isComplete ? 'Match winner' : 'Round winner'}</p>
          <h3>{winner?.username || 'Winner'}</h3>
          <p>{isComplete ? `First to ${state.maxScore} takes the spotlight.` : 'One point for the room favorite.'}</p>
        </div>

        {state.roundWinnerUserId && (
          <article className="wc-answer-card wc-answer-card--winner">
            <span className="wc-answer-card__number">Winning answer</span>
            <FilledPrompt prompt={state.prompt} answers={state.submittedAnswers[state.roundWinnerUserId] || []} />
          </article>
        )}

        {isHostAction ? (
          <button
            type="button"
            className="wc-button wc-button--primary wc-button--wide"
            disabled={isAdvancingRound}
            onClick={() => void advanceRound({ type: isComplete ? 'returnToLobby' : 'startNextRound' })}
          >
            {isComplete ? <Laugh aria-hidden="true" /> : <Mic2 aria-hidden="true" />}
            {isAdvancingRound ? 'Getting ready' : isComplete ? 'Play again' : 'Start next round'}
          </button>
        ) : (
          <WaitingNotice
            icon={Clock3}
            title={isComplete ? 'Waiting for the host' : 'Next round coming up'}
            detail={isComplete ? 'The host can bring this lobby back for another match.' : 'The host will start the next prompt when the room is ready.'}
          />
        )}
      </div>
    )
  }

  function renderRoundStage() {
    switch (state.phase) {
      case 'lobby': return renderLobbyStage()
      case 'prompt': return renderPromptStage()
      case 'answering': return renderAnsweringStage()
      case 'revealing': return renderRevealStage()
      case 'roundResult':
      case 'completed': return renderResultStage()
    }
  }

  return (
    <div className="wisecracker-theme">
      <section className={`wc-hud wc-tone--${phasePresentation.tone}`} aria-label="Wisecracker status">
        <div className="wc-hud__lead">
          <div className="wc-hud__avatar" aria-hidden="true">{chooser?.username?.[0]?.toUpperCase() || <Mic2 />}</div>
          <div>
            <p className="wc-kicker">{phasePresentation.eyebrow}</p>
            <strong>{phasePresentation.label}</strong>
            <span>{state.chooserUserId ? `${chooser?.username || 'Unknown'} is chooser${chooserIsConnected ? '' : ' · offline'}` : 'Waiting for a chooser'}</span>
          </div>
        </div>
        <div className="wc-hud__stat"><span>Target</span><strong>{state.maxScore}</strong></div>
        <div className="wc-hud__stat"><span>Your score</span><strong>{myScore}</strong></div>
        <div className="wc-hud__stat">
          <span>{state.phase === 'revealing' ? 'Revealed' : state.phase === 'lobby' ? 'Players' : 'Answers'}</span>
          <strong>{state.phase === 'revealing' ? `${progress.revealed}/${progress.totalAnswers}` : state.phase === 'lobby' ? state.activePlayerIds.length : `${progress.submitted}/${progress.totalTypers}`}</strong>
        </div>
        {latestMove && <p className="wc-hud__event" aria-live="polite"><Sparkles aria-hidden="true" /> {latestMove.playerName} {latestMove.move}</p>}
      </section>

      <div className="wc-game-layout">
        <main className="wc-stage" aria-labelledby="wc-stage-title">
          <header className="wc-stage__header">
            <div>
              <p className="wc-kicker">Current action</p>
              <h2 id="wc-stage-title">{getStageTitle(actionMode)}</h2>
            </div>
            <span className={`wc-phase-pill wc-phase-pill--${phasePresentation.tone}`}>{phasePresentation.label}</span>
          </header>
          {actionMode === 'waitingPlayer' && (
            <div className="wc-midround-banner">
              <Clock3 aria-hidden="true" />
              <span><strong>You are watching this round.</strong> You will enter when the next round begins.</span>
            </div>
          )}
          {renderRoundStage()}
        </main>

        <aside className="wc-desktop-rail" aria-label="Wisecracker information">
          <div className="wc-inspector">
            <TabletopTabs
              tabs={INSPECTOR_TABS}
              activeTab={activeTab}
              onSelect={selectInspector}
              ariaLabel="Wisecracker information"
              idBase="wisecracker-desktop"
            />
            <div
              className="wc-inspector__content"
              id="wisecracker-desktop-panel"
              role="tabpanel"
              aria-labelledby={`wisecracker-desktop-tab-${activeTab}`}
            >
              {renderInspectorContent()}
            </div>
          </div>
        </aside>
      </div>

      <div className="wc-mobile-dock">
        <TabletopTabs
          tabs={INSPECTOR_TABS}
          activeTab={activeTab}
          onSelect={openInspector}
          ariaLabel="Open Wisecracker information"
          idBase="wisecracker-mobile"
          controlsIdBase="wisecracker-sheet"
          variant="dock"
        />
      </div>

      <TabletopBottomSheet
        isOpen={sheetOpen}
        title={INSPECTOR_TABS.find((tab) => tab.id === activeTab)?.label || 'Game information'}
        onClose={() => setSheetOpen(false)}
      >
        <div className="wisecracker-theme wc-sheet-content">
          <TabletopTabs
            tabs={INSPECTOR_TABS}
            activeTab={activeTab}
            onSelect={selectInspector}
            ariaLabel="Wisecracker information"
            idBase="wisecracker-sheet"
          />
          <div
            className="wc-sheet-content__body"
            id="wisecracker-sheet-panel"
            role="tabpanel"
            aria-labelledby={`wisecracker-sheet-tab-${activeTab}`}
          >
            {renderInspectorContent()}
          </div>
        </div>
      </TabletopBottomSheet>
    </div>
  )
}

function PromptCard({ prompt, featured = false }: { prompt: string; featured?: boolean }) {
  const segments = splitWisecrackerPrompt(prompt)
  const hasBlanks = segments.length > 1
  return (
    <div className={`wc-prompt-card ${featured ? 'wc-prompt-card--featured' : ''}`}>
      <span className="wc-prompt-card__mark" aria-hidden="true"><Mic2 /></span>
      <p>
        {segments.map((segment, index) => (
          <span key={index}>
            {segment}
            {hasBlanks && index < segments.length - 1 && <span className="wc-prompt-blank" aria-label={`blank ${index + 1}`} />}
          </span>
        ))}
      </p>
    </div>
  )
}

function FilledPrompt({ prompt, answers }: { prompt: string; answers: string[] }) {
  const segments = splitWisecrackerPrompt(prompt)
  const hasBlanks = segments.length > 1

  if (!hasBlanks) {
    return <p className="wc-filled-prompt"><span>{prompt}</span><strong>{answers[0]}</strong></p>
  }

  return (
    <p className="wc-filled-prompt">
      {segments.map((segment, index) => (
        <span key={index}>
          {segment}
          {index < segments.length - 1 && <strong>{answers[index] || '...'}</strong>}
        </span>
      ))}
    </p>
  )
}

function SubmissionProgress({
  typers,
  state,
  playersById,
}: {
  typers: string[]
  state: WisecrackerState
  playersById: Record<string, { username: string; isConnected?: boolean }>
}) {
  if (typers.length === 0) return null
  return (
    <div className="wc-submission-progress">
      <p className="wc-kicker">Around the room</p>
      <div>
        {typers.map((id) => {
          const submitted = Boolean(state.submittedAnswers[id])
          const connected = playersById[id]?.isConnected !== false
          return (
            <span key={id} className={submitted ? 'is-ready' : ''}>
              {submitted ? <Check aria-hidden="true" /> : connected ? <Clock3 aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
              {playersById[id]?.username || 'Unknown'}
              <small>{submitted ? 'Ready' : connected ? 'Writing' : 'Offline'}</small>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function WaitingNotice({
  icon: Icon,
  title,
  detail,
  tone = 'neutral',
}: {
  icon: typeof Clock3
  title: string
  detail: string
  tone?: 'neutral' | 'success'
}) {
  return (
    <div className={`wc-waiting-notice wc-waiting-notice--${tone}`}>
      <span><Icon aria-hidden="true" /></span>
      <div><strong>{title}</strong><p>{detail}</p></div>
    </div>
  )
}

function PlayersInspector({ game, state, currentUserId }: { game: Game; state: WisecrackerState; currentUserId: string }) {
  const orderedIds = [...state.activePlayerIds, ...state.waitingPlayerIds.filter((id) => !state.activePlayerIds.includes(id))]
  const playersById = Object.fromEntries(game.players.map((player) => [player.userId, player]))
  return (
    <div className="wc-player-list">
      <div className="wc-player-list__summary">
        <span><Users aria-hidden="true" /></span>
        <div><strong>{state.activePlayerIds.length} active</strong><p>First to {state.maxScore} points wins.</p></div>
      </div>
      {orderedIds.map((id) => {
        const player = playersById[id]
        const connected = player?.isConnected !== false
        const waiting = state.waitingPlayerIds.includes(id)
        const isChooser = state.chooserUserId === id
        const isWinner = state.matchWinnerUserId === id || state.roundWinnerUserId === id
        return (
          <div key={id} className={`wc-player-row ${isChooser ? 'is-chooser' : ''} ${isWinner ? 'is-winner' : ''}`}>
            <span className="wc-player-row__avatar">{player?.username?.[0]?.toUpperCase() || '?'}</span>
            <div className="wc-player-row__identity">
              <strong>{player?.username || 'Unknown'}</strong>
              <div>
                {id === currentUserId && <span>You</span>}
                {id === state.hostUserId && <span>Host</span>}
                {isChooser && <span>Chooser</span>}
                {waiting && <span>Next round</span>}
              </div>
              <p className={connected ? '' : 'is-offline'}>{connected ? waiting ? 'Waiting to join' : 'Online' : 'Offline'}</p>
            </div>
            <strong className="wc-player-row__score">{state.scores[id] ?? 0}</strong>
          </div>
        )
      })}
    </div>
  )
}

function getStageTitle(mode: WisecrackerActionMode): string {
  switch (mode) {
    case 'lobbyHost': return 'Set up the room'
    case 'lobbyGuest': return 'The room is gathering'
    case 'waitingPlayer': return 'Watch this round'
    case 'choosePrompt': return 'Choose the prompt'
    case 'waitForPrompt': return 'Prompt in progress'
    case 'submitAnswers': return 'Write your answers'
    case 'answersLocked': return 'Answers submitted'
    case 'waitForAnswers': return 'Waiting on the room'
    case 'revealAnswer': return 'Reveal the answers'
    case 'chooseWinner': return 'Pick your favorite'
    case 'waitForReveal': return 'Watch the reveal'
    case 'roundResultHost':
    case 'roundResultGuest': return 'Round result'
    case 'completedHost':
    case 'completedGuest': return 'Match complete'
  }
}
