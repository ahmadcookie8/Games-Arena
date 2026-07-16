import { BadRequestError } from '../utils/errors'
import { randomBytes } from 'crypto'

export type WisecrackerPhase = 'lobby' | 'prompt' | 'answering' | 'revealing' | 'roundResult' | 'completed'

export type WisecrackerAction =
  | { type: 'startMatch'; maxScore?: number }
  | { type: 'refreshPrompt' }
  | { type: 'setPrompt'; prompt: string }
  | { type: 'submitAnswers'; answers: string[] }
  | { type: 'revealNextAnswer' }
  | { type: 'selectRoundWinner'; responseId: string }
  | { type: 'startNextRound' }

export interface WisecrackerPlayerView {
  userId: string
  username: string
}

export interface WisecrackerState {
  phase: WisecrackerPhase
  hostUserId: string
  maxScore: number
  chooserUserId: string | null
  chooserIndex: number
  activePlayerIds: string[]
  waitingPlayerIds: string[]
  prompt: string
  answerSlots: number
  submittedAnswers: Record<string, string[]>
  responseIds: Record<string, string>
  answerOrder: string[]
  revealedCount: number
  scores: Record<string, number>
  roundWinnerUserId: string | null
  matchWinnerUserId: string | null
}

const DEFAULT_MAX_SCORE = 3
const MIN_PLAYERS = 3
const MAX_ANSWER_SLOTS = 10

export const WISECRACKER_PROMPTS = [
  'TSA guidelines now prohibit ________ on airplanes.',
  "It's a pity that kids these days are all getting involved with ________.",
  'In 1,000 years, when paper money is but a distant memory, ________ will be our currency.',
  'Major League Baseball has banned ________ for giving players an unfair advantage.',
  "What is Batman's guilty pleasure?",
  'Next from J.K. Rowling: Harry Potter and the Chamber of ________.',
  "I'm sorry, Professor, but I couldn't complete my homework because of ________.",
  'What did I bring back from Mexico?',
  "________? There's an app for that.",
  '________. Betcha cannot have just one!',
  "What's my anti-drug?",
  "What's my secret power?",
  "What's the new fad diet?",
  'What did Vin Diesel eat for dinner?',
  'When Pharaoh remained unmoved, Moses called down a Plague of ________.',
  'How am I maintaining my relationship status?',
  "What's the crustiest?",
  'Instead of coal, Santa now gives the bad children ________.',
  "What's Teach for America using to inspire inner city students to succeed?",
  "Maybe she's born with it. Maybe it's ________.",
  'White people like ________.',
  'Why do I hurt all over?',
  'A romantic candlelit dinner would be incomplete without ________.',
  'What will I bring back in time to convince people that I am a powerful wizard?',
  'BILLY MAYS HERE FOR ________.',
  'The class field trip was completely ruined by ________.',
  "What's a girl's best friend?",
  'When I am President, I will create the Department of ________.',
  'What are my parents hiding from me?',
  'What never fails to liven up the party?',
  'What gets better with age?',
  '________: good to the last drop.',
  "I got 99 problems but ________ ain't one.",
  "It's a trap!",
  'MTV features eight washed-up celebrities living with ________.',
  'What would grandma find disturbing, yet oddly charming?',
  "What's the most emo?",
  'What ended my last relationship?',
  "What's that sound?",
  "________. That's how I want to die.",
  'Why am I sticky?',
  "What's the next Happy Meal toy?",
  "What's there a ton of in heaven?",
  'Coming to Broadway this season, ________: The Musical.',
  'Anthropologists have discovered a tribe that worships ________.',
  'But before I kill you, Mr. Bond, I must show you ________.',
  'Studies show lab rats navigate mazes faster after exposure to ________.',
  'Next on ESPN2: The World Series of ________.',
  'When I am a billionaire, I shall erect a statue to commemorate ________.',
  'War! What is it good for?',
  'What gives me uncontrollable gas?',
  'What do old people smell like?',
  'What am I giving up for Lent?',
  'Alternative medicine is embracing the curative powers of ________.',
  'What did the U.S. airdrop to the children of Afghanistan?',
  'What does Dick Cheney prefer?',
  "What don't you want to find in your Chinese food?",
  'I drink to forget ________.',
  '________. High five, bro.',
  'He who controls ________ controls the world.',
  'Science will never explain the origin of ________.',
  'I learned the hard way that you cannot cheer up a grieving friend with ________.',
  "What's the gift that keeps on giving?",
  'When I pooped, what came out?',
  "And I would have gotten away with it, too, if it hadn't been for ________.",
  'What brought the party to a grinding halt?',
  "That's right, I killed ________. How, you ask? ________.",
  'And the Academy Award for ________ goes to ________.',
  'For my next trick, I will pull ________ out of ________.',
  'In his new summer comedy, Rob Schneider is ________ trapped in the body of ________.',
  'When I was tripping, ________ turned into ________.',
  '________ is a slippery slope that leads to ________.',
  'In a world ravaged by ________, our only solace is ________.',
  'I never truly understood ________ until I encountered ________.',
  "What's the next superhero and sidekick duo?",
]

