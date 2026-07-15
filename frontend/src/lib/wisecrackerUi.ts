import { WisecrackerPhase, WisecrackerState } from '../types/game'

const WISECRACKER_PHASES: readonly WisecrackerPhase[] = ['lobby', 'prompt', 'answering', 'revealing', 'roundResult', 'completed']

export type WisecrackerActionMode =
  | 'lobbyHost'
  | 'lobbyGuest'
  | 'waitingPlayer'
  | 'choosePrompt'
  | 'waitForPrompt'
  | 'submitAnswers'
  | 'answersLocked'
  | 'waitForAnswers'
  | 'revealAnswer'
  | 'chooseWinner'
  | 'waitForReveal'
  | 'roundResultHost'
  | 'roundResultGuest'
  | 'completedHost'
  | 'completedGuest'

export type WisecrackerPhaseTone = 'neutral' | 'accent' | 'info' | 'warning' | 'success'

export interface WisecrackerPhasePresentation {
  label: string
  eyebrow: string
  tone: WisecrackerPhaseTone
}

export interface WisecrackerRoundProgress {
  submitted: number
  totalTypers: number
  revealed: number
  totalAnswers: number
}

export function normalizeWisecrackerState(value: unknown, fallbackPlayerIds: readonly string[] = []): WisecrackerState {
  const raw = isRecord(value) ? value : {}
  const activePlayerIds = readStringArray(raw.activePlayerIds, fallbackPlayerIds)
  const waitingPlayerIds = readStringArray(raw.waitingPlayerIds)
    .filter((id) => !activePlayerIds.includes(id))
  const scores = readNumberMap(raw.scores)

  for (const id of [...activePlayerIds, ...waitingPlayerIds]) scores[id] ??= 0

  return {
    phase: WISECRACKER_PHASES.includes(raw.phase as WisecrackerPhase) ? raw.phase as WisecrackerPhase : 'lobby',
    hostUserId: typeof raw.hostUserId === 'string' ? raw.hostUserId : activePlayerIds[0] ?? fallbackPlayerIds[0] ?? '',
    maxScore: readInteger(raw.maxScore, 3, 1, 50),
    chooserUserId: typeof raw.chooserUserId === 'string' ? raw.chooserUserId : null,
    chooserIndex: readInteger(raw.chooserIndex, 0, 0),
    activePlayerIds,
    waitingPlayerIds,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    answerSlots: readInteger(raw.answerSlots, 0, 0),
    submittedAnswers: readAnswerMap(raw.submittedAnswers),
    answerOrder: readStringArray(raw.answerOrder),
    revealedCount: readInteger(raw.revealedCount, 0, 0),
    scores,
    roundWinnerUserId: typeof raw.roundWinnerUserId === 'string' ? raw.roundWinnerUserId : null,
    matchWinnerUserId: typeof raw.matchWinnerUserId === 'string' ? raw.matchWinnerUserId : null,
  }
}

export function resolveWisecrackerActionMode(stateValue: Partial<WisecrackerState>, userId: string): WisecrackerActionMode {
  const state = normalizeWisecrackerState(stateValue)
  const isHost = state.hostUserId === userId

  if (state.phase === 'lobby') return isHost ? 'lobbyHost' : 'lobbyGuest'
  if (state.waitingPlayerIds.includes(userId)) return 'waitingPlayer'

  switch (state.phase) {
    case 'prompt':
      return state.chooserUserId === userId ? 'choosePrompt' : 'waitForPrompt'
    case 'answering':
      if (state.chooserUserId === userId) return 'waitForAnswers'
      if (state.submittedAnswers[userId]) return 'answersLocked'
      return state.activePlayerIds.includes(userId) ? 'submitAnswers' : 'waitForAnswers'
    case 'revealing': {
      if (state.chooserUserId !== userId) return 'waitForReveal'
      const allRevealed = state.answerOrder.length > 0 && state.revealedCount >= state.answerOrder.length
      return allRevealed ? 'chooseWinner' : 'revealAnswer'
    }
    case 'roundResult':
      return isHost ? 'roundResultHost' : 'roundResultGuest'
    case 'completed':
      return isHost ? 'completedHost' : 'completedGuest'
    default:
      return 'waitForReveal'
  }
}

export function getWisecrackerPhasePresentation(phase: WisecrackerPhase): WisecrackerPhasePresentation {
  switch (phase) {
    case 'lobby':
      return { label: 'Lobby', eyebrow: 'Gather the room', tone: 'neutral' }
    case 'prompt':
      return { label: 'Choosing prompt', eyebrow: 'Set the scene', tone: 'accent' }
    case 'answering':
      return { label: 'Writing answers', eyebrow: 'Write the punchline', tone: 'info' }
    case 'revealing':
      return { label: 'Revealing', eyebrow: 'Take the stage', tone: 'warning' }
    case 'roundResult':
      return { label: 'Round complete', eyebrow: 'And the point goes to', tone: 'success' }
    case 'completed':
      return { label: 'Match complete', eyebrow: 'Final curtain', tone: 'success' }
  }
}

export function getWisecrackerRoundProgress(stateValue: Partial<WisecrackerState>): WisecrackerRoundProgress {
  const state = normalizeWisecrackerState(stateValue)
  const typers = state.activePlayerIds.filter((id) => id !== state.chooserUserId)
  return {
    submitted: typers.filter((id) => Boolean(state.submittedAnswers[id])).length,
    totalTypers: typers.length,
    revealed: Math.min(state.revealedCount, state.answerOrder.length),
    totalAnswers: state.answerOrder.length,
  }
}

export function splitWisecrackerPrompt(prompt: string): string[] {
  return prompt.includes('_') ? prompt.split(/_+/) : [prompt]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readStringArray(value: unknown, fallback: readonly string[] = []): string[] {
  const source = Array.isArray(value) ? value : fallback
  return [...new Set(source.filter((item): item is string => typeof item === 'string'))]
}

function readNumberMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])),
  )
}

function readAnswerMap(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
      .map(([id, answers]) => [id, answers.filter((answer): answer is string => typeof answer === 'string')]),
  )
}

function readInteger(value: unknown, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}
