import { Request, Response, NextFunction } from 'express'
import { AuthPayload } from '../types/api'
import { UnauthorizedError } from '../utils/errors'
import { getTokenFromHeaders, verifyAuthToken } from '../utils/authToken'

export interface AuthRequest extends Request {
  user?: AuthPayload
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = getTokenFromHeaders(req.headers.authorization, req.headers.cookie)
  if (!token) {
    next(new UnauthorizedError('No token provided'))
    return
  }

  try {
    const payload = verifyAuthToken(token)
    req.user = payload
    next()
  } catch {
    next(new UnauthorizedError('Invalid token'))
  }
}
