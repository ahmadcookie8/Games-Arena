import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import { User } from '../models/User'
import { signupSchema, loginSchema } from '../utils/validators'
import { BadRequestError } from '../utils/errors'
import { AuthRequest } from '../middleware/auth'
import { clearAuthCookie, setAuthCookie, signAuthToken } from '../utils/authToken'

const BCRYPT_SALT_ROUNDS = 12
const INVALID_LOGIN_MESSAGE = 'Invalid username/email or password'

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, email, password } = signupSchema.parse(req.body)
    const normalizedUsername = username.toLowerCase()
    const normalizedEmail = email || undefined

    const existing = await User.findOne({ username: normalizedUsername })
    if (existing) throw new BadRequestError('Username already taken')

    if (normalizedEmail) {
      const existingEmail = await User.findOne({ email: normalizedEmail })
      if (existingEmail) throw new BadRequestError('Email already taken')
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
    })
    const token = signAuthToken({ userId: String(user._id), username: user.username })
    setAuthCookie(res, token)

    res.status(201).json({
      token,
      user: { _id: user._id, username: user.username, email: user.email, createdAt: user.createdAt, stats: user.stats },
    })
  } catch (err) {
    next(err)
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, password } = loginSchema.parse(req.body)

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    }).select('+passwordHash')

    if (!user) throw new BadRequestError(INVALID_LOGIN_MESSAGE)
    if (!user.passwordHash) throw new BadRequestError(INVALID_LOGIN_MESSAGE)

    const passwordMatches = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatches) throw new BadRequestError(INVALID_LOGIN_MESSAGE)

    await User.findByIdAndUpdate(user._id, { lastSeenAt: new Date() })

    const token = signAuthToken({ userId: String(user._id), username: user.username })
    setAuthCookie(res, token)

    res.json({ token, user: { _id: user._id, username: user.username, email: user.email, stats: user.stats } })
  } catch (err) {
    next(err)
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.user?.userId).select('-passwordHash')
    res.json({ user })
  } catch (err) {
    next(err)
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    clearAuthCookie(res)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
