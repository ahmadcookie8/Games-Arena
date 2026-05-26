# Developer Handoff & Implementation Guide

**For:** Claude Code & Codex CLI  
**Project:** Multiplayer Games Server (Games Arena)  
**Domain:** penguincookie.ca  
**GitHub:** https://github.com/ahmadcookie8/Games-Arena  
**Start Date:** May 26, 2026  

---

## 📌 Quick Overview for AI Assistants

You're building a real-time multiplayer games platform (Chess, Uno, Checkers, etc.) where users can:
- Play 2-5+ players simultaneously via WebSockets
- Save games and resume weeks later
- View leaderboards and game history
- Use simple username-based authentication

**Stack:** MERN + TypeScript | Socket.io | Redis | MongoDB | Docker | AWS EC2 | Vercel

---

## 🎯 Implementation Priority Order

### Priority 1: Core Infrastructure (Days 1-2)
**Goal:** Get backend running with Socket.io, auth, and database connections

#### Tasks
1. **Backend Server Setup**
   - [ ] Create Express.js app with TypeScript
   - [ ] Set up Socket.io server
   - [ ] Connect to MongoDB Atlas
   - [ ] Connect to Redis
   - [ ] Add health check endpoint (`GET /api/health`)
   - [ ] Configure CORS & middleware
   - [ ] Set up JWT authentication

2. **User Model & Authentication**
   - [ ] Create User MongoDB schema
   - [ ] Implement signup (`POST /api/auth/signup`)
   - [ ] Implement login (`POST /api/auth/login`)
   - [ ] Create auth middleware for protected routes
   - [ ] Add JWT token generation

3. **Basic Frontend**
   - [ ] Create React app with Vite
   - [ ] Set up Socket.io client connection hook (`useSocket.ts`)
   - [ ] Create basic login/signup page
   - [ ] Create dashboard skeleton
   - [ ] Verify frontend connects to backend

#### Success Criteria
- [ ] Backend health check returns `{ status: 'ok', mongodb: 'connected', redis: 'connected' }`
- [ ] Can sign up and log in from frontend
- [ ] Socket.io client connects to server
- [ ] No console errors

---

### Priority 2: Tic Tac Toe Game (Days 3-4)
**Goal:** Full working Tic Tac Toe game with persistence

#### Tasks
1. **Game Logic**
   - [ ] Create `GameBase.ts` abstract class
   - [ ] Create `TicTacToe.ts` game implementation
   - [ ] Implement `validateMove()`, `applyMove()`, `isGameOver()`
   - [ ] Test locally

2. **Game Controller & Routes**
   - [ ] Create game service layer
   - [ ] Implement `POST /api/games/create` (create new game)
   - [ ] Implement `GET /api/games/:gameId` (get game state)
   - [ ] Implement `GET /api/games` (list all games)
   - [ ] Store games in MongoDB

3. **Socket.io Events**
   - [ ] Implement `createGame` event
   - [ ] Implement `joinGame` event (using share code)
   - [ ] Implement `makeMove` event
   - [ ] Broadcast `moveMade` to all players
   - [ ] Detect and broadcast `gameOver`

4. **Redis Caching**
   - [ ] Cache active games in Redis
   - [ ] Store games with key `game:ticTacToe:{gameId}`
   - [ ] Set Redis expiration when game ends

5. **Frontend Components**
   - [ ] Create `GameBoard.tsx` page
   - [ ] Create `TicTacToeBoard.tsx` component (3x3 grid)
   - [ ] Implement move clicking
   - [ ] Show current turn indicator
   - [ ] Show game over modal
   - [ ] Create "Create Game" button on dashboard
   - [ ] Implement "Join Game" with code input

6. **Persistence**
   - [ ] Save all moves to `moveHistory` in MongoDB
   - [ ] Save final result when game ends
   - [ ] Update user stats (wins/losses)

#### Success Criteria
- [ ] 2 players can play Tic Tac Toe in real-time
- [ ] Moves sync instantly between players
- [ ] Game ends correctly (detect winner/draw)
- [ ] Refresh page → game state is restored from MongoDB
- [ ] Game shows in completed games list

---

### Priority 3: Chess Game (Days 5-7)
**Goal:** Full Chess implementation with move validation

#### Tasks
1. **Chess Logic** (this is complex, take time)
   - [ ] Create `Chess.ts` class
   - [ ] Implement board representation (8x8 grid)
   - [ ] Implement piece movement rules
     - [ ] Pawn (advance, capture, promotion)
     - [ ] Knight (L-shape)
     - [ ] Bishop (diagonals)
     - [ ] Rook (straight lines)
     - [ ] Queen (both)
     - [ ] King (one square + castling)
   - [ ] Implement special moves
     - [ ] Castling (kingside & queenside)
     - [ ] En passant
     - [ ] Promotion
   - [ ] Implement check detection
   - [ ] Implement checkmate detection
   - [ ] Implement stalemate detection
   - [ ] Validate moves don't leave own king in check

