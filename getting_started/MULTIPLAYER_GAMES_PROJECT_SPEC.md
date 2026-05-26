# Multiplayer Games Server - Complete Project Specification

**Project Name:** Games Arena - Multiplayer Board & Card Games Platform  
**Domain:** penguincookie.ca  
**GitHub:** https://github.com/ahmadcookie8/Games-Arena  
**Status:** Ready for Development  
**Tech Stack:** MERN + TypeScript, Docker, AWS EC2, Socket.io  
**Hosting:** Vercel (Frontend), AWS EC2 t4g.micro (Backend)  
**Cost:** Free (12 months), then ~$6-7/month for backend  

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Database Schema](#database-schema)
4. [Redis Data Structures](#redis-data-structures)
5. [Game Logic Implementation](#game-logic-implementation)
6. [API Routes](#api-routes)
7. [Socket.io Events](#socketio-events)
8. [Frontend Components](#frontend-components)
9. [Deployment & DevOps](#deployment--devops)
10. [Setup & Installation Guide](#setup--installation-guide)
11. [Development Roadmap](#development-roadmap)

---

## Project Overview

### Objective
Build a real-time multiplayer platform supporting multiple board and card games (Chess, Checkers, Tic Tac Toe, Uno, President, etc.) with persistent game state, allowing users to play across the internet and resume games weeks later.

### Key Features
- **Real-time Multiplayer:** 2-5+ players per game via WebSockets
- **Persistent State:** Games saved to MongoDB, can resume anytime
- **Multiple Game Types:** Support 5+ games (Chess, Checkers, Tic Tac Toe, Uno, President)
- **User Accounts:** Simple authentication (username-based initially, no passwords)
- **Game History:** Track all moves, replay games, view statistics
- **Leaderboards:** Global rankings, win/loss stats per player
- **Responsive Design:** Desktop and mobile support

### MVP Scope (Phase 1)
- Tic Tac Toe (simplest, fastest to validate real-time)
- Chess (full rules validation)
- User authentication (username only)
- Real-time multiplayer sync
- Game persistence
- Resume functionality

### Stretch Goals (Phase 2+)
- Checkers, Uno, President
- Chat between players
- Game invitations
- Ratings/ELO system
- Spectator mode
- Game replays with animation

---

## Architecture & Tech Stack

### Frontend (Deployed to Vercel)
```
Technology Stack:
├─ Framework: React 18+ with TypeScript
├─ Build: Vite (fast development)
├─ Routing: React Router v6
├─ Real-time: Socket.io-client
├─ State: Zustand or Context API
├─ Styling: Tailwind CSS
├─ UI Components: Shadcn/ui (optional)
├─ HTTP Client: Axios
└─ Charts: Chart.js (for stats)
```

**Key Directories:**
```
frontend/
├─ src/
│  ├─ pages/
│  │  ├─ Dashboard.tsx        (Lobby, list active games)
│  │  ├─ GameBoard.tsx        (Main game UI)
│  │  ├─ GameHistory.tsx      (Past games)
│  │  └─ Auth.tsx             (Login/signup)
│  ├─ components/
│  │  ├─ ChessBoard.tsx
│  │  ├─ CheckersBoard.tsx
│  │  ├─ TicTacToeBoard.tsx
│  │  ├─ UnoTable.tsx
│  │  ├─ PresidentTable.tsx
│  │  ├─ MoveHistory.tsx
│  │  ├─ PlayerCard.tsx
│  │  ├─ Leaderboard.tsx
│  │  └─ GameInvite.tsx
│  ├─ hooks/
│  │  ├─ useSocket.ts         (Socket.io connection management)
│  │  ├─ useGameState.ts      (Game state management)
│  │  └─ useAuth.ts           (Authentication)
│  ├─ types/
│  │  ├─ game.ts              (Shared types with backend)
│  │  ├─ user.ts
│  │  └─ api.ts
│  ├─ lib/
│  │  ├─ gameRules.ts         (Client-side move validation)
│  │  ├─ api.ts               (API calls)
│  │  └─ socket.ts            (Socket.io setup)
│  └─ App.tsx
├─ tsconfig.json
├─ vite.config.ts
├─ tailwind.config.js
├─ package.json
└─ Dockerfile
```

### Backend (Deployed to AWS EC2 t4g.micro)
```
Technology Stack:
├─ Runtime: Node.js v18+
├─ Framework: Express.js + TypeScript
├─ Real-time: Socket.io
├─ Database: MongoDB Atlas (free tier)
├─ Cache: Redis (Docker container)
├─ ORM: Mongoose
├─ Auth: JWT (simple, stateless)
├─ Validation: Zod or io-ts
├─ Environment: dotenv
└─ Containerization: Docker
```

**Key Directories:**
```
backend/
├─ src/
│  ├─ server.ts               (Express + Socket.io setup)
│  ├─ games/                  (Game logic modules)
│  │  ├─ GameBase.ts          (Abstract base class)
│  │  ├─ Chess.ts
│  │  ├─ Checkers.ts
│  │  ├─ TicTacToe.ts
│  │  ├─ Uno.ts
│  │  └─ President.ts
│  ├─ models/                 (MongoDB schemas)
│  │  ├─ User.ts
│  │  ├─ Game.ts
│  │  ├─ GameSnapshot.ts
│  │  └─ Move.ts
│  ├─ routes/
│  │  ├─ auth.ts              (Login, signup)
│  │  ├─ games.ts             (Create, resume, list)
│  │  ├─ users.ts             (Stats, history)
│  │  └─ health.ts            (Health check)
│  ├─ controllers/
│  │  ├─ gameController.ts    (Game logic orchestration)
│  │  ├─ authController.ts
│  │  └─ userController.ts
│  ├─ services/
│  │  ├─ gameService.ts       (Business logic)
│  │  ├─ userService.ts
│  │  └─ redisService.ts
│  ├─ types/                  (Shared with frontend)
│  │  ├─ game.ts
│  │  ├─ user.ts
│  │  └─ api.ts
│  ├─ utils/
│  │  ├─ redis.ts             (Redis client setup)
│  │  ├─ mongoose.ts          (MongoDB connection)
│  │  ├─ validators.ts        (Input validation)
│  │  └─ errors.ts            (Error handling)
│  ├─ middleware/
│  │  ├─ auth.ts              (JWT verification)
│  │  ├─ errorHandler.ts
│  │  └─ cors.ts
│  └─ config.ts               (Environment config)
├─ tsconfig.json
├─ package.json
├─ Dockerfile
├─ docker-compose.yml         (Mongo + Redis + Node)
├─ .env.example
└─ README.md
```

### Deployment Architecture
```
┌────────────────────────────────────────────────────────────┐
│                        VERCEL                              │
│                   (Frontend Hosting)                        │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ React + TypeScript                                   │ │
│  │ - Dashboard                                          │ │
│  │ - Game boards                                        │ │
│  │ - Player stats                                       │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS + WebSocket
                         ↓
┌────────────────────────────────────────────────────────────┐
│                    AWS EC2 t4g.micro                       │
│                  (Backend + Services)                       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Node.js + Express + Socket.io                        │ │
│  │ - API routes                                         │ │
│  │ - WebSocket server                                   │ │
│  │ - Game logic                                         │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Docker Container 1: Redis (port 6379)               │ │
│  │ - Active game cache                                  │ │
│  │ - Session storage                                    │ │
│  │ - Leaderboard cache                                  │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Docker Container 2: Mongo (local, for backups)       │ │
│  │ - Optional local backup                              │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        ↓                                  ↓
┌─────────────────────────┐    ┌────────────────────────┐
│   MongoDB Atlas         │    │   GitHub Actions       │
│   (Free Tier)           │    │   (CI/CD Pipeline)     │
│ - Games                 │    │ - Auto-deploy          │
│ - Users                 │    │ - Run tests            │
│ - Game snapshots        │    │ - Build Docker         │
│ - Move history          │    │                        │
└─────────────────────────┘    └────────────────────────┘
```

---

## Database Schema

### MongoDB Collections

#### Users Collection
```typescript
interface User {
  _id: ObjectId
  username: string              // Unique, case-insensitive
  email?: string                // Optional, for future use
  passwordHash?: string         // For future authentication
  createdAt: Date
  updatedAt: Date
  
  stats: {
    gamesPlayed: number
    gamesWon: number
    gamesLost: number
    gamesDraw: number
    winRate: number             // Calculated field (gamesWon / gamesPlayed)
  }
  
  lastSeenAt: Date
  isActive: boolean
  
  preferences?: {
    theme: 'light' | 'dark'
    notifications: boolean
    autoRematch: boolean
  }
}
```

#### Games Collection
```typescript
interface Game {
  _id: ObjectId
  gameType: 'chess' | 'checkers' | 'ticTacToe' | 'uno' | 'president'
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  
  players: Array<{
    userId: ObjectId
    username: string
    index: number              // For turn tracking
    color?: string             // For chess/checkers
    rank?: string              // For president (PRESIDENT, COMMONER, SCUM)
    isConnected?: boolean      // Whether player is currently online
    connectedAt?: Date
    disconnectCount?: number   // How many times disconnected
  }>
  
  currentTurnIndex: number     // Index into players array
  currentTurn: ObjectId        // User ID whose turn it is
  
  gameState: Record<string, any>  // Game-specific state (board, hands, etc.)
  
  moveHistory: Array<{
    moveNumber: number
    playerId: ObjectId
    playerName: string
    move: string               // Game-specific move notation
    timestamp: Date
    elo_impact?: number        // For future rating system
  }>
  
  createdAt: Date
  startedAt?: Date             // When game actually began
  lastMoveAt: Date
  completedAt?: Date
  
  result?: {
    winner?: ObjectId
    winnerName?: string
    loser?: ObjectId           // For 2-player games
    loserName?: string
    isDraw: boolean
    winType: 'checkmate' | 'resignation' | 'timeout' | 'draw'
  }
  
  metadata: {
    timeControl?: 'blitz' | 'rapid' | 'classical'  // For future use
    ratedGame: boolean
    tournament?: string
  }
}
```

#### Game Snapshots Collection
```typescript
interface GameSnapshot {
  _id: ObjectId
  gameId: ObjectId             // Reference to Game
  snapshotNumber: number       // Sequential number
  
  gameState: Record<string, any>
  moveNumber: number           // After which move this snapshot was taken
  
  createdAt: Date
  
  // Optional: compress gameState for large histories
  // compressedState?: Buffer
}
```

#### Moves Collection (Optional, for fast move history access)
```typescript
interface Move {
  _id: ObjectId
  gameId: ObjectId
  moveNumber: number
  playerId: ObjectId
  playerName: string
  move: string
  timestamp: Date
  
  // For efficient pagination
  index: number
}
```

---

## Redis Data Structures

### Active Game State
```
Key: "game:{gameType}:{gameId}"
TTL: No expiration (set explicitly when game ends)

Value:
{
  gameId: string
  gameType: string
  players: [
    {
      userId: string
      username: string
      index: number
      connected: boolean
      connectionId: string     // Socket.io ID
      hand?: any               // For card games
    },
    ...
  ],
  currentTurnIndex: number
  gameState: any               // Game-specific
  moveHistory: [],             // Recent moves only
  lastMoveAt: timestamp
  status: "active" | "paused"
}

Example:
"game:chess:abc123" → { gameId: "abc123", players: [...], board: [...], ... }
"game:uno:xyz789" → { gameId: "xyz789", players: [...], hands: [...], ... }
```

### Player Sessions
```
Key: "session:{userId}:{socketId}"
TTL: 7 days (auto-extend on activity)

Value:
{
  userId: string
  username: string
  socketId: string
  connectedAt: timestamp
  lastActivityAt: timestamp
  currentGameId?: string       // If in a game
}

Example:
"session:user_1:socket_abc123" → { userId: "user_1", username: "ahmad", ... }
```

### Online Players Set
```
Key: "online:users"
Type: Set (unordered, unique)
TTL: 24 hours

Value: Set of userIds currently online

Example:
Members: ["user_1", "user_2", "user_3"]
```

### Leaderboard Cache
```
Key: "leaderboard:{gameType}"
Type: Sorted Set (ordered by score/winRate)
TTL: 1 hour

Value: Sorted set of players ranked by wins

Example:
"leaderboard:chess" →
  25 (wins): "ahmad"
  18 (wins): "brother"
  15 (wins): "friend1"
```

### Game Queue (for matchmaking, future feature)
```
Key: "queue:{gameType}"
Type: List
TTL: 30 minutes

Value: Players waiting for an opponent

Example:
"queue:chess" → ["user_1", "user_3", "user_5"]
```

### Player Statistics (Cached)
```
Key: "stats:{userId}"
TTL: 30 minutes

Value:
{
  userId: string
  username: string
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  gamesDraw: number
  winRate: number
  lastUpdated: timestamp
}

Example:
"stats:user_1" → { userId: "user_1", gamesPlayed: 42, gamesWon: 25, ... }
```

---

## Game Logic Implementation

### GameBase Abstract Class

```typescript
// backend/src/games/GameBase.ts

abstract class GameBase {
  protected gameType: string
  protected players: Player[]
  protected currentTurnIndex: number
  protected gameState: any
  protected moveHistory: Move[]
  
  // Must be implemented by subclasses
  abstract validateMove(gameState: any, move: string): ValidationResult
  abstract applyMove(gameState: any, move: string): any
  abstract isGameOver(gameState: any): GameOverResult
  abstract getPossibleMoves(gameState: any, playerIndex: number): string[]
  abstract serializeState(): string
  abstract deserializeState(state: string): void
  
  // Provided by base class
  constructor(players: Player[], initialGameState: any) {
    this.players = players
    this.gameState = initialGameState
    this.currentTurnIndex = 0
    this.moveHistory = []
  }
  
  getCurrentPlayer(): Player {
    return this.players[this.currentTurnIndex]
  }
  
  getCurrentTurnIndex(): number {
    return this.currentTurnIndex
  }
  
  advanceTurn(): void {
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length
  }
  
  recordMove(move: string, playerIndex: number): void {
    this.moveHistory.push({
      moveNumber: this.moveHistory.length + 1,
      playerIndex,
      move,
      timestamp: new Date()
    })
  }
  
  getGameState(): any {
    return this.gameState
  }
  
  getMoveHistory(): Move[] {
    return this.moveHistory
  }
}
```

### Chess Implementation

```typescript
// backend/src/games/Chess.ts

import { GameBase } from './GameBase'

class Chess extends GameBase {
  protected gameType = 'chess'
  
  validateMove(gameState: any, move: string): ValidationResult {
    // move format: "e2-e4"
    const [src, dest] = move.split('-')
    
    // Validate square notation
    if (!this.isValidSquare(src) || !this.isValidSquare(dest)) {
      return { isValid: false, reason: 'Invalid square notation' }
    }
    
    // Check piece exists at source
    const piece = gameState.board[src]
    if (!piece) {
      return { isValid: false, reason: 'No piece at source square' }
    }
    
    // Check it's current player's piece
    const currentPlayer = this.players[this.currentTurnIndex]
    if (piece.color !== currentPlayer.color) {
      return { isValid: false, reason: 'Not your piece' }
    }
    
    // Validate move rules (pawn moves, bishop diagonals, etc.)
    if (!this.isLegalMove(gameState, piece, src, dest)) {
      return { isValid: false, reason: 'Illegal move for this piece' }
    }
    
    // Check move doesn't leave king in check
    const stateCopy = JSON.parse(JSON.stringify(gameState))
    this.applyMoveToState(stateCopy, src, dest)
    if (this.isKingInCheck(stateCopy, currentPlayer.color)) {
      return { isValid: false, reason: 'King would be in check' }
    }
    
    return { isValid: true }
  }
  
  applyMove(gameState: any, move: string): any {
    const newState = JSON.parse(JSON.stringify(gameState))
    const [src, dest] = move.split('-')
    
    // Move piece
    newState.board[dest] = newState.board[src]
    newState.board[src] = null
    
    // Handle captures
    // Handle special moves (castling, en passant, promotion)
    
    return newState
  }
  
  isGameOver(gameState: any): GameOverResult {
    const currentPlayer = this.players[this.currentTurnIndex]
    
    if (this.isCheckmate(gameState, currentPlayer.color)) {
      return {
        isGameOver: true,
        winner: this.currentTurnIndex === 0 ? 1 : 0,
        reason: 'checkmate'
      }
    }
    
    if (this.isStalemate(gameState, currentPlayer.color)) {
      return {
        isGameOver: true,
        isDraw: true,
        reason: 'stalemate'
      }
    }
    
    if (this.isInsufficientMaterial(gameState)) {
      return {
        isGameOver: true,
        isDraw: true,
        reason: 'insufficient_material'
      }
    }
    
    return { isGameOver: false }
  }
  
  getPossibleMoves(gameState: any, playerIndex: number): string[] {
    // Generate all legal moves for the player
    const playerColor = this.players[playerIndex].color
    const moves: string[] = []
    
    for (const [square, piece] of Object.entries(gameState.board)) {
      if (piece && piece.color === playerColor) {
        const moves_for_piece = this.getMovesForPiece(gameState, square)
        moves.push(...moves_for_piece)
      }
    }
    
    return moves
  }
  
  // Helper methods
  private isValidSquare(square: string): boolean {
    // e4, d5, etc.
    const match = square.match(/^[a-h][1-8]$/)
    return !!match
  }
  
  private isLegalMove(gameState: any, piece: any, src: string, dest: string): boolean {
    // Implement piece-specific movement rules
    switch (piece.type) {
      case 'pawn': return this.isPawnMoveLegal(gameState, src, dest)
      case 'knight': return this.isKnightMoveLegal(src, dest)
      case 'bishop': return this.isBishopMoveLegal(gameState, src, dest)
      case 'rook': return this.isRookMoveLegal(gameState, src, dest)
      case 'queen': return this.isQueenMoveLegal(gameState, src, dest)
      case 'king': return this.isKingMoveLegal(gameState, src, dest)
      default: return false
    }
  }
  
  // ... more helper methods (isCheckmate, isStalmate, etc.)
}
```

### Uno Implementation

```typescript
// backend/src/games/Uno.ts

class Uno extends GameBase {
  protected gameType = 'uno'
  
  validateMove(gameState: any, move: string): ValidationResult {
    // move format: { type: 'play', cardIndex: 2 } or { type: 'draw' }
    const moveObj = JSON.parse(move)
    
    const currentPlayer = this.players[this.currentTurnIndex]
    const hand = gameState.hands[this.currentTurnIndex]
    
    if (moveObj.type === 'play') {
      const card = hand[moveObj.cardIndex]
      if (!card) {
        return { isValid: false, reason: 'Card not in hand' }
      }
      
      const topCard = gameState.discardPile[gameState.discardPile.length - 1]
      
      if (!this.cardMatches(card, topCard)) {
        return { isValid: false, reason: 'Card does not match' }
      }
      
      return { isValid: true }
    } else if (moveObj.type === 'draw') {
      return { isValid: true }
    } else if (moveObj.type === 'uno') {
      if (hand.length !== 1) {
        return { isValid: false, reason: 'Can only call UNO with 1 card' }
      }
      return { isValid: true }
    }
    
    return { isValid: false, reason: 'Invalid move type' }
  }
  
  applyMove(gameState: any, move: string): any {
    const newState = JSON.parse(JSON.stringify(gameState))
    const moveObj = JSON.parse(move)
    const currentPlayerIdx = this.currentTurnIndex
    
    if (moveObj.type === 'play') {
      const card = newState.hands[currentPlayerIdx][moveObj.cardIndex]
      
      // Remove from hand
      newState.hands[currentPlayerIdx].splice(moveObj.cardIndex, 1)
      
      // Add to discard pile
      newState.discardPile.push(card)
      
      // Handle action cards
      if (card.value === 'SKIP') {
        newState.currentTurnIndex = (currentPlayerIdx + 2) % newState.players.length
      } else if (card.value === 'REVERSE') {
        newState.direction *= -1
        newState.currentTurnIndex = (currentPlayerIdx + 1) % newState.players.length
      } else if (card.value === 'DRAW2') {
        const nextPlayerIdx = (currentPlayerIdx + 1) % newState.players.length
        for (let i = 0; i < 2; i++) {
          newState.hands[nextPlayerIdx].push(this.drawCard(newState))
        }
        newState.currentTurnIndex = (nextPlayerIdx + 1) % newState.players.length
      } else if (card.type === 'WILD') {
        newState.currentColor = moveObj.colorChoice
        newState.currentTurnIndex = (currentPlayerIdx + 1) % newState.players.length
      } else {
        newState.currentTurnIndex = (currentPlayerIdx + 1) % newState.players.length
      }
      
      // Check for UNO
      if (newState.hands[currentPlayerIdx].length === 1) {
        newState.unoStatus[currentPlayerIdx] = true
      }
    } else if (moveObj.type === 'draw') {
      const card = this.drawCard(newState)
      newState.hands[currentPlayerIdx].push(card)
      newState.currentTurnIndex = (currentPlayerIdx + 1) % newState.players.length
    }
    
    return newState
  }
  
  isGameOver(gameState: any): GameOverResult {
    for (let i = 0; i < gameState.hands.length; i++) {
      if (gameState.hands[i].length === 0) {
        return {
          isGameOver: true,
          winner: i,
          reason: 'player_out_of_cards'
        }
      }
    }
    return { isGameOver: false }
  }
  
  getPossibleMoves(gameState: any, playerIndex: number): string[] {
    const hand = gameState.hands[playerIndex]
    const topCard = gameState.discardPile[gameState.discardPile.length - 1]
    
    const playableMoves: string[] = []
    
    for (let i = 0; i < hand.length; i++) {
      if (this.cardMatches(hand[i], topCard)) {
        playableMoves.push(JSON.stringify({ type: 'play', cardIndex: i }))
      }
    }
    
    // Can always draw
    playableMoves.push(JSON.stringify({ type: 'draw' }))
    
    return playableMoves
  }
  
  private cardMatches(card: any, topCard: any): boolean {
    if (card.type === 'WILD') return true
    return card.color === topCard.color || card.value === topCard.value
  }
  
  private drawCard(gameState: any): any {
    if (gameState.deck.length === 0) {
      // Reshuffle discard pile
      gameState.deck = gameState.discardPile.slice(0, -1)
      gameState.discardPile = [gameState.discardPile[gameState.discardPile.length - 1]]
    }
    return gameState.deck.pop()
  }
}
```

---

## API Routes

### Authentication Routes (`POST /api/auth/*`)

```typescript
// POST /api/auth/signup
Request: { username: string }
Response: { 
  token: string
  user: { _id, username, createdAt }
}
Status: 201 Created

// POST /api/auth/login
Request: { username: string }
Response: { 
  token: string
  user: { _id, username, stats }
}
Status: 200 OK

// GET /api/auth/me (protected)
Response: { user: User }
Status: 200 OK
```

### Games Routes (`/api/games/*`)

```typescript
// POST /api/games/create
Request: { 
  gameType: string
  opponentUserId?: string  // If inviting specific opponent
}
Response: { 
  gameId: string
  gameCode: string         // Share code for inviting brother
  players: Player[]
}
Status: 201 Created

// GET /api/games/:gameId
Response: { 
  game: Game
  gameState: any
  moveHistory: Move[]
}
Status: 200 OK

// GET /api/games
Response: { 
  active: Game[]           // Games in progress
  waiting: Game[]          // Games awaiting opponent
  completed: Game[]        // Past games
}
Status: 200 OK

// POST /api/games/:gameId/join
Request: { gameCode: string }  // Join via share code
Response: { 
  game: Game
  gameState: any
}
Status: 200 OK

// POST /api/games/:gameId/resign
Response: { 
  winner: User
  reason: 'resignation'
}
Status: 200 OK

// POST /api/games/:gameId/draw
Request: { agreed: boolean }
Response: { result: GameResult }
Status: 200 OK

// GET /api/games/:gameId/resume
Response: { 
  game: Game
  gameState: any      // Reconstructed from snapshots + moves
  moveHistory: Move[]
}
Status: 200 OK

// GET /api/games/:gameId/history
Query: { page: number, limit: number }
Response: { 
  moves: Move[]
  total: number
}
Status: 200 OK
```

### Users Routes (`/api/users/*`)

```typescript
// GET /api/users/:userId
Response: { 
  user: User
  stats: UserStats
  recentGames: Game[]
}
Status: 200 OK

// GET /api/users/:userId/stats
Response: { 
  gamesPlayed: number
  winRate: number
  gamesWon: number
  gamesByType: {
    chess: { played, won },
    uno: { played, won },
    ...
  }
}
Status: 200 OK

// GET /api/leaderboards/:gameType
Query: { limit: number, page: number }
Response: { 
  leaderboard: [{
    rank: number
    username: string
    wins: number
    losses: number
    winRate: number
  }]
}
Status: 200 OK

// GET /api/leaderboards
Response: { 
  global: UserStats[]      // Top 10 all games
  byGameType: {
    chess: UserStats[],
    uno: UserStats[],
    ...
  }
}
Status: 200 OK
```

### Health & Monitoring Routes

```typescript
// GET /api/health
Response: { 
  status: 'ok',
  uptime: number
  mongodb: 'connected' | 'disconnected'
  redis: 'connected' | 'disconnected'
}
Status: 200 OK or 503 Service Unavailable
```

---

## Socket.io Events

### Connection & Disconnection

```typescript
// Client emits when connecting
socket.emit('connect')

// Server responds
io.on('connection', (socket) => {
  socket.emit('welcome', {
    socketId: socket.id,
    message: 'Connected to game server'
  })
})

// When player disconnects
socket.on('disconnect', () => {
  // Mark player as offline in game
  // Start timeout for auto-resignation (5 minutes)
  // Notify opponent
})
```

### Game Creation & Joining

```typescript
// Player 1 creates a game
socket.emit('createGame', { 
  gameType: 'chess',
  opponentUserId?: 'user_2'  // Optional
}, (response) => {
  // response: { gameId, gameCode, players }
})

// Player 2 joins via code
socket.emit('joinGame', { 
  gameCode: 'ABC123'
}, (response) => {
  // response: { game, gameState }
})

// Server broadcasts to both players
io.to(gameId).emit('gameStarted', {
  game: Game,
  gameState: any,
  yourTurn: boolean
})
```

### Making Moves

```typescript
// Player makes a move
socket.emit('makeMove', {
  gameId: string,
  move: string  // Game-specific format (e.g., "e2-e4")
}, (response) => {
  // response: { 
  //   success: boolean,
  //   gameState?: any,
  //   error?: string
  // }
})

// Server validates, applies, broadcasts to both players
io.to(gameId).emit('moveMade', {
  player: string,
  move: string,
  gameState: any,
  nextPlayer: string,
  isGameOver?: boolean,
  winner?: string
})

// Check for game over
io.to(gameId).emit('gameOver', {
  winner: string,
  reason: 'checkmate' | 'resignation' | 'timeout',
  stats: {
    winner: UserStats,
    loser: UserStats
  }
})
```

### Game State Sync

```typescript
// Player requests full game state (on reconnect)
socket.emit('getGameState', { gameId }, (response) => {
  // response: { game, gameState, moveHistory }
})

// Request move history
socket.emit('getMoveHistory', { 
  gameId, 
  page: number 
}, (response) => {
  // response: { moves: Move[], total: number }
})

// Request possible moves (for client-side hints)
socket.emit('getPossibleMoves', { gameId }, (response) => {
  // response: { moves: string[] }
})
```

### Player Status

```typescript
// Notify opponent player is online/offline
io.to(gameId).emit('playerStatus', {
  username: string,
  status: 'online' | 'offline',
  timestamp: Date
})

// Request list of active players
socket.emit('getOnlinePlayers', {}, (response) => {
  // response: { players: string[] }
})
```

### Chat (Optional MVP+)

```typescript
// Send message in game chat
socket.emit('sendMessage', {
  gameId: string,
  message: string
}, (response) => {
  // response: { success: boolean }
})

// Receive messages
io.to(gameId).emit('messageReceived', {
  username: string,
  message: string,
  timestamp: Date
})
```

### Pause/Resume Game

```typescript
// Player pauses game
socket.emit('pauseGame', { gameId }, (response) => {
  // response: { success: boolean }
})

io.to(gameId).emit('gamePaused', {
  pausedBy: string,
  timestamp: Date
})

// Resume (can be days later)
socket.emit('resumeGame', { gameId }, (response) => {
  // response: { game, gameState }
})

io.to(gameId).emit('gameResumed', {
  gameState: any,
  currentPlayer: string
})
```

---

## Frontend Components

### Page Components

```typescript
// Dashboard.tsx - Main lobby
├─ Active Games Section
│  └─ Cards showing games in progress
├─ Waiting Games Section
│  └─ Games awaiting opponent
├─ Create Game Button
│  └─ Modal to select game type
├─ Game History Section
│  └─ Paginated list of completed games
└─ Leaderboard Widget
   └─ Top 10 players

// GameBoard.tsx - Main game UI
├─ Game Header
│  ├─ Player names
│  ├─ Timer (if applicable)
│  └─ Game type/status
├─ Game Canvas
│  ├─ ChessBoard / UnoTable / etc. (dynamic)
│  └─ Move validation feedback
├─ Right Sidebar
│  ├─ Move History
│  ├─ Player Stats
│  └─ Game Controls (Resign, Draw, Pause)
└─ Bottom Sidebar
   ├─ Current Turn Indicator
   ├─ Next Moves (hints)
   └─ Chat Box (optional)

// GameHistory.tsx - View past games
├─ Filter by game type
├─ Filter by opponent
├─ Sort by date/result
├─ Game cards with quick stats
└─ "View Replay" button for each game

// Auth.tsx - Login/Signup
├─ Username input
├─ Submit button
├─ Error messages
└─ "Continue as Guest" option (optional)
```

### Game-Specific Components

```typescript
// ChessBoard.tsx
├─ SVG or Canvas-based board
├─ Piece rendering
├─ Move highlighting
├─ Click handlers for piece selection
├─ Drag-and-drop support (optional)
└─ Promotion dialog (for pawns)

// UnoTable.tsx
├─ Draw pile (deck)
├─ Discard pile (top card visible)
├─ Player hands (arranged in circle)
├─ Card selection UI
├─ Action buttons (Draw, UNO, etc.)
└─ Player status indicators

// PresidentTable.tsx
├─ Card layout by rank
├─ Player positions (circle)
├─ Hands hidden from others
├─ Trick visualization
└─ Rank progression display
```

### Shared Components

```typescript
// MoveHistory.tsx - Shows all moves
├─ Scrollable list
├─ Move notation (e.g., "e2-e4")
├─ Player names
├─ Timestamps
└─ Click to jump to move (optional)

// PlayerCard.tsx - Shows player info
├─ Username
├─ Avatar (optional)
├─ Current status (online/offline)
├─ Stats badge
└─ Elo rating (future)

// Leaderboard.tsx - Rankings
├─ Table with rank, username, wins, loss, win%
├─ Filter by game type
├─ Current player highlighted
└─ Load more pagination

// GameInvite.tsx - Share invite code
├─ Display game code
├─ Copy to clipboard button
├─ Share link
└─ QR code (optional)

// GameOverModal.tsx - End of game
├─ Winner announcement
├─ Final stats
├─ Result reason (checkmate, resignation, etc.)
├─ "Play Again" button
└─ "View Game History" link
```

---

## Deployment & DevOps

### GitHub Actions CI/CD Pipeline

```yaml
# .github/workflows/deploy-frontend.yml
name: Deploy Frontend to Vercel

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Build
        run: cd frontend && npm run build
      
      - name: Deploy to Vercel
        uses: vercel/action@v4
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend

# .github/workflows/deploy-backend.yml
name: Deploy Backend to EC2

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: |
          cd backend
          docker build -t multiplayer-games:${{ github.sha }} .
          docker tag multiplayer-games:${{ github.sha }} multiplayer-games:latest
      
      - name: Push to Docker Hub
        run: |
          echo ${{ secrets.DOCKER_HUB_PASSWORD }} | docker login -u ${{ secrets.DOCKER_HUB_USERNAME }} --password-stdin
          docker push ${{ secrets.DOCKER_HUB_USERNAME }}/multiplayer-games:latest
      
      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          port: 22
          script: |
            cd /home/ec2-user/multiplayer-games
            git pull origin main
            docker pull ${{ secrets.DOCKER_HUB_USERNAME }}/multiplayer-games:latest
            docker-compose down
            docker-compose up -d
            docker-compose logs -f
```

### Docker Setup

```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

```yaml
# backend/docker-compose.yml
version: '3.8'

services:
  node:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - PORT=3000
    depends_on:
      - redis
    networks:
      - app-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network
    restart: unless-stopped
    command: redis-server --appendonly yes

volumes:
  redis-data:

networks:
  app-network:
    driver: bridge
```

### Environment Variables

```bash
# backend/.env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/multiplayer-games
REDIS_URL=redis://redis:6379
JWT_SECRET=your-super-secret-jwt-key-change-this
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info

# frontend/.env
VITE_API_URL=https://api.yourdomain.com
VITE_SOCKET_URL=https://api.yourdomain.com
VITE_ENV=production
```

---

## Setup & Installation Guide

### Prerequisites

- Node.js v18+
- Docker & Docker Compose
- Git
- AWS account (for EC2)
- MongoDB Atlas free tier account
- Vercel account
- GitHub account

### Local Development Setup

#### 1. Clone Repository

```bash
git clone https://github.com/yourusername/multiplayer-games.git
cd multiplayer-games
```

#### 2. Backend Setup

```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env with your MongoDB URI
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/games
# REDIS_URL=redis://localhost:6379

# Install dependencies
npm install

# Start with Docker Compose
docker-compose up -d

# Watch logs
docker-compose logs -f

# Or run locally (without Docker)
npm run dev
```

#### 3. Frontend Setup

```bash
cd frontend

# Copy environment template
cp .env.example .env

# Install dependencies
npm install

# Start dev server
npm run dev

# Visit http://localhost:5173
```

#### 4. Verify Services

```bash
# Check backend health
curl http://localhost:3000/api/health

# Check Redis connection
redis-cli ping  # Should return PONG

# Check MongoDB connection
# View logs: docker-compose logs -f node
```

### Production Deployment

#### 1. AWS EC2 Setup

```bash
# SSH into EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Install Docker
sudo yum update -y
sudo yum install docker -y
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone repo
git clone https://github.com/yourusername/multiplayer-games.git
cd multiplayer-games/backend

# Create .env file with production values
nano .env

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

#### 2. Vercel Deployment (Frontend)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel

# Set environment variables in Vercel dashboard
# VITE_API_URL=https://your-ec2-domain.com
# VITE_SOCKET_URL=https://your-ec2-domain.com
```

#### 3. Domain & SSL

```bash
# Point your domain to EC2 using Route53 or your registrar
# Use AWS Certificate Manager for free SSL
# Update CORS_ORIGIN in backend .env
```

#### 4. GitHub Actions Secrets

```bash
# In GitHub repo settings, add secrets:
VERCEL_TOKEN=<your-vercel-token>
VERCEL_ORG_ID=<your-org-id>
VERCEL_PROJECT_ID=<your-project-id>

EC2_HOST=<your-ec2-public-ip>
EC2_SSH_KEY=<your-private-ssh-key>
DOCKER_HUB_USERNAME=<your-docker-hub-username>
DOCKER_HUB_PASSWORD=<your-docker-hub-password>
```

---

## Development Roadmap

### Phase 1: MVP (Weeks 1-3)
- [x] Project setup & architecture
- [ ] Backend: Express + Socket.io + TypeScript
- [ ] Tic Tac Toe game logic
- [ ] MongoDB + Redis setup
- [ ] Frontend: React + Vite + TypeScript
- [ ] Authentication (username only)
- [ ] Real-time move sync
- [ ] Game persistence & resume
- [ ] GitHub Actions CI/CD
- [ ] Deploy to Vercel + EC2

### Phase 2: More Games (Weeks 4-6)
- [ ] Chess implementation (full rules)
- [ ] Checkers implementation
- [ ] Uno implementation
- [ ] Move validation & hints
- [ ] Game replay/animation
- [ ] Leaderboards

### Phase 3: Polish & Features (Weeks 7-8)
- [ ] Chat between players
- [ ] Game invitations
- [ ] Spectator mode
- [ ] Mobile optimization
- [ ] Sound effects
- [ ] Notifications
- [ ] User profiles
- [ ] Statistics dashboard

### Phase 4+: Advanced (Future)
- [ ] Ratings/ELO system
- [ ] Tournaments
- [ ] AI opponents
- [ ] Mobile app (React Native)
- [ ] President game
- [ ] Time controls (blitz, rapid, classical)
- [ ] Streaming to Twitch

---

## Testing Strategy

### Unit Tests

```bash
# Backend
npm run test:unit

# Frontend
npm run test:unit
```

### Integration Tests

```bash
# Test Socket.io events
npm run test:socket

# Test API routes
npm run test:api
```

### E2E Tests (Cypress)

```bash
# Test full game flow
npm run test:e2e
```

### Performance Testing

```bash
# Load test with 100 concurrent players
npm run test:load
```

---

## Monitoring & Logging

### Backend Monitoring

```typescript
// Log to console in development, file in production
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console()
  ]
})
```

### Health Checks

```typescript
// Monitor MongoDB, Redis, Server uptime
GET /api/health → {
  status: 'ok',
  uptime: 3600,
  mongodb: 'connected',
  redis: 'connected',
  timestamp: '2026-05-26T10:30:00Z'
}
```

### Metrics

- Concurrent players
- Games in progress
- Average move latency
- Redis memory usage
- MongoDB query times

---

## Cost Breakdown

| Service | Tier | Cost/Month | Notes |
|---------|------|-----------|-------|
| AWS EC2 t4g.micro | On-Demand (after 12mo) | $6.13 | Cheapest option, sufficient for this project |
| MongoDB Atlas | Free tier | $0 | 512MB storage, enough for 1000+ games |
| Redis | Self-hosted (Docker) | $0 | Included in EC2 |
| Vercel | Pro (if needed) | $20 | Free tier usually sufficient |
| Domain | .com | ~$12/year | Optional |
| **Total** | | **~$6-7/month** | Very affordable! |

---

## Files to Create

1. **Backend**
   - `backend/src/games/GameBase.ts`
   - `backend/src/games/Chess.ts`
   - `backend/src/games/Checkers.ts`
   - `backend/src/games/TicTacToe.ts`
   - `backend/src/games/Uno.ts`
   - `backend/src/games/President.ts`
   - `backend/src/models/User.ts`
   - `backend/src/models/Game.ts`
   - `backend/src/models/GameSnapshot.ts`
   - `backend/src/routes/auth.ts`
   - `backend/src/routes/games.ts`
   - `backend/src/routes/users.ts`
   - `backend/src/server.ts`

2. **Frontend**
   - `frontend/src/pages/Dashboard.tsx`
   - `frontend/src/pages/GameBoard.tsx`
   - `frontend/src/pages/GameHistory.tsx`
   - `frontend/src/pages/Auth.tsx`
   - `frontend/src/components/ChessBoard.tsx`
   - `frontend/src/components/UnoTable.tsx`
   - `frontend/src/hooks/useSocket.ts`
   - `frontend/src/types/game.ts`

3. **Configuration**
   - `docker-compose.yml`
   - `.env.example`
   - `.github/workflows/deploy-frontend.yml`
   - `.github/workflows/deploy-backend.yml`

---

## Quick Start Commands

```bash
# Development
npm run dev              # Start both frontend & backend

# Testing
npm run test             # Run all tests
npm run test:watch      # Watch mode

# Building
npm run build            # Build for production

# Deployment
npm run deploy           # Deploy to Vercel + EC2

# Docker
docker-compose up -d    # Start services
docker-compose down     # Stop services
docker-compose logs -f  # View logs
```

---

## Support & Resources

- **Socket.io Docs:** https://socket.io/docs
- **Chess.js Library:** https://github.com/jhlywa/chess.js
- **MongoDB Docs:** https://docs.mongodb.com
- **Redis Docs:** https://redis.io/docs
- **Vercel Docs:** https://vercel.com/docs
- **AWS EC2 Docs:** https://docs.aws.amazon.com/ec2

---

**Project Created:** May 26, 2026  
**Last Updated:** May 26, 2026  
**Status:** Ready for Development
