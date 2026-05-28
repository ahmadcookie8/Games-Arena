import { z } from 'zod'

export const signupSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().trim().toLowerCase().optional().or(z.literal('')),
  password: z.string().min(8).max(128),
})

export const loginSchema = z.object({
  identifier: z.string().min(1).trim().toLowerCase(),
  password: z.string().min(1).max(128),
})

export const createGameSchema = z.object({
  gameType: z.enum(['chess', 'checkers', 'ticTacToe', 'uno', 'president', 'wisecracker']),
  opponentUserId: z.string().optional(),
})

export const createSinglePlayerGameSchema = z.object({
  gameType: z.literal('ticTacToe'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
})

export const joinGameSchema = z.object({
  gameCode: z.string().length(6),
})

export const makeMoveSchema = z.object({
  gameId: z.string(),
  move: z.string(),
})

export const singlePlayerMoveSchema = z.object({
  move: z.string(),
})