export class Wisecracker {
  static createInitialState(hostUserId: string): WisecrackerState {
    return {
      phase: 'lobby',
      hostUserId,
      maxScore: DEFAULT_MAX_SCORE,
      chooserUserId: null,
      chooserIndex: 0,
      activePlayerIds: [hostUserId],
      waitingPlayerIds: [],
      prompt: '',
      answerSlots: 0,
      submittedAnswers: {},
      responseIds: {},
      answerOrder: [],
      revealedCount: 0,
      scores: { [hostUserId]: 0 },
      roundWinnerUserId: null,
      matchWinnerUserId: null,
    }
  }

  static getRandomPrompt(): string {
    return WISECRACKER_PROMPTS[Math.floor(Math.random() * WISECRACKER_PROMPTS.length)]
  }

  static addPlayer(state: WisecrackerState, userId: string): WisecrackerState {
    const next = clone(state)
    normalizeCollections(next)
    next.scores[userId] = next.scores[userId] ?? 0
    if (next.activePlayerIds.includes(userId) || next.waitingPlayerIds.includes(userId)) return next
    if (next.phase === 'lobby' || next.phase === 'completed') {
      next.activePlayerIds.push(userId)
    } else {
      next.waitingPlayerIds.push(userId)
    }
    return next
  }

  static applyAction(state: WisecrackerState, action: WisecrackerAction, userId: string, players: WisecrackerPlayerView[]): WisecrackerState {
    const next = clone(state)
    normalize(next, players)

    switch (action.type) {
      case 'startMatch':
        ensureHost(next, userId)
        if (next.phase !== 'lobby' && next.phase !== 'completed') throw new BadRequestError('Wisecracker match is already in progress')
        next.maxScore = clampMaxScore(action.maxScore ?? next.maxScore)
        next.scores = Object.fromEntries(next.activePlayerIds.map((id) => [id, 0]))
        next.matchWinnerUserId = null
        next.chooserIndex = Math.min(next.chooserIndex, Math.max(next.activePlayerIds.length - 1, 0))
        startPromptPhase(next)
        return next

      case 'refreshPrompt':
        ensureChooser(next, userId)
        if (next.phase !== 'prompt') throw new BadRequestError('It is not time to refresh the prompt')
        next.prompt = Wisecracker.getRandomPrompt()
        next.answerSlots = 0
        return next

      case 'setPrompt':
        ensureChooser(next, userId)
        if (next.phase !== 'prompt') throw new BadRequestError('It is not time to set a prompt')
        next.prompt = cleanPrompt(action.prompt)
        if (!next.prompt) throw new BadRequestError('Prompt cannot be blank')
        next.answerSlots = countAnswerSlots(next.prompt)
        if (next.answerSlots > MAX_ANSWER_SLOTS) {
          throw new BadRequestError(`Prompts cannot contain more than ${MAX_ANSWER_SLOTS} answer slots`)
        }
        next.submittedAnswers = {}
        next.responseIds = {}
        next.answerOrder = []
        next.revealedCount = 0
        next.roundWinnerUserId = null
        next.phase = 'answering'
        return next

      case 'submitAnswers':
        if (next.phase !== 'answering') throw new BadRequestError('It is not time to submit answers')
        if (!next.activePlayerIds.includes(userId)) throw new BadRequestError('You are not active in this round')
        if (userId === next.chooserUserId) throw new BadRequestError('The chooser does not submit an answer')
        if (next.submittedAnswers[userId]) throw new BadRequestError('You have already submitted')
        if (!Array.isArray(action.answers) || action.answers.length !== next.answerSlots) throw new BadRequestError(`Submit ${next.answerSlots} answer${next.answerSlots === 1 ? '' : 's'}`)
        next.submittedAnswers[userId] = action.answers.map((answer) => answer.trim())
        if (next.submittedAnswers[userId].some((answer) => !answer)) throw new BadRequestError('Answers cannot be blank')
        if (next.submittedAnswers[userId].some((answer) => answer.length > 160)) throw new BadRequestError('Answers must be 160 characters or fewer')
        next.responseIds[userId] = createResponseId()
        if (getTypers(next).every((id) => next.submittedAnswers[id])) {
          next.answerOrder = shuffle(getTypers(next))
          next.revealedCount = 0
          next.phase = 'revealing'
        }
        return next

      case 'revealNextAnswer':
        ensureChooser(next, userId)
        if (next.phase !== 'revealing') throw new BadRequestError('It is not time to reveal answers')
        if (next.revealedCount < next.answerOrder.length) next.revealedCount += 1
        return next

      case 'selectRoundWinner': {
        ensureChooser(next, userId)
        if (next.phase !== 'revealing') throw new BadRequestError('It is not time to choose a winner')
        if (next.revealedCount < next.answerOrder.length) throw new BadRequestError('Reveal all answers before choosing a winner')
        const winningUserId = Object.entries(next.responseIds).find(([, responseId]) => responseId === action.responseId)?.[0]
        if (!winningUserId || !next.answerOrder.includes(winningUserId)) throw new BadRequestError('Winner must be one of this round\'s responses')
        next.roundWinnerUserId = winningUserId
        next.scores[winningUserId] = (next.scores[winningUserId] ?? 0) + 1
        if (next.scores[winningUserId] >= next.maxScore) {
          next.matchWinnerUserId = winningUserId
          next.phase = 'completed'
        } else {
          next.phase = 'roundResult'
        }
        return next
      }

      case 'startNextRound':
        ensureHost(next, userId)
        if (next.phase !== 'roundResult') throw new BadRequestError('The current round is not finished')
        next.activePlayerIds = [...next.activePlayerIds, ...next.waitingPlayerIds]
        next.waitingPlayerIds = []
        normalize(next, players)
        startPromptPhase(next)
        return next

    }
  }

