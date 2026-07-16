jest.mock('./gameService', () => ({
  gameService: { reconcilePendingStats: jest.fn() },
}))

jest.mock('../utils/securityLogger', () => ({
  logSecurityEvent: jest.fn(),
}))

import { gameService } from './gameService'
import {
  runStatsReconciliationBatch,
  startStatsReconciliationWorker,
  stopStatsReconciliationWorker,
} from './statsReconciliationWorker'

const reconcilePendingStats = gameService.reconcilePendingStats as jest.Mock

describe('stats reconciliation worker', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    reconcilePendingStats.mockResolvedValue({ scanned: 0, processed: 0, deferred: 0 })
    stopStatsReconciliationWorker()
  })

  afterEach(() => {
    stopStatsReconciliationWorker()
    jest.useRealTimers()
  })

  it('runs immediately and periodically in bounded batches', async () => {
    startStatsReconciliationWorker(1_000)
    await Promise.resolve()
    await Promise.resolve()

    expect(reconcilePendingStats).toHaveBeenCalledWith(25)

    jest.advanceTimersByTime(1_000)
    await Promise.resolve()
    await Promise.resolve()

    expect(reconcilePendingStats).toHaveBeenCalledTimes(2)
  })

  it('contains backend failures so a later interval can retry', async () => {
    reconcilePendingStats.mockRejectedValueOnce(new Error('Mongo unavailable'))

    await expect(runStatsReconciliationBatch()).resolves.toBeUndefined()
    reconcilePendingStats.mockResolvedValueOnce({ scanned: 1, processed: 1, deferred: 0 })
    await expect(runStatsReconciliationBatch()).resolves.toBeUndefined()

    expect(reconcilePendingStats).toHaveBeenCalledTimes(2)
  })
})
