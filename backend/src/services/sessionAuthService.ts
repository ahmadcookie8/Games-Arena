import { User } from '../models/User'
import { VerifiedAuthPayload, verifyAuthToken } from '../utils/authToken'

interface SessionUser {
  _id: unknown
  username: string
  authVersion?: number
}

/**
 * Verifies both the signed token and its current server-side account state.
 * A null result means the account was removed, disabled, or its sessions were
 * revoked. Signature/claim errors are deliberately allowed to throw so callers
 * can handle them as invalid credentials without masking database failures.
 */
export async function authenticateSessionToken(token: string): Promise<VerifiedAuthPayload | null> {
  const payload = verifyAuthToken(token)
  return authenticateSessionPayload(payload)
}

export async function authenticateSessionPayload(payload: VerifiedAuthPayload): Promise<VerifiedAuthPayload | null> {
  const user = await User.findOne({ _id: payload.userId, isActive: true })
    .select('_id username authVersion')
    .lean<SessionUser>()

  if (!user || (user.authVersion ?? 0) !== payload.authVersion) return null

  return {
    ...payload,
    userId: String(user._id),
    username: user.username,
  }
}
