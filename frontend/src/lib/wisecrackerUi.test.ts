import { describe, expect, it } from 'vitest'
import { WisecrackerState } from '../types/game'
import {
  WISECRACKER_ANSWER_MAX_LENGTH,
  WISECRACKER_MAX_BLANKS,
  WISECRACKER_PROMPT_MAX_LENGTH,
  countWisecrackerBlanks,
  getWisecrackerPhasePresentation,
  getWisecrackerRoundProgress,
  normalizeWisecrackerState,
  resolveWisecrackerActionMode,
  splitWisecrackerPrompt,
} from './wisecrackerUi'

function makeState(overrides: Partial<WisecrackerState> = {}): WisecrackerState {
  return {
    phase: 'lobby',
    hostUserId: 'host',
    maxScore: 3,
    chooserUserId: null,
    chooserIndex: 0,
    activePlayerIds: ['host', 'writer-1', 'writer-2'],
    waitingPlayerIds: [],
    prompt: '',
    answerSlots: 0,
    submissionStatus: {},
    revealedResponses: [],
    scores: { host: 0, 'writer-1': 0, 'writer-2': 0 },
    roundWinnerResponseId: null,
    matchWinnerUserId: null,
    ...overrides,
  }
}

describe('resolveWisecrackerActionMode', () => {
  it.each([
    ['lobby host', makeState(), 'host', 'lobbyHost'],
    ['lobby guest', makeState(), 'writer-1', 'lobbyGuest'],
    ['chooser prompt', makeState({ phase: 'prompt', chooserUserId: 'host' }), 'host', 'choosePrompt'],
    ['prompt spectator', makeState({ phase: 'prompt', chooserUserId: 'host' }), 'writer-1', 'waitForPrompt'],
    ['active writer', makeState({ phase: 'answering', chooserUserId: 'host' }), 'writer-1', 'submitAnswers'],
    ['submitted writer', makeState({ phase: 'answering', chooserUserId: 'host', submissionStatus: { 'writer-1': true } }), 'writer-1', 'answersLocked'],
    ['chooser waiting for answers', makeState({ phase: 'answering', chooserUserId: 'host' }), 'host', 'waitForAnswers'],
    ['chooser revealing', makeState({ phase: 'revealing', chooserUserId: 'host', submissionStatus: { 'writer-1': true, 'writer-2': true }, revealedResponses: [{ responseId: 'response-1', answers: ['A'] }] }), 'host', 'revealAnswer'],
    ['chooser voting', makeState({ phase: 'revealing', chooserUserId: 'host', submissionStatus: { 'writer-1': true, 'writer-2': true }, revealedResponses: [{ responseId: 'response-1', answers: ['A'] }, { responseId: 'response-2', answers: ['B'] }] }), 'host', 'chooseWinner'],
    ['writer watching reveal', makeState({ phase: 'revealing', chooserUserId: 'host', submissionStatus: { 'writer-1': true, 'writer-2': true }, revealedResponses: [{ responseId: 'response-1', answers: ['A'] }, { responseId: 'response-2', answers: ['B'] }] }), 'writer-1', 'waitForReveal'],
    ['round result host', makeState({ phase: 'roundResult' }), 'host', 'roundResultHost'],
    ['round result guest', makeState({ phase: 'roundResult' }), 'writer-1', 'roundResultGuest'],
    ['completed host', makeState({ phase: 'completed' }), 'host', 'completedHost'],
    ['completed guest', makeState({ phase: 'completed' }), 'writer-1', 'completedGuest'],
  ] as const)('resolves %s', (_label, state, userId, expected) => {
    expect(resolveWisecrackerActionMode(state, userId)).toBe(expected)
  })

  it('keeps a mid-round joiner in the waiting state regardless of the active phase', () => {
    const state = makeState({
      phase: 'revealing',
      chooserUserId: 'host',
      activePlayerIds: ['host', 'writer-1', 'writer-2'],
      waitingPlayerIds: ['late'],
      submissionStatus: { 'writer-1': true, 'writer-2': true },
      revealedResponses: [{ responseId: 'response-1', answers: ['A'] }, { responseId: 'response-2', answers: ['B'] }],
    })

    expect(resolveWisecrackerActionMode(state, 'late')).toBe('waitingPlayer')
  })
})

