import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import { User } from '../models/User'
import { signupSchema, loginSchema } from '../utils/validators'
import { BadRequestError, UnauthorizedError } from '../utils/errors'
import { AuthRequest } from '../middleware/auth'
import { clearAuthCookie, setAuthCookie, signAuthToken } from '../utils/authToken'
import { disconnectUserSockets } from '../services/socketNotifier'

const BCRYPT_SALT_ROUNDS = 12
const INVALID_LOGIN_MESSAGE = 'Invalid username/email or password'
const UNAVAILABLE_SIGNUP_MESSAGE = 'An account cannot be created with those details'
// Comparing against a real cost-12 hash for unknown accounts keeps the generic
// login response from becoming a practical username-enumeration timing oracle.
const INVALID_PASSWORD_HASH = '$2b$12$PFvpeM6xjuM03AHAmG6wo.h5Nw7C1N16ngj13lQIiCySgdLwCn/4G'

interface PrivateUserShape {
  _id: unknown
  username: string
  email?: string
  createdAt?: Date
  updatedAt?: Date
  stats: unknown
  preferences?: unknown
}

function presentPrivateUser(user: PrivateUserShape) {
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    stats: user.stats,
    preferences: user.preferences,
  }
}

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, email, password } = signupSchema.parse(req.body)
    const normalizedUsername = username.toLowerCase()
    const normalizedEmail = email || undefined

    const identities: Array<Record<string, string>> = [{ username: normalizedUsername }]
    if (normalizedEmail) identities.push({ email: normalizedEmail })
    const existing = await User.findOne({ $or: identities }).select('_id').lean()
    if (existing) throw new BadRequestError(UNAVAILABLE_SIGNUP_MESSAGE)

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
    })
    const token = signAuthToken({ userId: String(user._id), username: user.username, authVersion: user.authVersion })
    setAuthCookie(res, token)

    res.status(201).json({ user: presentPrivateUser(user) })
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      next(new BadRequestError(UNAVAILABLE_SIGNUP_MESSAGE))
      return
    }
    next(err)
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 11000)
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, password } = loginSchema.parse(req.body)

    const user = await User.findOne({
      isActive: true,
      $or: [{ username: identifier }, { email: identifier }],
    }).select('+passwordHash')

    const passwordMatches = await bcrypt.compare(password, user?.passwordHash || INVALID_PASSWORD_HASH)
    if (!user || !user.passwordHash || !passwordMatches) throw new UnauthorizedError(INVALID_LOGIN_MESSAGE)

    await User.findByIdAndUpdate(user._id, { lastSeenAt: new Date() })

    const token = signAuthToken({ userId: String(user._id), username: user.username, authVersion: user.authVersion })
    setAuthCookie(res, token)

    res.json({ user: presentPrivateUser(user) })
  } catch (err) {
    next(err)
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId)
      .select('_id username email createdAt updatedAt stats preferences')
      .lean<PrivateUserShape>()
    if (!user) throw new UnauthorizedError('Invalid session')

    res.json({ user: presentPrivateUser(user) })
  } catch (err) {
    next(err)
  }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authVersion = req.user!.authVersion
    const versionFilter = authVersion === 0
      ? { $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] }
      : { authVersion }

    await User.findOneAndUpdate(
      { _id: req.user!.userId, isActive: true, ...versionFilter },
      { $inc: { authVersion: 1 }, $set: { lastSeenAt: new Date() } }
    )
    disconnectUserSockets(req.user!.userId)
    clearAuthCookie(res)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
