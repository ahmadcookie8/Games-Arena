import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors'
import { logSecurityEvent } from '../utils/securityLogger'

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const httpError = err as Error & { status?: number; type?: string }
  if (httpError.status === 413 || httpError.type === 'entity.too.large') {
    logSecurityEvent('http.payload_too_large', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    })
    res.status(413).json({
      success: false,
      error: 'Request payload is too large',
      code: 'PAYLOAD_TOO_LARGE',
    })
    return
  }

  if (httpError.status === 400 && (
    httpError.type === 'entity.parse.failed'
    || httpError.type === 'entity.verify.failed'
  )) {
    logSecurityEvent('http.malformed_json', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    })
    res.status(400).json({
      success: false,
      error: 'Invalid JSON request body',
      code: 'VALIDATION_ERROR',
    })
    return
  }

  if (err instanceof AppError) {
    const event = err.statusCode === 401
      ? 'auth.failure'
      : err.statusCode === 403
        ? 'authorization.denied'
        : err.statusCode === 429
          ? 'rate_limit.exceeded'
          : err.statusCode === 409
            ? 'game.conflict'
            : null
    if (event) {
      logSecurityEvent(event, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        statusCode: err.statusCode,
        errorCode: err.code,
      })
    }

    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    })
    return
  }

  if (err instanceof ZodError) {
    logSecurityEvent('http.malformed_payload', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      issueCount: err.issues.length,
    })
    res.status(400).json({
      success: false,
      error: err.errors[0]?.message || 'Invalid request',
      code: 'VALIDATION_ERROR',
    })
    return
  }

  logSecurityEvent('http.unhandled_error', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    errorName: err.name,
  }, 'error')
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  })
}
