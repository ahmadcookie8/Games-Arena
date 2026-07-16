import { NextFunction, Request, Response } from 'express'

/** Prevents personalized cookie-authenticated DTOs from entering shared caches. */
export function privateNoStore(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.vary('Cookie')
  next()
}
