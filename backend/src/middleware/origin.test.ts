import { NextFunction, Request, Response } from 'express'
import { config } from '../config'
import { ForbiddenError } from '../utils/errors'
import { originMiddleware } from './origin'

function request(method: string, origin?: string): Request {
  return {
    method,
    get: jest.fn((name: string) => name.toLowerCase() === 'origin' ? origin : undefined),
  } as unknown as Request
}

describe('originMiddleware', () => {
  const response = {} as Response

  it('allows safe requests without an Origin header', () => {
    const next = jest.fn() as NextFunction
    originMiddleware(request('GET'), response, next)
    expect(next).toHaveBeenCalledWith()
  })

  it('allows unsafe requests only from the exact configured origin', () => {
    const allowedNext = jest.fn() as NextFunction
    originMiddleware(request('POST', config.corsOrigin), response, allowedNext)
    expect(allowedNext).toHaveBeenCalledWith()

    for (const hostileOrigin of [undefined, 'null', `${config.corsOrigin}.attacker.example`, `${config.corsOrigin}/`]) {
      const deniedNext = jest.fn() as NextFunction
      originMiddleware(request('DELETE', hostileOrigin), response, deniedNext)
      expect(deniedNext.mock.calls[0][0]).toBeInstanceOf(ForbiddenError)
    }
  })
})
