import { gameService } from './gameService'
import { logSecurityEvent } from '../utils/securityLogger'

const DEFAULT_BATCH_SIZE = 25
const DEFAULT_INTERVAL_MS = 60 * 1000

let reconciliationTimer: ReturnType<typeof setInterval> | null = null
let reconciliationRunning = false

export async function runStatsReconciliationBatch(batchSize = DEFAULT_BATCH_SIZE): Promise<void> {
  if (reconciliationRunning) return
  reconciliationRunning = true
  try {
    const result = await gameService.reconcilePendingStats(batchSize)
    if (result.scanned > 0) {
      logSecurityEvent('game.stats_reconciliation_batch', result, result.deferred > 0 ? 'warn' : 'info')
    }
  } catch (error) {
    logSecurityEvent('game.stats_reconciliation_batch_failed', {
      errorName: error instanceof Error ? error.name : 'unknown',
    }, 'error')
  } finally {
    reconciliationRunning = false
  }
}

/** Starts one immediate retry batch and a bounded periodic worker. */
export function startStatsReconciliationWorker(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (reconciliationTimer) return
  void runStatsReconciliationBatch()
  reconciliationTimer = setInterval(() => {
    void runStatsReconciliationBatch()
  }, intervalMs)
  reconciliationTimer.unref()
}

export function stopStatsReconciliationWorker(): void {
  if (!reconciliationTimer) return
  clearInterval(reconciliationTimer)
  reconciliationTimer = null
}
