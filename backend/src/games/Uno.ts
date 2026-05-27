import { GameBase } from './GameBase'
import { Player, ValidationResult, GameOverResult } from '../types/game'

interface UnoCard {
  color: 'red' | 'green' | 'blue' | 'yellow' | 'wild'
  value: string
  type: 'NUMBER' | 'SKIP' | 'REVERSE' | 'DRAW2' | 'WILD' | 'WILD_DRAW4'
}

interface UnoState {
  deck: UnoCard[]
  discardPile: UnoCard[]
  hands: UnoCard[][]
  currentTurnIndex: number
  direction: 1 | -1
  currentColor: string
  unoStatus: boolean[]
}

export class Uno extends GameBase {
  protected gameType = 'uno'

  constructor(players: Player[]) {
    super(players, Uno.createInitialState(players.length))
  }

  static createInitialState(playerCount: number): UnoState {
    const deck = Uno.buildDeck()
    Uno.shuffle(deck)

    const hands: UnoCard[][] = []
    for (let i = 0; i < playerCount; i++) {
      hands.push(deck.splice(0, 7))
    }

    return {
      deck,
      discardPile: [deck.pop()!],
      hands,
      currentTurnIndex: 0,
      direction: 1,
      currentColor: '',
      unoStatus: Array(playerCount).fill(false),
    }
  }

  private static buildDeck(): UnoCard[] {
    const colors: Array<'red' | 'green' | 'blue' | 'yellow'> = ['red', 'green', 'blue', 'yellow']
    const deck: UnoCard[] = []

    for (const color of colors) {
      deck.push({ color, value: '0', type: 'NUMBER' })
      for (let v = 1; v <= 9; v++) {
        deck.push({ color, value: String(v), type: 'NUMBER' })
        deck.push({ color, value: String(v), type: 'NUMBER' })
      }
      for (const special of ['SKIP', 'REVERSE', 'DRAW2'] as const) {
        deck.push({ color, value: special, type: special })
        deck.push({ color, value: special, type: special })
      }
    }

    for (let i = 0; i < 4; i++) {
      deck.push({ color: 'wild', value: 'WILD', type: 'WILD' })
      deck.push({ color: 'wild', value: 'WILD_DRAW4', type: 'WILD_DRAW4' })
    }

    return deck
  }

  private static shuffle(arr: unknown[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
  }

  validateMove(gameState: unknown, move: string): ValidationResult {
    const state = gameState as UnoState
    const moveObj = JSON.parse(move)
    const hand = state.hands[state.currentTurnIndex]
    const topCard = state.discardPile[state.discardPile.length - 1]

    if (moveObj.type === 'play') {
      const card = hand[moveObj.cardIndex]
      if (!card) return { isValid: false, reason: 'Card not in hand' }
      if (!this.cardMatches(card, topCard, state.currentColor)) {
        return { isValid: false, reason: 'Card does not match color or value' }
      }
      return { isValid: true }
    }

    if (moveObj.type === 'draw') return { isValid: true }

    return { isValid: false, reason: 'Invalid move type' }
  }

  applyMove(gameState: unknown, move: string): UnoState {
    const newState: UnoState = JSON.parse(JSON.stringify(gameState))
    const moveObj = JSON.parse(move)
    const currentIdx = newState.currentTurnIndex

    if (moveObj.type === 'play') {
      const card = newState.hands[currentIdx][moveObj.cardIndex]
      newState.hands[currentIdx].splice(moveObj.cardIndex, 1)
      newState.discardPile.push(card)

      if (card.type === 'SKIP') {
        newState.currentTurnIndex = (currentIdx + 2 * newState.direction + newState.hands.length) % newState.hands.length
      } else if (card.type === 'REVERSE') {
        newState.direction = (newState.direction === 1 ? -1 : 1) as 1 | -1
        newState.currentTurnIndex = (currentIdx + newState.direction + newState.hands.length) % newState.hands.length
      } else if (card.type === 'DRAW2') {
        const nextIdx = (currentIdx + newState.direction + newState.hands.length) % newState.hands.length
        for (let i = 0; i < 2; i++) newState.hands[nextIdx].push(this.drawCard(newState))
        newState.currentTurnIndex = (nextIdx + newState.direction + newState.hands.length) % newState.hands.length
      } else if (card.type === 'WILD' || card.type === 'WILD_DRAW4') {
        newState.currentColor = moveObj.colorChoice || card.color
        if (card.type === 'WILD_DRAW4') {
          const nextIdx = (currentIdx + newState.direction + newState.hands.length) % newState.hands.length
          for (let i = 0; i < 4; i++) newState.hands[nextIdx].push(this.drawCard(newState))
          newState.currentTurnIndex = (nextIdx + newState.direction + newState.hands.length) % newState.hands.length
        } else {
          newState.currentTurnIndex = (currentIdx + newState.direction + newState.hands.length) % newState.hands.length
        }
      } else {
        newState.currentColor = card.color
        newState.currentTurnIndex = (currentIdx + newState.direction + newState.hands.length) % newState.hands.length
      }
    } else if (moveObj.type === 'draw') {
      newState.hands[currentIdx].push(this.drawCard(newState))
      newState.currentTurnIndex = (currentIdx + newState.direction + newState.hands.length) % newState.hands.length
    }

    return newState
  }

  isGameOver(gameState: unknown): GameOverResult {
    const state = gameState as UnoState
    for (let i = 0; i < state.hands.length; i++) {
      if (state.hands[i].length === 0) {
        return { isGameOver: true, winner: i, reason: 'player_out_of_cards' }
      }
    }
    return { isGameOver: false }
  }

  getPossibleMoves(gameState: unknown, playerIndex: number): string[] {
    const state = gameState as UnoState
    const hand = state.hands[playerIndex]
    const topCard = state.discardPile[state.discardPile.length - 1]
    const moves: string[] = []

    hand.forEach((card, i) => {
      if (this.cardMatches(card, topCard, state.currentColor)) {
        moves.push(JSON.stringify({ type: 'play', cardIndex: i }))
      }
    })

    moves.push(JSON.stringify({ type: 'draw' }))
    return moves
  }

  serializeState(): string {
    return JSON.stringify(this.gameState)
  }

  deserializeState(state: string): void {
    this.gameState = JSON.parse(state)
  }

  private cardMatches(card: UnoCard, topCard: UnoCard, currentColor: string): boolean {
    if (card.type === 'WILD' || card.type === 'WILD_DRAW4') return true
    const effectiveColor = currentColor || topCard.color
    return card.color === effectiveColor || card.value === topCard.value
  }

  private drawCard(state: UnoState): UnoCard {
    if (state.deck.length === 0) {
      const topCard = state.discardPile.pop()!
      state.deck = state.discardPile
      Uno.shuffle(state.deck)
      state.discardPile = [topCard]
    }
    return state.deck.pop()!
  }
}