2. **Chess Frontend**
   - [ ] Create `ChessBoard.tsx` component (8x8 board)
   - [ ] Show pieces with symbols (♔ ♕ ♖ ♗ ♘ ♙)
   - [ ] Highlight selected piece
   - [ ] Highlight valid moves (show possible destinations)
   - [ ] Implement drag-and-drop OR click-to-select
   - [ ] Handle promotion (show modal when pawn reaches end)
   - [ ] Show last move highlight

3. **Integration**
   - [ ] Reuse game creation/joining from Tic Tac Toe
   - [ ] Socket.io events work same way
   - [ ] Persistence works same way

#### Success Criteria
- [ ] Legal moves only (no moving to invalid squares)
- [ ] Can't move own pieces into check
- [ ] Checkmate ends game
- [ ] Can resume mid-game
- [ ] Move history displays correctly

---

### Priority 4: Game Persistence & Resume (Days 8-9)
**Goal:** Play a game, close, reopen weeks later

#### Tasks
1. **Game Snapshots**
   - [ ] Create `GameSnapshot` MongoDB schema
   - [ ] Save snapshot every 10 moves (for fast resume)
   - [ ] Implement snapshot loading

2. **Resume Functionality**
   - [ ] Implement `GET /api/games/:gameId/resume`
   - [ ] Load latest snapshot
   - [ ] Replay moves after snapshot
   - [ ] Reconstruct full game state
   - [ ] Implement `POST /api/games/:gameId/pause`

3. **Frontend**
   - [ ] Dashboard shows "Resume" button on paused games
   - [ ] Shows last move date and opponent name
   - [ ] Click resume → loads game state

4. **Game State Reconstruction**
   - [ ] Load snapshot from MongoDB
   - [ ] Replay remaining moves to reconstruct state
   - [ ] Verify reconstructed state matches original

#### Success Criteria
- [ ] Play game, pause, close browser
- [ ] Days later: open app, resume game, state is exactly as left
- [ ] Move history is complete (no missing moves)

---

### Priority 5: Leaderboards & Stats (Days 10-11)
**Goal:** See how you rank against others

#### Tasks
1. **User Stats**
   - [ ] Update user stats on game completion
   - [ ] Track games played, won, lost, drawn
   - [ ] Calculate win rate
   - [ ] Store in MongoDB `User.stats`
   - [ ] Cache in Redis with TTL

2. **Leaderboard Routes**
   - [ ] Implement `GET /api/leaderboards` (global)
   - [ ] Implement `GET /api/leaderboards/:gameType` (by game)
   - [ ] Return top 10-100 players
   - [ ] Include rank, username, wins, losses, win%

3. **Frontend**
   - [ ] Create `Leaderboard.tsx` component
   - [ ] Show table: Rank | Player | Wins | Losses | Win%
   - [ ] Highlight current user
   - [ ] Filter by game type (Chess, Tic Tac Toe, etc.)

#### Success Criteria
- [ ] Leaderboard updates after each game
- [ ] Cached in Redis (fast load)
- [ ] Shows correct ranking

---

### Priority 6: Uno Game (Days 12-14)
**Goal:** 4-player Uno with hand management

#### Tasks
1. **Uno Logic** (most complex)
   - [ ] Create `Uno.ts` class
   - [ ] Implement deck (4 colors × 13 values + special cards)
   - [ ] Implement hand management (deal 7 cards)
   - [ ] Implement card matching (color or number)
   - [ ] Implement action cards
     - [ ] SKIP (skip next player)
     - [ ] REVERSE (reverse direction)
     - [ ] DRAW2 (next player draws 2)
     - [ ] WILD (play any color)
     - [ ] WILD_DRAW4 (play any + next draws 4)
   - [ ] Implement UNO call detection
   - [ ] Implement draw pile reshuffle
   - [ ] End game when player has 0 cards

2. **Uno Frontend**
   - [ ] Create `UnoTable.tsx` component
   - [ ] Show player hands (fanned)
   - [ ] Show discard pile (top card visible)
   - [ ] Show draw pile
   - [ ] Players in circle (4 positions)
   - [ ] Show current player highlight
   - [ ] Card selection UI (click to play)
   - [ ] Button for "Draw" action
   - [ ] Color selection modal for WILD cards

3. **Multiplayer Handling**
   - [ ] Broadcasting to 4 players instead of 2
   - [ ] Socket.io rooms handle this automatically
   - [ ] Track player order and turns

