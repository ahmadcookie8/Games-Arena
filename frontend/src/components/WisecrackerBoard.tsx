import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Clock3,
  Crown,
  History,
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
import type { GameActionErrorReporter } from '../types/gameFeedback'
import { User } from '../types/user'
import {
  WISECRACKER_ANSWER_MAX_LENGTH,
  WISECRACKER_MAX_BLANKS,
  WISECRACKER_PROMPT_MAX_LENGTH,
  WisecrackerActionMode,
  countWisecrackerBlanks,
  getWisecrackerPhasePresentation,
  getWisecrackerRoundProgress,
  normalizeWisecrackerState,
  resolveWisecrackerActionMode,
  splitWisecrackerPrompt,
} from '../lib/wisecrackerUi'
import { multiplayerActions, type WisecrackerMove } from '../lib/multiplayerActions'
import GameChat from './GameChat'
import MoveHistory from './MoveHistory'
import PlayerAvatar from './PlayerAvatar'
import { TabletopBottomSheet, TabletopDockButtons, TabletopTabs, type TabletopTab } from './TabletopShell'
import './wisecracker-tabletop.css'

type InspectorTab = 'players' | 'history' | 'chat'

interface Props {
  game: Game
  user: User | null
  onMove: (move: WisecrackerMove) => Promise<{ success: boolean; game?: Game; error?: string; handledGlobally?: boolean }>
  onSendChat: (text: string) => Promise<{ success: boolean; error?: string; handledGlobally?: boolean }>
  onActionError?: GameActionErrorReporter
}

const INSPECTOR_TABS: TabletopTab<InspectorTab>[] = [
  { id: 'players', label: 'Players', icon: Users },
  { id: 'history', label: 'History', icon: History },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
]

