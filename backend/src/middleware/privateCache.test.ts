import { NextFunction, Request, Response } from 'express'
import { privateNoStore } from './privateCache'

describe('private response cache policy', () => {
  it('prevents shared caching and varies personalized responses by cookie', () => {
    const res = { setHeader: jest.fn(), vary: jest.fn() } as unknown as Response
    const next = jest.fn() as NextFunction

    privateNoStore({} as Request, res, next)

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store, max-age=0')
    expect(res.vary).toHaveBeenCalledWith('Cookie')
    expect(next).toHaveBeenCalledTimes(1)
  })
})