#### Success Criteria
- [ ] 4 players can play simultaneously
- [ ] Action cards work correctly
- [ ] Game ends when someone has 0 cards
- [ ] All players see same game state

---

### Priority 7: Polish & Extras (Days 15+)
**Goal:** Make it production-ready

#### Tasks (In Order)
1. **Move History & Replay**
   - [ ] Create `MoveHistory.tsx` component
   - [ ] Show list of all moves
   - [ ] Pagination if 100+ moves
   - [ ] Click to jump to move (optional)
   - [ ] Implement move replay (optional)

2. **Disconnect Handling**
   - [ ] Mark player as offline if disconnects
   - [ ] Wait 5 minutes for reconnect
   - [ ] Auto-resign if doesn't reconnect
   - [ ] Handle player reconnection mid-game
   - [ ] Send full game state on reconnect

3. **UI Polish**
   - [ ] Add responsive design (mobile)
   - [ ] Add dark/light mode toggle
   - [ ] Add smooth animations
   - [ ] Add sound effects (optional)
   - [ ] Add loading indicators

4. **Deployment**
   - [ ] Set up GitHub Actions CI/CD
   - [ ] Deploy backend to AWS EC2
   - [ ] Deploy frontend to Vercel
   - [ ] Test on production

---

## 🔑 Key Patterns & Conventions

### Game Logic Pattern
```typescript
// All games inherit from GameBase
class MyGame extends GameBase {
  validateMove(gameState: any, move: string): ValidationResult {
    // Return { isValid: true/false, reason?: string }
  }
  
  applyMove(gameState: any, move: string): any {
    // Return new game state (don't mutate)
  }
  
  isGameOver(gameState: any): GameOverResult {
    // Return { isGameOver, winner?, isDraw? }
  }
}
```

### Socket.io Pattern
```typescript
// Server emits, client listens
socket.emit('makeMove', move, (response) => {
  // Callback with response
})

// Server broadcasts to room
io.to(gameId).emit('moveMade', newState)
```

### Database Pattern
```typescript
// Always save to MongoDB immediately (source of truth)
// Also update Redis for caching
await redis.set(`game:${gameId}`, gameState)
await mongodb.games.updateOne({ _id: gameId }, { gameState })
```

### Frontend Pattern
```typescript
// Use Zustand or Context for state
const useGameStore = create((set) => ({
  gameState: null,
  currentPlayer: null,
  setGameState: (state) => set({ gameState: state })
}))

// Use Socket.io hook
const { socket, emit, on } = useSocket()
```

---

## ⚡ Quick Command Reference for Codex CLI

```bash
# Use Codex to generate boilerplate
codex "Generate Express server with Socket.io in TypeScript"
codex "Create MongoDB schema for Game with moveHistory"
codex "Write React component for chess board using Canvas"

# Use Claude Code for complex logic
# Chess move validation
# Uno action card handling
# Game state reconstruction from snapshots
```

---

## 🚨 Common Pitfalls to Avoid

1. **Mutating Game State**
   ```javascript
   // ❌ WRONG - mutates original
   gameState.board[0] = piece
   
   // ✅ RIGHT - creates new object
   const newState = JSON.parse(JSON.stringify(gameState))
   newState.board[0] = piece
   return newState
   ```

2. **Not Broadcasting to All Players**
   ```javascript
   // ❌ WRONG - only sends to current player
   socket.emit('moveMade', newState)
   
   // ✅ RIGHT - broadcasts to all in game
   io.to(gameId).emit('moveMade', newState)
   ```

3. **Trusting Client-Side Validation Only**
   ```javascript
   // ❌ WRONG - client could cheat
   if (clientSideValidation) {
     applyMove()
   }
   
   // ✅ RIGHT - validate server-side
   if (!validateMoveOnServer(move)) {
     return error
   }
   applyMove()
   ```

4. **Not Handling Disconnects**
   ```javascript
   // ❌ WRONG - game breaks if player disconnects
   
   // ✅ RIGHT - mark offline, allow reconnect
   socket.on('disconnect', () => {
     markPlayerOffline(playerId)
     startReconnectTimeout(5 * 60 * 1000)
   })
   ```

5. **MongoDB Without Indexes**
   ```javascript
   // Add indexes for common queries
   db.games.createIndex({ createdAt: -1 })
   db.games.createIndex({ 'players.userId': 1 })
   db.users.createIndex({ username: 1 }, { unique: true })
   ```

---

## 📊 Test Cases to Implement

### Tic Tac Toe
- [ ] Valid move plays
- [ ] Invalid move rejected
- [ ] Game ends on win
- [ ] Game ends on draw
- [ ] Cannot play after game ends