describe('Wisecracker presentation helpers', () => {
  it('normalizes a persisted lobby state whose empty maps were omitted', () => {
    const state = normalizeWisecrackerState({
      phase: 'lobby',
      hostUserId: 'host',
      activePlayerIds: ['host'],
      waitingPlayerIds: [],
      scores: { host: 0 },
    })

    expect(state.submissionStatus).toEqual({})
    expect(state.revealedResponses).toEqual([])
    expect(getWisecrackerRoundProgress(state)).toEqual({ submitted: 0, totalTypers: 1, revealed: 0, totalAnswers: 0 })
  })

  it.each(['lobby', 'prompt', 'answering', 'revealing', 'roundResult', 'completed'] as const)(
    'handles omitted empty collections during the %s phase',
    (phase) => {
      const partial: Partial<WisecrackerState> = {
        phase,
        hostUserId: 'host',
        chooserUserId: phase === 'lobby' ? null : 'host',
        activePlayerIds: ['host', 'writer-1'],
      }

      expect(() => normalizeWisecrackerState(partial)).not.toThrow()
      expect(() => getWisecrackerRoundProgress(partial)).not.toThrow()
      expect(() => resolveWisecrackerActionMode(partial, 'writer-1')).not.toThrow()
    },
  )

  it('provides a presentation for every phase', () => {
    const phases = ['lobby', 'prompt', 'answering', 'revealing', 'roundResult', 'completed'] as const
    expect(phases.map((phase) => getWisecrackerPhasePresentation(phase).label)).toEqual([
      'Lobby',
      'Choosing prompt',
      'Writing answers',
      'Revealing',
      'Round complete',
      'Match complete',
    ])
  })

  it('reports submission and reveal progress without mutating the state', () => {
    const state = makeState({
      phase: 'revealing',
      chooserUserId: 'host',
      submissionStatus: { 'writer-1': true, 'writer-2': true },
      revealedResponses: [{ responseId: 'response-2', answers: ['two'] }],
    })
    const snapshot = JSON.stringify(state)

    expect(getWisecrackerRoundProgress(state)).toEqual({ submitted: 2, totalTypers: 2, revealed: 1, totalAnswers: 2 })
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('normalizes only the privacy-safe response projection', () => {
    const state = normalizeWisecrackerState({
      phase: 'revealing',
      activePlayerIds: ['host', 'writer-1'],
      submittedAnswers: { 'writer-1': ['private legacy answer'] },
      answerOrder: ['writer-1'],
      roundWinnerUserId: 'writer-1',
      submissionStatus: { 'writer-1': true },
      revealedResponses: [{ responseId: 'opaque-1', answers: ['public answer'] }],
    })

    expect(state).not.toHaveProperty('submittedAnswers')
    expect(state).not.toHaveProperty('answerOrder')
    expect(state).not.toHaveProperty('roundWinnerUserId')
    expect(state.revealedResponses).toEqual([{ responseId: 'opaque-1', answers: ['public answer'] }])
  })

  it('splits blank prompts while leaving plain prompts intact', () => {
    expect(splitWisecrackerPrompt('A _ needs _.')).toEqual(['A ', ' needs ', '.'])
    expect(splitWisecrackerPrompt('Tell us a joke.')).toEqual(['Tell us a joke.'])
  })

  it('treats each uninterrupted underscore run as one blank', () => {
    expect(splitWisecrackerPrompt('_')).toEqual(['', ''])
    expect(splitWisecrackerPrompt('___')).toEqual(['', ''])
    expect(splitWisecrackerPrompt('I never understood ______ until ______.')).toEqual([
      'I never understood ',
      ' until ',
      '.',
    ])
    expect(splitWisecrackerPrompt('___ text __')).toEqual(['', ' text ', ''])
    expect(countWisecrackerBlanks('___ text __')).toBe(2)
    expect(countWisecrackerBlanks('No blanks here')).toBe(0)
  })

  it('matches the server input limits', () => {
    expect(WISECRACKER_PROMPT_MAX_LENGTH).toBe(240)
    expect(WISECRACKER_ANSWER_MAX_LENGTH).toBe(160)
    expect(WISECRACKER_MAX_BLANKS).toBe(10)
  })
})
