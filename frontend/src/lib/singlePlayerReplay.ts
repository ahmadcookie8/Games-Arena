import {
  GAME_ENGINE_VERSION,
  MAX_REPLAY_INPUTS,
  MAX_REPLAY_TICKS,
  REPLAY_SEED_PATTERN,
  type Direction,
  type ReplayInput,
  type ReplayV1,
} from '@games-arena/game-engine'
import type { GameReplayDescriptor, ResultVerification } from '../types/game'

export type ReplayUnrankedReason = 'legacy' | 'interrupted' | 'limit' | 'verification'
export type ReplayRunStatus = 'eligible' | 'verifying' | 'retry' | 'verified' | 'unranked'

export interface ReplayRecorder {
  tickCount: number
  inputs: ReplayInput[]
  lastDirection?: Direction
  valid: boolean
  reason?: ReplayUnrankedReason
}

export interface ReplayEligibility {
  eligible: boolean
  reason?: ReplayUnrankedReason
}

export interface ReplayRunPresentation {
  label: string
  detail: string
  tone: 'accent' | 'warning' | 'success'
}

export function createReplayRecorder(initialDirection?: Direction): ReplayRecorder {
  return {
    tickCount: 0,
    inputs: [],
    lastDirection: initialDirection,
    valid: true,
  }
}

/** Records at most one effective direction for the next active simulation tick. */
export function recordReplayTick(recorder: ReplayRecorder, direction?: Direction): boolean {
  if (!recorder.valid) return false
  if (recorder.tickCount >= MAX_REPLAY_TICKS) {
    invalidateReplayRecorder(recorder, 'limit')
    return false
  }

  if (direction !== undefined && direction !== recorder.lastDirection) {
    if (recorder.inputs.length >= MAX_REPLAY_INPUTS) {
      invalidateReplayRecorder(recorder, 'limit')
      return false
    }
    recorder.inputs.push({ tick: recorder.tickCount, direction })
    recorder.lastDirection = direction
  }

  recorder.tickCount += 1
  return true
}

export function invalidateReplayRecorder(recorder: ReplayRecorder, reason: ReplayUnrankedReason): void {
  recorder.valid = false
  recorder.reason = reason
}

export function buildReplayPayload(recorder: ReplayRecorder): ReplayV1 | null {
  if (!recorder.valid || recorder.tickCount < 1) return null
  return {
    version: GAME_ENGINE_VERSION,
    tickCount: recorder.tickCount,
    inputs: recorder.inputs.map((input) => ({ ...input })),
  }
}

export function getInitialReplayEligibility(
  replay: GameReplayDescriptor | undefined,
  state: { tick?: unknown; hasStarted?: unknown },
): ReplayEligibility {
  if (
    replay?.version !== GAME_ENGINE_VERSION
    || typeof replay.seed !== 'string'
    || !REPLAY_SEED_PATTERN.test(replay.seed)
  ) {
    return { eligible: false, reason: 'legacy' }
  }

  if (state.tick !== 0 || state.hasStarted === true) {
    return { eligible: false, reason: 'interrupted' }
  }

  return { eligible: true }
}

export function getReplayRunPresentation(
  status: ReplayRunStatus,
  reason?: ReplayUnrankedReason,
): ReplayRunPresentation {
  if (status === 'verified') {
    return {
      label: 'Verified score',
      detail: 'The server reproduced this run from its input replay.',
      tone: 'success',
    }
  }
  if (status === 'verifying') {
    return {
      label: 'Verifying replay',
      detail: 'The server is reproducing the run before ranking the score.',
      tone: 'accent',
    }
  }
  if (status === 'retry') {
    return {
      label: 'Verification pending',
      detail: 'The replay is still retained in this tab. Retry when the connection is available.',
      tone: 'warning',
    }
  }
  if (status === 'eligible') {
    return {
      label: 'Replay protected',
      detail: 'Active simulation ticks and direction changes will be verified by the server.',
      tone: 'accent',
    }
  }

  switch (reason) {
    case 'interrupted':
      return {
        label: 'Resumed run — unranked',
        detail: 'Replay continuity ended when this run was interrupted. You can finish it, but it will not enter the leaderboard.',
        tone: 'warning',
      }
    case 'limit':
      return {
        label: 'Verification limit reached — unranked',
        detail: 'This run exceeded the bounded replay limit. You can finish it, but it will not enter the leaderboard.',
        tone: 'warning',
      }
    case 'verification':
      return {
        label: 'Replay rejected — unranked',
        detail: 'The submitted replay could not be reproduced. The score is retained as unranked history.',
        tone: 'warning',
      }
    default:
      return {
        label: 'Legacy run — unranked',
        detail: 'This run predates deterministic replay verification. Start a new run to compete on the leaderboard.',
        tone: 'warning',
      }
  }
}

export function getCompletedReplayStatus(verification?: ResultVerification): ReplayRunStatus {
  return verification === 'replay' ? 'verified' : 'unranked'
}

/** Only a validation rejection is terminal; conflicts, throttling and 5xx remain retryable. */
export function isExplicitReplayRejection(status: number | undefined, code: unknown): boolean {
  return status === 400
    && typeof code === 'string'
    && (code === 'INVALID_REPLAY' || code.startsWith('REPLAY_'))
}