### Chess
- [ ] Pawn moves 1 square forward
- [ ] Pawn captures diagonally
- [ ] Pawn cannot move 2 squares from rank 3
- [ ] Knight jumps correctly
- [ ] Bishop moves diagonally
- [ ] Cannot move into check
- [ ] Checkmate ends game
- [ ] Stalemate ends game

### Uno
- [ ] Can only play matching color/number
- [ ] SKIP skips next player
- [ ] REVERSE reverses direction
- [ ] DRAW2 makes next player draw 2
- [ ] WILD allows any color
- [ ] Game ends when hand is empty

---

## 📈 Performance Targets

- **Move latency:** <10ms from client to server to other clients
- **Game creation:** <1 second
- **Resume game:** <2 seconds
- **Concurrent games:** 100+ on t4g.micro
- **Redis memory:** <100MB
- **MongoDB query time:** <50ms

---

## 🔐 Security Checklist

- [ ] Validate all moves server-side
- [ ] JWT token verification on protected routes
- [ ] CORS properly configured
- [ ] No sensitive data in logs
- [ ] MongoDB has unique index on username
- [ ] Redis has expiration for sessions
- [ ] Error messages don't leak data
- [ ] Rate limiting on auth endpoints (future)

---

## 📚 Code Structure Example

```typescript
// backend/src/games/Chess.ts
import { GameBase, GameOverResult, ValidationResult } from './GameBase'

export class Chess extends GameBase {
  protected gameType = 'chess'
  
  // Override abstract methods
  validateMove(gameState, move) { /* ... */ }
  applyMove(gameState, move) { /* ... */ }
  isGameOver(gameState) { /* ... */ }
  getPossibleMoves(gameState, playerIndex) { /* ... */ }
  
  // Private helper methods
  private isValidSquare(square: string): boolean { /* ... */ }
  private isKingInCheck(gameState, color): boolean { /* ... */ }
  private isCheckmate(gameState, color): boolean { /* ... */ }
}

// backend/src/controllers/gameController.ts
export async function makeMove(req, res) {
  const { gameId, move } = req.body
  
  // Get game from Redis (fast)
  const game = await redis.get(`game:${gameId}`)
  
  // Get game logic class
  const gameLogic = GameFactory.create(game.gameType, game)
  
  // Validate (server-side!)
  const validation = gameLogic.validateMove(game.gameState, move)
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.reason })
  }
  
  // Apply move
  const newGameState = gameLogic.applyMove(game.gameState, move)
  game.gameState = newGameState
  game.moveHistory.push({ ...moveData })
  
  // Save to Redis (instant)
  await redis.set(`game:${gameId}`, game)
  
  // Save to MongoDB (background)
  await mongodb.games.updateOne(
    { _id: gameId },
    { gameState: newGameState, moveHistory: game.moveHistory }
  )
  
  // Broadcast to all players
  io.to(gameId).emit('moveMade', { gameState: newGameState, ... })
  
  // Check for game over
  const result = gameLogic.isGameOver(newGameState)
  if (result.isGameOver) {
    // End game, update stats, broadcast gameOver
  }
  
  res.json({ success: true })
}
```

---

## 🎓 Learning Resources for Complex Parts

**Chess Validation:**
- Wikipedia: Chess rules
- chess.js library (for reference): https://github.com/jhlywa/chess.js

**Real-time Architecture:**
- Socket.io docs: https://socket.io/docs/v4/
- Redis for caching: https://redis.io/docs/data-types/
- MongoDB replication: https://docs.mongodb.com/manual/replication/

**Game Theory:**
- Minimax algorithm (for future AI opponent)
- Elo rating system (for future rankings)

---

## 🎯 Success Metrics

By the end of development:
- [ ] 5+ games implemented
- [ ] 100+ concurrent players can play
- [ ] <10ms move latency
- [ ] 99%+ uptime
- [ ] Sub-second resume times
- [ ] Zero unplayed moves
- [ ] <$7/month operating cost

---

## 📞 When to Use Claude Code vs Codex

**Use Claude Code for:**
- Complex game logic (Chess rules, Uno card handling)
- Architecture decisions
- Debugging Socket.io issues
- Performance optimization

**Use Codex CLI for:**
- Generating boilerplate (Express routes, MongoDB schemas)
- File creation
- Repetitive code generation
- Project scaffolding

**Use plain Claude for:**
- Brainstorming
- Explaining concepts
- Code review
- Planning

---

**Remember:** 
- ✅ Validate moves on server, always
- ✅ Broadcast to all players in room
- ✅ Save to MongoDB immediately (source of truth)
- ✅ Cache hot data in Redis
- ✅ Test locally before deploying
- ✅ Start simple (Tic Tac Toe), then expand

Good luck! You've got this. 🚀
