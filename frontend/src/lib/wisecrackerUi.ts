import { WisecrackerPhase, WisecrackerRevealedResponse, WisecrackerState } from '../types/game'

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
    submissionStatus: readBooleanMap(raw.submissionStatus),
    ...(Array.isArray(raw.myAnswers) ? { myAnswers: readAnswers(raw.myAnswers) } : {}),
    revealedResponses: readRevealedResponses(raw.revealedResponses),
    scores,
    roundWinnerResponseId: typeof raw.roundWinnerResponseId === 'string' ? raw.roundWinnerResponseId : null,
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
      if (state.submissionStatus[userId]) return 'answersLocked'
      return state.activePlayerIds.includes(userId) ? 'submitAnswers' : 'waitForAnswers'
    case 'revealing': {
      if (state.chooserUserId !== userId) return 'waitForReveal'
      const totalResponses = Object.values(state.submissionStatus).filter(Boolean).length
      const allRevealed = totalResponses > 0 && state.revealedResponses.length >= totalResponses
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
  const submitted = typers.filter((id) => Boolean(state.submissionStatus[id])).length
  const hasRoundResponses = state.phase === 'revealing' || state.phase === 'roundResult' || state.phase === 'completed'
  return {
    submitted,
    totalTypers: typers.length,
    revealed: state.revealedResponses.length,
    totalAnswers: hasRoundResponses ? submitted : 0,
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

function readBooleanMap(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  )
}

function readAnswers(value: unknown[]): string[] {
  return value.filter((answer): answer is string => typeof answer === 'string')
}

function readRevealedResponses(value: unknown): WisecrackerRevealedResponse[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.responseId !== 'string' || seen.has(item.responseId) || !Array.isArray(item.answers)) return []
    seen.add(item.responseId)
    return [{ responseId: item.responseId, answers: readAnswers(item.answers) }]
  })
}

function readInteger(value: unknown, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}
