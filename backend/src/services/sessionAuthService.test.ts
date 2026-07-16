jest.mock('../models/User', () => ({
  User: { findOne: jest.fn() },
}))

import { User } from '../models/User'
import { signAuthToken } from '../utils/authToken'
import { authenticateSessionToken } from './sessionAuthService'

const USER_ID = '507f1f77bcf86cd799439011'
const findOne = User.findOne as jest.Mock

function mockSessionUser(user: unknown): void {
  const lean = jest.fn().mockResolvedValue(user)
  const select = jest.fn().mockReturnValue({ lean })
  findOne.mockReturnValue({ select })
}

describe('authenticateSessionToken', () => {
  beforeEach(() => jest.clearAllMocks())

  it('accepts only an active user whose authVersion still matches', async () => {
    const token = signAuthToken({ userId: USER_ID, username: 'old-name', authVersion: 2 })
    mockSessionUser({ _id: USER_ID, username: 'alice', authVersion: 2 })

    await expect(authenticateSessionToken(token)).resolves.toEqual(expect.objectContaining({
      userId: USER_ID,
      username: 'alice',
      authVersion: 2,
    }))
    expect(findOne).toHaveBeenCalledWith({ _id: USER_ID, isActive: true })
  })

  it('rejects a revoked session version', async () => {
    const token = signAuthToken({ userId: USER_ID, username: 'alice', authVersion: 1 })
    mockSessionUser({ _id: USER_ID, username: 'alice', authVersion: 2 })
    await expect(authenticateSessionToken(token)).resolves.toBeNull()
  })

  it('supports an unmigrated account as authVersion zero', async () => {
    const token = signAuthToken({ userId: USER_ID, username: 'alice', authVersion: 0 })
    mockSessionUser({ _id: USER_ID, username: 'alice' })
    await expect(authenticateSessionToken(token)).resolves.toEqual(expect.objectContaining({ authVersion: 0 }))
  })
})