export default function WisecrackerBoard({ game, user, onMove, onSendChat, onActionError }: Props) {
  const state = normalizeWisecrackerState(game.gameState, game.players.map((player) => player.userId))
  const myId = user?._id || ''
  const [maxScore, setMaxScore] = useState(() => String(state.maxScore || 3))
  const [prompt, setPrompt] = useState(state.prompt || '')
  const [answers, setAnswers] = useState<string[]>([])
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false)
  const [localAnswersLocked, setLocalAnswersLocked] = useState(false)
  const [isRefreshingPrompt, setIsRefreshingPrompt] = useState(false)
  const [isStartingMatch, setIsStartingMatch] = useState(false)
  const [isUsingPrompt, setIsUsingPrompt] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [selectingResponseId, setSelectingResponseId] = useState<string | null>(null)
  const [isAdvancingRound, setIsAdvancingRound] = useState(false)
  const [activeTab, setActiveTab] = useState<InspectorTab>('players')
  const [sheetOpen, setSheetOpen] = useState(false)
  const isDesktopLayout = useTabletopDesktopLayout()

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
  const hasSubmitted = Boolean(myId && state.submissionStatus[myId])
  const typers = state.activePlayerIds.filter((id) => id !== state.chooserUserId)
  const revealedResponses = state.revealedResponses
  const canSubmitAnswers = answers.length > 0 && answers.every((answer) => answer.trim().length > 0)
  const chooser = state.chooserUserId ? playersById[state.chooserUserId] : undefined
  const chooserIsConnected = chooser?.isConnected !== false
  const latestMove = game.moveHistory[game.moveHistory.length - 1]
  const myScore = state.scores[myId] ?? 0
  const parsedMaxScore = /^\d+$/.test(maxScore) ? Number(maxScore) : Number.NaN
  const validMaxScore = Number.isSafeInteger(parsedMaxScore) && parsedMaxScore >= 1 && parsedMaxScore <= 50
  const promptBlankCount = countWisecrackerBlanks(prompt)
  const promptRemaining = WISECRACKER_PROMPT_MAX_LENGTH - prompt.length
  const promptIsValid = Boolean(prompt.trim()) && promptBlankCount <= WISECRACKER_MAX_BLANKS
  const roundNumber = game.moveHistory.filter((move) => move.move === 'started the next round').length
  const roundDraftKey = `${game._id}:${roundNumber}:${state.chooserIndex}:${state.phase}:${myId}`
  const answerDraftKey = `${roundDraftKey}:${state.answerSlots}`
  const answerSlots = Math.max(state.answerSlots || 0, 0)
  const serverAnswersJson = JSON.stringify(state.myAnswers ?? [])

  useEffect(() => {
    if (isDesktopLayout) setSheetOpen(false)
  }, [isDesktopLayout])

  useEffect(() => {
    setPrompt(state.prompt || '')
  }, [roundDraftKey, state.prompt])

  useEffect(() => {
    if (state.phase === 'lobby') setMaxScore(String(state.maxScore || 3))
  }, [state.maxScore, state.phase])

  useEffect(() => {
    const parsedAnswers = JSON.parse(serverAnswersJson) as unknown
    const ownAnswers = Array.isArray(parsedAnswers) && parsedAnswers.every((answer) => typeof answer === 'string') && parsedAnswers.length === answerSlots
      ? parsedAnswers as string[]
      : null
    setAnswers(ownAnswers ? [...ownAnswers] : Array.from({ length: answerSlots }, () => ''))
  }, [answerDraftKey, answerSlots, serverAnswersJson])

  useEffect(() => {
    // A direct authoritative snapshot can skip the intermediate result/prompt
    // phases after a reconnect. Reset the local lock when the keyed round
    // changes, while preserving it for every update within the same round.
    setLocalAnswersLocked(hasSubmitted)
    if (hasSubmitted) setIsSubmittingAnswers(false)
  }, [answerDraftKey, hasSubmitted])

  useEffect(() => {
    if (state.phase === 'prompt' || state.phase === 'lobby' || state.phase === 'roundResult' || state.phase === 'completed') {
      setLocalAnswersLocked(false)
      setIsSubmittingAnswers(false)
    }
    setIsRefreshingPrompt(false)
    setIsStartingMatch(false)
    setIsUsingPrompt(false)
    setIsRevealing(false)
    setSelectingResponseId(null)
    setIsAdvancingRound(false)
  }, [roundDraftKey, state.phase, state.prompt, state.revealedResponses.length, state.roundWinnerResponseId])

  async function performMove(move: WisecrackerMove) {
    const restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    try {
      const result = await onMove(move)
      if (!result.success && !result.handledGlobally) onActionError?.(result.error ?? 'Action failed', restoreFocusTo)
      return result
    } catch {
      onActionError?.('The action could not reach the game server.', restoreFocusTo)
      return { success: false, error: 'The action could not reach the game server.' }
    }
  }

  async function submitAnswers(event: FormEvent) {
    event.preventDefault()
    if (!canSubmitAnswers || isSubmittingAnswers) return
    setIsSubmittingAnswers(true)
    const result = await performMove(multiplayerActions.wisecracker.submitAnswers(answers))
    if (result.success) setLocalAnswersLocked(true)
    else setIsSubmittingAnswers(false)
  }

  async function refreshPrompt() {
    if (isRefreshingPrompt) return
    setIsRefreshingPrompt(true)
    await performMove(multiplayerActions.wisecracker.refreshPrompt())
    setIsRefreshingPrompt(false)
  }

  async function startMatch() {
    if (isStartingMatch || !validMaxScore || state.activePlayerIds.length < 3) return
    setIsStartingMatch(true)
    await performMove(multiplayerActions.wisecracker.startMatch(parsedMaxScore))
    setIsStartingMatch(false)
  }

  async function applyPrompt() {
    if (!promptIsValid || isUsingPrompt) return
    setIsUsingPrompt(true)
    await performMove(multiplayerActions.wisecracker.setPrompt(prompt))
    setIsUsingPrompt(false)
  }

  async function revealNextAnswer() {
    if (isRevealing) return
    setIsRevealing(true)
    await performMove(multiplayerActions.wisecracker.revealNextAnswer())
    setIsRevealing(false)
  }

  async function selectWinner(responseId: string) {
    if (selectingResponseId) return
    setSelectingResponseId(responseId)
    await performMove(multiplayerActions.wisecracker.selectRoundWinner(responseId))
    setSelectingResponseId(null)
  }

  async function advanceRound() {
    if (isAdvancingRound) return
    setIsAdvancingRound(true)
    await performMove(multiplayerActions.wisecracker.startNextRound())
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
        return <GameChat messages={game.chatMessages || []} currentUserId={myId} onSend={onSendChat} onError={onActionError} variant="embedded" />
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
            <p className="wc-muted">Share the invite code shown above. Wisecracker needs at least three players.</p>
          </div>
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
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="done"
                value={maxScore}
                onChange={(event) => {
                  if (/^\d*$/.test(event.target.value)) setMaxScore(event.target.value)
                }}
                aria-describedby="wc-max-score-help"
                aria-invalid={Boolean(maxScore && !validMaxScore) || undefined}
              />
            </label>
            <p id="wc-max-score-help" className="wc-muted">Choose a target from 1 to 50.</p>
            <button
              type="button"
              className="tactile-button tactile-button--primary wc-button wc-button--primary"
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
            maxLength={WISECRACKER_PROMPT_MAX_LENGTH}
            aria-describedby="wc-prompt-help wc-prompt-count"
          />
          <p id="wc-prompt-help" className="wc-muted">Use underscores for blanks. With no underscore, everyone submits one punchline.</p>
          <p id="wc-prompt-count" className={`wc-input-count ${promptBlankCount > WISECRACKER_MAX_BLANKS ? 'is-invalid' : ''}`}>
            {promptRemaining} characters remaining · {promptBlankCount}/{WISECRACKER_MAX_BLANKS} blanks
          </p>
          {promptBlankCount > WISECRACKER_MAX_BLANKS && <p className="wc-field-error" role="status">Use no more than {WISECRACKER_MAX_BLANKS} blanks.</p>}
        </div>
        <div className="wc-preview" aria-label="Prompt preview">
          <span className="wc-kicker">On the card</span>
          <PromptCard prompt={prompt || 'Your prompt will appear here.'} />
        </div>
        <div className="wc-action-row">
          <button type="button" className="tactile-button tactile-button--secondary wc-button wc-button--quiet" disabled={isRefreshingPrompt} onClick={() => void refreshPrompt()}>
            <RefreshCw className={isRefreshingPrompt ? 'wc-spin' : ''} aria-hidden="true" />
            {isRefreshingPrompt ? 'Refreshing' : 'New prompt'}
          </button>
          <button type="button" className="tactile-button tactile-button--primary wc-button wc-button--primary" disabled={!promptIsValid || isUsingPrompt} onClick={() => void applyPrompt()}>
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
                <span>{state.answerSlots === 1 ? 'Your answer' : `Blank ${index + 1}`} <small>{WISECRACKER_ANSWER_MAX_LENGTH - answer.length} left</small></span>
                <input
                  id={`wc-answer-${index}`}
                  value={answer}
                  disabled={isSubmittingAnswers}
                  maxLength={WISECRACKER_ANSWER_MAX_LENGTH}
                  autoComplete="off"
                  onChange={(event) => setAnswers((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                  placeholder={state.answerSlots === 1 ? 'Make it count...' : `Fill blank ${index + 1}`}
                />
              </label>
            ))}
            <button type="submit" className="tactile-button tactile-button--success wc-button wc-button--success wc-button--wide" disabled={!canSubmitAnswers || isSubmittingAnswers}>
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
          {revealedResponses.length === 0 && <p className="wc-empty-answer">The first answer is waiting behind the curtain.</p>}
          {revealedResponses.map((response, index) => {
            const card = (
              <>
                <span className="wc-answer-card__number">Answer {index + 1}</span>
                <FilledPrompt prompt={state.prompt} answers={response.answers} />
                {canChoose && <span className="wc-answer-card__vote"><Vote aria-hidden="true" /> Choose this answer</span>}
              </>
            )
            return canChoose ? (
              <button
                key={response.responseId}
                type="button"
                className="wc-answer-card wc-answer-card--selectable"
                disabled={Boolean(selectingResponseId)}
                aria-label={`Choose answer ${index + 1} as the round winner`}
                onClick={() => void selectWinner(response.responseId)}
              >
                {card}
              </button>
            ) : (
              <article key={response.responseId} className="wc-answer-card">{card}</article>
            )
          })}
        </div>

        {actionMode === 'revealAnswer' && (
          <button type="button" className="tactile-button tactile-button--primary wc-button wc-button--primary wc-button--wide" disabled={isRevealing} onClick={() => void revealNextAnswer()}>
            <Sparkles aria-hidden="true" />
            {isRevealing ? 'Revealing' : revealedResponses.length === 0 ? 'Reveal first answer' : 'Reveal next answer'}
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
    const winnerId = isComplete ? state.matchWinnerUserId : null
    const winner = winnerId ? playersById[winnerId] : undefined
    const isHostAction = actionMode === 'roundResultHost'

    return (
      <div className="wc-stage-body">
        <div className={`wc-winner ${isComplete ? 'wc-winner--final' : ''}`}>
          <div className="wc-winner__icon">{isComplete ? <Trophy aria-hidden="true" /> : <Crown aria-hidden="true" />}</div>
          <p className="wc-kicker">{isComplete ? 'Match winner' : 'Round winner'}</p>
          <h3>{winner?.username || (isComplete ? 'Winner' : 'Room favorite')}</h3>
          <p>{isComplete ? `First to ${state.maxScore} takes the spotlight.` : 'One point for the room favorite.'}</p>
        </div>

        {state.roundWinnerResponseId && (
          <article className="wc-answer-card wc-answer-card--winner">
            <span className="wc-answer-card__number">Winning answer</span>
            <FilledPrompt
              prompt={state.prompt}
              answers={state.revealedResponses.find((response) => response.responseId === state.roundWinnerResponseId)?.answers || []}
            />
          </article>
        )}

        {isHostAction ? (
          <button
            type="button"
            className="tactile-button tactile-button--primary wc-button wc-button--primary wc-button--wide"
            disabled={isAdvancingRound}
            onClick={() => void advanceRound()}
          >
            <Mic2 aria-hidden="true" />
            {isAdvancingRound ? 'Getting ready' : 'Start next round'}
          </button>
        ) : (
          <WaitingNotice
            icon={Clock3}
            title={isComplete ? 'Match complete' : 'Next round coming up'}
            detail={isComplete ? (isHost ? 'Use Play Again above to gather everyone in a fresh lobby.' : 'The host can gather everyone in a fresh lobby with Play Again.') : 'The host will start the next prompt when the room is ready.'}
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
          {chooser?.username ? (
            <PlayerAvatar name={chooser.username} size="lg" status={chooserIsConnected ? 'turn' : 'offline'} />
          ) : (
            <div className="wc-hud__avatar" aria-hidden="true"><Mic2 /></div>
          )}
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
        <section className="wc-stage" aria-labelledby="wc-stage-title">
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
        </section>

        {isDesktopLayout && <aside className="wc-desktop-rail" aria-label="Wisecracker information">
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
        </aside>}
      </div>

      {!isDesktopLayout && <>
        <div className="wc-mobile-dock">
          <TabletopDockButtons
            tabs={INSPECTOR_TABS}
            activeTab={activeTab}
            onSelect={openInspector}
            ariaLabel="Open Wisecracker information"
            isOpen={sheetOpen}
          />
        </div>

        <TabletopBottomSheet
          isOpen={sheetOpen}
          title={INSPECTOR_TABS.find((tab) => tab.id === activeTab)?.label || 'Game information'}
          onClose={() => setSheetOpen(false)}
          contentKey={activeTab}
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
      </>}
    </div>
  )
}

function useTabletopDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1120px)').matches
  ))

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1120px)')
    const handleChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches)
    setIsDesktop(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isDesktop
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
          const submitted = Boolean(state.submissionStatus[id])
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
        const isWinner = state.matchWinnerUserId === id
        return (
          <div key={id} className={`wc-player-row ${isChooser ? 'is-chooser' : ''} ${isWinner ? 'is-winner' : ''}`}>
            <PlayerAvatar
              name={player?.username || '?'}
              size="md"
              status={isChooser ? 'turn' : connected ? 'online' : 'offline'}
            />
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
