import { Request, Response, NextFunction } from 'express'
import { authenticateSessionPayload } from '../services/sessionAuthService'
import { UnauthorizedError } from '../utils/errors'
import { clearAuthCookie, getAuthTokenFromCookie, VerifiedAuthPayload, verifyAuthToken } from '../utils/authToken'

export interface AuthRequest extends Request {
  user?: VerifiedAuthPayload
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = getAuthTokenFromCookie(req.headers.cookie)
  if (!token) {
    next(new UnauthorizedError('Authentication required'))
    return
  }

  let payload: VerifiedAuthPayload
  try {
    payload = verifyAuthToken(token)
  } catch {
    clearAuthCookie(res)
    next(new UnauthorizedError('Invalid session'))
    return
  }

  try {
    const activeSession = await authenticateSessionPayload(payload)
    if (!activeSession) {
      clearAuthCookie(res)
      next(new UnauthorizedError('Invalid session'))
      return
    }

    req.user = activeSession
    next()
  } catch (err) {
    next(err)
  }
}
