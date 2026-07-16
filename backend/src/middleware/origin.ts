import { Request, Response, NextFunction } from 'express'
import { config } from '../config'
import { ForbiddenError } from '../utils/errors'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isAllowedRequestOrigin(origin: string | undefined): boolean {
  return origin === config.corsOrigin
}

/**
 * Cookie-authenticated state changes must come from the one configured browser
 * origin. Requiring Origin (instead of merely checking it when present) keeps
 * non-browser and downgraded cross-site requests from bypassing CSRF controls.
 */
export function originMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next()
    return
  }

  if (!isAllowedRequestOrigin(req.get('origin'))) {
    next(new ForbiddenError('Request origin is not allowed'))
    return
  }

  next()
}
