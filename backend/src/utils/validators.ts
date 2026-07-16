import { z } from 'zod'
import { GAME_ENGINE_VERSION, MAX_REPLAY_INPUTS, MAX_REPLAY_TICKS } from '@games-arena/game-engine'

export const gameIdSchema = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid game id')

export const signupSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().trim().toLowerCase().optional().or(z.literal('')),
  password: z.string().min(8).max(128),
})

export const loginSchema = z.object({
  identifier: z.string().min(1).max(254).trim().toLowerCase(),
  password: z.string().min(1).max(128),
})

export const createGameSchema = z.object({
  // Recognize legacy catalog values so the service can return the stable
  // GAME_TYPE_UNAVAILABLE code while still rejecting arbitrary strings.
  gameType: z.enum(['chess', 'checkers', 'ticTacToe', 'uno', 'president', 'wisecracker', 'scrabble', 'propertyManagement']),
}).strict()

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
  tick: z.number().int().safe().nonnegative().optional(),
})

export const mazeChasePointSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
})

export const mazeChaseDirectionSchema = z.enum(['up', 'down', 'left', 'right', 'none'])

export const mazeChaseStateSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  maze: z.array(z.string()).min(1),
  player: z.object({
    position: mazeChasePointSchema,
    start: mazeChasePointSchema,
    direction: mazeChaseDirectionSchema,
    pendingDirection: mazeChaseDirectionSchema,
  }),
  ghosts: z.array(z.object({
    id: z.string().min(1),
    color: z.string().min(1),
    position: mazeChasePointSchema,
    start: mazeChasePointSchema,
    direction: mazeChaseDirectionSchema,
    mode: z.enum(['chase', 'frightened', 'returning', 'hidden']),
    respawnAt: z.number().int().nonnegative().optional(),
  })).length(4),
  pellets: z.array(mazeChasePointSchema),
  powerPellets: z.array(mazeChasePointSchema),
  fruit: z.object({
    position: mazeChasePointSchema,
    active: z.boolean(),
    collected: z.boolean(),
  }).nullable(),
  score: z.number().int().nonnegative(),
  lives: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  frightenedUntil: z.number().int().nonnegative(),
  isGameOver: z.boolean(),
  hasStarted: z.boolean().optional(),
  tickMs: z.number().int().positive(),
  ghostStepCounter: z.number().int().nonnegative().optional(),
  tick: z.number().int().safe().nonnegative().optional(),
  elapsedMs: z.number().int().safe().nonnegative().optional(),
})

export const createSinglePlayerGameSchema = z.discriminatedUnion('gameType', [
  z.object({
    gameType: z.literal('ticTacToe'),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  }).strict(),
  z.object({
    gameType: z.literal('snake'),
    boardSize: z.enum(['small', 'medium', 'large']).optional(),
    wallLooping: z.boolean().optional(),
  }).strict(),
  z.object({
    gameType: z.literal('mazeChase'),
  }).strict(),
])

export const joinGameSchema = z.object({
  gameCode: z.string().trim().toUpperCase().regex(/^(?:[A-Z0-9]{6}|[A-Z0-9]{8})$/, 'Game code must be 6 or 8 letters and numbers'),
}).strict()

const userIdSchema = gameIdSchema
const ticTacToeMoveSchema = z.enum(['0', '1', '2', '3', '4', '5', '6', '7', '8'])

// Scrabble racks created before UUID tile IDs used `<letter>-<timestamp>-<random>`,
// including `?` as the letter for blank tiles. Keep that exact legacy shape
// available for active games while requiring UUIDs for newly generated IDs.
const scrabbleTileIdSchema = z.union([
  z.string().uuid(),
  z.string().min(17).max(128).regex(/^[A-Z?]-\d{13}-[a-z0-9]+$/),
])
const scrabbleOfferIdSchema = z.union([
  z.string().uuid(),
  z.string().min(15).max(128).regex(/^\d{13}-[a-z0-9]+$/),
])

const wisecrackerActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('startMatch'), maxScore: z.number().int().min(1).max(50).optional() }).strict(),
  z.object({ type: z.literal('refreshPrompt') }).strict(),
  z.object({ type: z.literal('setPrompt'), prompt: z.string().trim().min(1).max(240) }).strict(),
  z.object({ type: z.literal('submitAnswers'), answers: z.array(z.string().trim().min(1).max(160)).min(1).max(10) }).strict(),
  z.object({ type: z.literal('revealNextAnswer') }).strict(),
  z.object({ type: z.literal('selectRoundWinner'), responseId: z.string().regex(/^[a-f0-9]{32}$/) }).strict(),
  z.object({ type: z.literal('startNextRound') }).strict(),
])

