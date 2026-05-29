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
  gameType: z.enum(['chess', 'checkers', 'ticTacToe', 'uno', 'president', 'wisecracker', 'scrabble']),
  opponentUserId: z.string().optional(),
})

export const snakeCellSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
})

export const snakeStateSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  snake: z.array(snakeCellSchema).min(1),
  direction: z.enum(['up', 'down', 'left', 'right']),
  pendingDirection: z.enum(['up', 'down', 'left', 'right']),
  food: snakeCellSchema,
  score: z.number().int().nonnegative(),
  isGameOver: z.boolean(),
  hasStarted: z.boolean().optional(),
  tickMs: z.number().int().positive(),
})

export const createSinglePlayerGameSchema = z.discriminatedUnion('gameType', [
  z.object({
    gameType: z.literal('ticTacToe'),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  }),
  z.object({
    gameType: z.literal('snake'),
    boardSize: z.enum(['small', 'medium', 'large']).optional(),
    wallLooping: z.boolean().optional(),
  }),
])

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

export const snakeStateCheckpointSchema = z.object({
  gameState: snakeStateSchema,
  completed: z.boolean().optional(),
})

export const singlePlayerSettingsSchema = z.union([
  z.object({
    difficulty: z.enum(['easy', 'medium', 'hard']),
  }),
  z.object({
    boardSize: z.enum(['small', 'medium', 'large']),
    wallLooping: z.boolean(),
  }),
])

export const gameSettingsSchema = z.object({
  infiniteLetters: z.boolean().optional(),
})
