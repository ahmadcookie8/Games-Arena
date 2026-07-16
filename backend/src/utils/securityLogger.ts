import { createHash } from 'crypto'
import winston from 'winston'
import { config } from '../config'

type SecurityLevel = 'info' | 'warn' | 'error'

const FORBIDDEN_CONTEXT_KEY = /(authorization|cookie|token|secret|password|chat|message|text|answer|prompt)/i
const IDENTITY_CONTEXT_KEY = /(^|_)(ip|email|identifier)$/i
const MAX_CONTEXT_STRING_LENGTH = 200

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
  silent: config.nodeEnv === 'test',
})

function hashIdentity(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const entries: Array<[string, unknown]> = []
  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN_CONTEXT_KEY.test(key) || value === undefined) continue
    if (typeof value === 'string') {
      const sanitized = IDENTITY_CONTEXT_KEY.test(key)
        ? hashIdentity(value)
        : value.slice(0, MAX_CONTEXT_STRING_LENGTH)
      entries.push([key, sanitized])
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) entries.push([key, value])
  }
  return Object.fromEntries(entries)
}

export function logSecurityEvent(
  event: string,
  context: Record<string, unknown> = {},
  level: SecurityLevel = 'warn'
): void {
  logger.log(level, 'security_event', {
    event: event.replace(/[^a-z0-9_.-]/gi, '_').slice(0, 80),
    ...sanitizeContext(context),
  })
}

export function startResourcePressureMonitor(options: {
  memoryLimitBytes?: number
  cpuThresholdRatio?: number
  intervalMs?: number
} = {}): () => void {
  const memoryLimitBytes = options.memoryLimitBytes || 512 * 1024 * 1024
  const cpuThresholdRatio = options.cpuThresholdRatio || 0.9
  const intervalMs = options.intervalMs || 60_000
  let lastMemoryWarningAt = 0
  let lastCpuWarningAt = 0
  let previousCpuUsage = process.cpuUsage()
  let previousSampleTime = process.hrtime.bigint()

  const timer = setInterval(() => {
    const now = Date.now()
    const memory = process.memoryUsage()
    if (memory.rss >= memoryLimitBytes && now - lastMemoryWarningAt >= intervalMs) {
      lastMemoryWarningAt = now
      logSecurityEvent('resource.memory_pressure', {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        thresholdBytes: memoryLimitBytes,
      }, 'error')
    }

    const sampleTime = process.hrtime.bigint()
    const cpuUsage = process.cpuUsage(previousCpuUsage)
    const elapsedMicroseconds = Number(sampleTime - previousSampleTime) / 1_000
    const cpuRatio = elapsedMicroseconds > 0
      ? (cpuUsage.user + cpuUsage.system) / elapsedMicroseconds
      : 0
    previousCpuUsage = process.cpuUsage()
    previousSampleTime = sampleTime

    if (cpuRatio >= cpuThresholdRatio && now - lastCpuWarningAt >= intervalMs) {
      lastCpuWarningAt = now
      logSecurityEvent('resource.cpu_pressure', {
        cpuRatio: Number(cpuRatio.toFixed(3)),
        thresholdRatio: cpuThresholdRatio,
      }, 'error')
    }
  }, intervalMs)
  timer.unref()

  return () => clearInterval(timer)
}