const scrabblePlacementSchema = z.object({
  rackTileId: scrabbleTileIdSchema,
  row: z.number().int().min(0).max(14),
  col: z.number().int().min(0).max(14),
  blankLetter: z.string().length(1).regex(/^[A-Za-z]$/).transform((letter) => letter.toUpperCase()).optional(),
}).strict()

const scrabbleActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('placeTiles'), placements: z.array(scrabblePlacementSchema).min(1).max(7) }).strict(),
  z.object({ type: z.literal('exchangeWithBag'), rackTileIds: z.array(scrabbleTileIdSchema).min(1).max(7) }).strict(),
  z.object({ type: z.literal('offerTrade'), targetUserId: userIdSchema, rackTileIds: z.array(scrabbleTileIdSchema).min(1).max(7) }).strict(),
  z.object({ type: z.literal('respondTrade'), offerId: scrabbleOfferIdSchema.optional(), accept: z.boolean(), rackTileIds: z.array(scrabbleTileIdSchema).max(7).optional() }).strict(),
  z.object({ type: z.literal('cancelTrade'), offerId: scrabbleOfferIdSchema.optional() }).strict(),
  z.object({ type: z.literal('pass') }).strict(),
  z.object({ type: z.literal('giveUp') }).strict(),
])

const propertySquareIndexSchema = z.number().int().min(0).max(39)
const propertyManagementActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('startGame') }).strict(),
  z.object({ type: z.literal('rollDice') }).strict(),
  z.object({ type: z.literal('buyProperty') }).strict(),
  z.object({ type: z.literal('declineProperty') }).strict(),
  z.object({ type: z.literal('auctionBid'), amount: z.number().int().safe().positive() }).strict(),
  z.object({ type: z.literal('auctionPass') }).strict(),
  z.object({ type: z.literal('payJailFine') }).strict(),
  z.object({ type: z.literal('useGetOutOfJailCard') }).strict(),
  z.object({ type: z.literal('buildHouse'), squareIndex: propertySquareIndexSchema }).strict(),
  z.object({ type: z.literal('sellHouse'), squareIndex: propertySquareIndexSchema }).strict(),
  z.object({ type: z.literal('mortgageProperty'), squareIndex: propertySquareIndexSchema }).strict(),
  z.object({ type: z.literal('unmortgageProperty'), squareIndex: propertySquareIndexSchema }).strict(),
  z.object({ type: z.literal('declareBankruptcy') }).strict(),
  z.object({ type: z.literal('endTurn') }).strict(),
  z.object({ type: z.literal('acknowledgeCard') }).strict(),
])

export const multiplayerMoveSchema = z.union([
  ticTacToeMoveSchema,
  wisecrackerActionSchema,
  scrabbleActionSchema,
  propertyManagementActionSchema,
])

export const joinRoomEventSchema = z.object({ gameId: gameIdSchema }).strict()
export const makeMoveEventSchema = z.object({ gameId: gameIdSchema, move: multiplayerMoveSchema }).strict()
export const sendChatMessageEventSchema = z.object({
  gameId: gameIdSchema,
  text: z.string().trim().min(1).max(500),
}).strict()

export const singlePlayerMoveSchema = z.object({
  move: ticTacToeMoveSchema,
}).strict()

export const snakeStateCheckpointSchema = z.object({
  gameState: snakeStateSchema,
  completed: z.boolean().optional(),
}).strict()

export const mazeChaseStateCheckpointSchema = z.object({
  gameState: mazeChaseStateSchema,
  completed: z.boolean().optional(),
}).strict()

const replayInputSchema = z.object({
  tick: z.number().int().safe().min(0).max(MAX_REPLAY_TICKS - 1),
  direction: z.enum(['up', 'down', 'left', 'right']),
}).strict()

export const singlePlayerReplaySchema = z.object({
  version: z.literal(GAME_ENGINE_VERSION),
  tickCount: z.number().int().safe().min(1).max(MAX_REPLAY_TICKS),
  inputs: z.array(replayInputSchema).max(MAX_REPLAY_INPUTS),
}).strict().superRefine((replay, context) => {
  let previousTick = -1
  replay.inputs.forEach((input, index) => {
    if (input.tick >= replay.tickCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Replay input tick must be less than tickCount',
        path: ['inputs', index, 'tick'],
      })
    }
    if (input.tick <= previousTick) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Replay input ticks must be unique and strictly increasing',
        path: ['inputs', index, 'tick'],
      })
    }
    previousTick = input.tick
  })
})

export const singlePlayerSettingsSchema = z.union([
  z.object({
    difficulty: z.enum(['easy', 'medium', 'hard']),
  }).strict(),
  z.object({
    boardSize: z.enum(['small', 'medium', 'large']),
    wallLooping: z.boolean(),
  }).strict(),
])

export const gameSettingsSchema = z.object({
  infiniteLetters: z.boolean().optional(),
}).strict()
