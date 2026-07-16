import { describe, expect, it } from 'vitest'
import { MAX_REPLAY_INPUTS, MAX_REPLAY_TICKS } from '@games-arena/game-engine'
import {
  buildReplayPayload,
  createReplayRecorder,
  getCompletedReplayStatus,
  getInitialReplayEligibility,
  getReplayRunPresentation,
  isExplicitReplayRejection,
  recordReplayTick,
} from './singlePlayerReplay'

const SEED = 'a'.repeat(64)

describe('single-player replay recording', () => {
  it('records only effective direction changes at unique active ticks', () => {
    const recorder = createReplayRecorder('right')

    recordReplayTick(recorder, 'right')
    recordReplayTick(recorder, 'up')
    recordReplayTick(recorder, 'up')
    recordReplayTick(recorder, 'left')

    expect(buildReplayPayload(recorder)).toEqual({
      version: 1,
      tickCount: 4,
      inputs: [
        { tick: 1, direction: 'up' },
        { tick: 3, direction: 'left' },
      ],
    })
  })

  it('advances replay time only when an active simulation tick is recorded', () => {
    const recorder = createReplayRecorder()

    expect(recorder.tickCount).toBe(0)
    recordReplayTick(recorder)
    expect(recorder.tickCount).toBe(1)
  })

  it('fails closed when the tick or input bound would be exceeded', () => {
    const tickRecorder = createReplayRecorder()
    tickRecorder.tickCount = MAX_REPLAY_TICKS
    expect(recordReplayTick(tickRecorder, 'up')).toBe(false)
    expect(buildReplayPayload(tickRecorder)).toBeNull()
    expect(tickRecorder.reason).toBe('limit')

    const inputRecorder = createReplayRecorder()
    inputRecorder.inputs = Array.from({ length: MAX_REPLAY_INPUTS }, (_, tick) => ({
      tick,
      direction: tick % 2 === 0 ? 'up' : 'left',
    }))
    inputRecorder.tickCount = MAX_REPLAY_INPUTS
    inputRecorder.lastDirection = 'left'
    expect(recordReplayTick(inputRecorder, 'down')).toBe(false)
    expect(inputRecorder.reason).toBe('limit')
  })
})

describe('single-player replay eligibility presentation', () => {
  it('allows only a fresh state with a supported server seed', () => {
    expect(getInitialReplayEligibility({ version: 1, seed: SEED }, { tick: 0, hasStarted: false })).toEqual({ eligible: true })
    expect(getInitialReplayEligibility({ version: 1, seed: SEED }, { tick: 3, hasStarted: true })).toEqual({
      eligible: false,
      reason: 'interrupted',
    })
    expect(getInitialReplayEligibility(undefined, { tick: 0, hasStarted: false })).toEqual({
      eligible: false,
      reason: 'legacy',
    })
  })

  it('clearly distinguishes verified and unranked results', () => {
    expect(getCompletedReplayStatus('replay')).toBe('verified')
    expect(getCompletedReplayStatus('unverified')).toBe('unranked')
    expect(getReplayRunPresentation('verified').label).toBe('Verified score')
    expect(getReplayRunPresentation('retry').label).toBe('Verification pending')
    expect(getReplayRunPresentation('unranked', 'interrupted').label).toContain('unranked')
  })

  it('preserves the recorder for retryable start races, throttling, and server errors', () => {
    expect(isExplicitReplayRejection(400, 'INVALID_REPLAY')).toBe(true)
    expect(isExplicitReplayRejection(400, 'REPLAY_TOO_FAST')).toBe(true)
    expect(isExplicitReplayRejection(400, 'BAD_REQUEST')).toBe(false)
    expect(isExplicitReplayRejection(409, 'REPLAY_START_PENDING')).toBe(false)
    expect(isExplicitReplayRejection(429, 'RATE_LIMITED')).toBe(false)
    expect(isExplicitReplayRejection(500, undefined)).toBe(false)
    expect(isExplicitReplayRejection(undefined, undefined)).toBe(false)
  })
})
