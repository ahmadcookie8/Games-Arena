import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors'

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: err.errors[0]?.message || 'Invalid request',
      code: 'VALIDATION_ERROR',
    })
    return
  }

  console.error('Unhandled error:', err)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  })
}