  static getMoveDescription(action: WisecrackerAction): string {
    switch (action.type) {
      case 'startMatch': return 'started the match'
      case 'refreshPrompt': return 'refreshed the prompt'
      case 'setPrompt': return 'set the prompt'
      case 'submitAnswers': return 'submitted answers'
      case 'revealNextAnswer': return 'revealed an answer'
      case 'selectRoundWinner': return 'selected the round winner'
      case 'startNextRound': return 'started the next round'
    }
  }
}

function clone(state: WisecrackerState): WisecrackerState {
  return JSON.parse(JSON.stringify(state))
}

function cleanPrompt(prompt: string): string {
  const cleaned = prompt.trim().replace(/_{2,}/g, '_')
  if (cleaned.length > 240) throw new BadRequestError('Prompt must be 240 characters or fewer')
  return cleaned
}

function createResponseId(): string {
  return randomBytes(16).toString('hex')
}

function countAnswerSlots(prompt: string): number {
  return Math.max(prompt.split('').filter((char) => char === '_').length, 1)
}

function clampMaxScore(maxScore: number): number {
  if (!Number.isFinite(maxScore)) return DEFAULT_MAX_SCORE
  return Math.min(Math.max(Math.floor(maxScore), 1), 50)
}

function getTypers(state: WisecrackerState): string[] {
  return state.activePlayerIds.filter((id) => id !== state.chooserUserId)
}

function normalize(state: WisecrackerState, players: WisecrackerPlayerView[]): void {
  normalizeCollections(state)
  const playerIds = players.map((player) => player.userId)
  state.activePlayerIds = state.activePlayerIds.filter((id) => playerIds.includes(id))
  state.waitingPlayerIds = state.waitingPlayerIds.filter((id) => playerIds.includes(id) && !state.activePlayerIds.includes(id))
  for (const id of playerIds) state.scores[id] = state.scores[id] ?? 0
  if (!state.hostUserId || !playerIds.includes(state.hostUserId)) state.hostUserId = playerIds[0]
}

function normalizeCollections(state: WisecrackerState): void {
  if (!Array.isArray(state.activePlayerIds)) state.activePlayerIds = state.hostUserId ? [state.hostUserId] : []
  if (!Array.isArray(state.waitingPlayerIds)) state.waitingPlayerIds = []
  if (!Array.isArray(state.answerOrder)) state.answerOrder = []
  if (!state.submittedAnswers || typeof state.submittedAnswers !== 'object' || Array.isArray(state.submittedAnswers)) state.submittedAnswers = {}
  if (!state.responseIds || typeof state.responseIds !== 'object' || Array.isArray(state.responseIds)) state.responseIds = {}
  for (const userId of Object.keys(state.submittedAnswers)) {
    if (!/^[a-f0-9]{32}$/.test(state.responseIds[userId] || '')) state.responseIds[userId] = createResponseId()
  }
  if (!state.scores || typeof state.scores !== 'object' || Array.isArray(state.scores)) state.scores = {}
  if (!Number.isFinite(state.revealedCount)) state.revealedCount = 0
  if (!Number.isFinite(state.answerSlots)) state.answerSlots = 0
  if (!Number.isFinite(state.chooserIndex)) state.chooserIndex = 0
}

function ensureHost(state: WisecrackerState, userId: string): void {
  if (state.hostUserId !== userId) throw new BadRequestError('Only the host can do that')
}

function ensureChooser(state: WisecrackerState, userId: string): void {
  if (state.chooserUserId !== userId) throw new BadRequestError('Only the chooser can do that')
}

function startPromptPhase(state: WisecrackerState): void {
  if (state.activePlayerIds.length < MIN_PLAYERS) throw new BadRequestError('Wisecracker needs at least 3 players')
  state.chooserIndex = state.chooserIndex % state.activePlayerIds.length
  state.chooserUserId = state.activePlayerIds[state.chooserIndex]
  state.chooserIndex = (state.chooserIndex + 1) % state.activePlayerIds.length
  state.prompt = Wisecracker.getRandomPrompt()
  state.answerSlots = 0
  state.submittedAnswers = {}
  state.responseIds = {}
  state.answerOrder = []
  state.revealedCount = 0
  state.roundWinnerUserId = null
  state.phase = 'prompt'
}

function shuffle(items: string[]): string[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = next[i]
    next[i] = next[j]
    next[j] = temp
  }
  return next
}
