# Multiplayer Games Server - Quick Reference Card

## 🎯 Project Summary
**Real-time multiplayer games platform** (Chess, Uno, Checkers, etc.)  
**Play with your brother across the internet & resume games anytime**

**Domain:** penguincookie.ca  
**GitHub:** https://github.com/ahmadcookie8/Games-Arena

---

## 📦 Tech Stack at a Glance

```
Frontend: React 18 + TypeScript + Vite → Vercel
Backend: Node.js + Express + Socket.io → AWS EC2 t4g.micro ($6/mo)
Database: MongoDB Atlas (free tier)
Cache: Redis (in Docker)
Real-time: WebSockets via Socket.io
```

---

## 🚀 Get Started (5 Min)

```bash
# Backend
cd backend && npm install && docker-compose up -d && npm run dev

# Frontend (new terminal)
cd frontend && npm install && npm run dev

# Visit http://localhost:5173
```

---

## 📋 Core Concepts

| Concept | Where | What |
|---------|-------|------|
| **Game Logic** | `backend/src/games/Chess.ts` | Rules, move validation |
| **Socket.io** | Backend & Frontend | Real-time sync between players |
| **MongoDB** | Cloud | Permanent storage (games, users) |
| **Redis** | Docker on EC2 | Fast cache for active games |
| **Move Flow** | Client → Server → Redis/MongoDB → Broadcast |  Validate → Apply → Save → Sync |

---

## 🔌 Key Socket.io Events

```javascript
// Create game
socket.emit('createGame', { gameType: 'chess' })

// Make move
socket.emit('makeMove', { gameId: 'xyz', move: 'e2-e4' })

// Receive opponent's move
socket.on('moveMade', (data) => { ... })

// Game ends
socket.on('gameOver', (data) => { ... })

// Resume paused game
socket.emit('resumeGame', { gameId: 'xyz' })
```

---

## 🗄️ Key Data Structures

**MongoDB Game Document**
```json
{
  "gameType": "chess",
  "status": "active",
  "players": [{ "userId", "username" }],
  "gameState": { "board": [...] },
  "moveHistory": [{ "move": "e2-e4" }],
  "lastMoveAt": "2026-05-26T10:30:00Z"
}
```

**Redis Active Game**
```
Key: "game:chess:abc123"
Value: { currentTurnIndex, gameState, players }
```

---

## 🎮 Game Implementation Template

```typescript
// 1. Create class extending GameBase
class MyGame extends GameBase {
  
  // 2. Validate move (server-side, always!)
  validateMove(gameState, move) {
    if (!isLegal) return { isValid: false, reason: '...' }
    return { isValid: true }
  }
  
  // 3. Apply move (return new state, don't mutate)
  applyMove(gameState, move) {
    const newState = JSON.parse(JSON.stringify(gameState))
    // ... apply move logic ...
    return newState
  }
  
  // 4. Detect game over
  isGameOver(gameState) {
    if (winner) return { isGameOver: true, winner: 0 }
    return { isGameOver: false }
  }
}
```

---

## 📡 Move Flow (Critical!)

```
1. Player clicks square
   ↓
2. Frontend validates (client-side, for UI only)
   ↓
3. emit('makeMove', move) → Server
   ↓
4. Server validates (SERVER-SIDE, REAL VALIDATION!)
   ↓
5. Server applies move to game state
   ↓
6. Save to Redis (instant)
   Save to MongoDB (async)
   ↓
7. Broadcast to ALL players: io.to(gameId).emit('moveMade', newState)
   ↓
8. Both players receive and update UI
```

**CRITICAL:** Always validate on server. Never trust client.

---

## 🔐 Authentication Flow

```
1. User enters username
2. POST /api/auth/signup
3. Server creates User in MongoDB
4. Server generates JWT token
5. Frontend stores token in localStorage
6. Token sent in every request header
7. Middleware verifies JWT on protected routes
```

---

## 📊 Database Queries You'll Need

```javascript
// Find user
db.users.findOne({ username: "ahmad" })

// Update user stats
db.users.updateOne(
  { _id: userId },
  { $set: { "stats.gamesWon": 25, "stats.gamesLost": 5 } }
)

// Get user's games
db.games.find({ "players.userId": userId }).sort({ createdAt: -1 })

// Get leaderboard
db.users.find({}).sort({ "stats.gamesWon": -1 }).limit(10)
```

---

## 🧪 Testing Checklist

- [ ] Tic Tac Toe: 2 players can play, game ends correctly
- [ ] Refresh page → game state persists
- [ ] Chess: Valid moves only, checkmate detected
- [ ] Disconnect & reconnect → state restored
- [ ] Close browser, reopen days later → resume game works
- [ ] Leaderboard updates after game
- [ ] 4 players in Uno → all see same state
- [ ] No duplicate moves in history

---

## 🚀 Deployment Checklist

- [ ] Backend: `docker-compose up -d` on EC2
- [ ] Frontend: Deployed to Vercel
- [ ] Domain points to EC2
- [ ] SSL certificate installed
- [ ] GitHub Actions secrets configured
- [ ] MongoDB Atlas connection works
- [ ] Health check passing
- [ ] Can create & play game on production

---

## 💾 Files to Create First

**Backend**
```
src/games/GameBase.ts
src/games/TicTacToe.ts
src/models/User.ts
src/models/Game.ts
src/routes/auth.ts
src/routes/games.ts
src/server.ts
```

**Frontend**
```
src/pages/Dashboard.tsx
src/pages/GameBoard.tsx
src/pages/Auth.tsx
src/components/TicTacToeBoard.tsx
src/hooks/useSocket.ts
src/types/game.ts
```

---

## 🆘 Debug Commands

```bash
# Check MongoDB
mongosh "mongodb+srv://..."

# Check Redis
redis-cli KEYS '*'
redis-cli GET "game:chess:abc123"

# Check backend logs
docker-compose logs -f node

# Check frontend logs
Open DevTools (F12) → Console

# Test API
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/auth/signup -d '{"username":"test"}'

# Test Socket.io
# Open http://localhost:5173 and check Network tab
```

---

## 📈 Performance Targets

| Metric | Target | Why |
|--------|--------|-----|
| Move latency | <10ms | Feels instant |
| Create game | <1s | Good UX |
| Resume game | <2s | Acceptable |
| Concurrent games | 100+ | Plenty for MVP |
| Redis memory | <100MB | Fits t4g.micro |
| MongoDB query | <50ms | Acceptable |

---

## 💰 Cost Reality

| Timeline | EC2 Cost | Total |
|----------|----------|-------|
| Year 1 | $0 (free tier) | ~$0 |
| Year 2+ | $6.13/mo | ~$73/year |
| With reserved instance | $3.58/mo | ~$43/year |

*MongoDB Atlas & Redis: Always free for this project*

---

## 🎯 Priority Timeline

| Week | Deliverable | Status |
|------|-------------|--------|
| 1 | Backend + Tic Tac Toe | 👶 Start here |
| 2 | Chess + React UI | 📈 Growing |
| 3 | Deployment + Polish | 🚀 Ship it |
| 4+ | Uno, President, Features | 🌟 Level up |

---

## 🔗 Essential Links

- **MongoDB Atlas:** https://cloud.mongodb.com
- **AWS EC2:** https://console.aws.amazon.com/ec2
- **Vercel:** https://vercel.com
- **Socket.io Docs:** https://socket.io/docs/v4/
- **Express Docs:** https://expressjs.com/
- **React Docs:** https://react.dev

---

## 🚨 Golden Rules

1. **Always validate moves on server**
   - Never trust client input
   - Server is source of truth

2. **Broadcast to ALL players**
   - `io.to(gameId).emit()` not `socket.emit()`
   - Use Socket.io rooms

3. **Save to MongoDB immediately**
   - Database is permanent record
   - Redis is optional cache

4. **Handle disconnects gracefully**
   - Mark player offline
   - Allow reconnect within timeout

5. **Deep copy game state**
   - Don't mutate original
   - `JSON.parse(JSON.stringify())` or lodash clone

6. **Use Redis for hot data**
   - Active games
   - Player sessions
   - Leaderboards

---

## 🎓 If Stuck On...

**Chess move validation:** Check `chess.js` library or Wikipedia  
**Socket.io broadcast:** Use `io.to(gameId).emit()`  
**MongoDB schema:** Look at `User.ts` as template  
**Redux/State:** Use Zustand (simpler than Redux)  
**TypeScript:** Use `any` to unblock, then type later  
**Docker:** Check `docker-compose logs -f`  
**Deployment:** Follow README_SETUP.md step-by-step  

---

## 📞 Quick Support

**Problem** → **Solution**  
"Can't connect to MongoDB" → Check connection string in .env  
"Socket.io not working" → Check CORS_ORIGIN  
"Port already in use" → `lsof -i :3000` then `kill -9`  
"Can't resume game" → Check moveHistory completeness  
"Pieces not rendering" → Check component is imported  
"Game won't end" → Debug `isGameOver()` logic  

---

## ✨ Pro Tips

1. **Test in 2 browser windows** - Open same game in 2 windows to see real-time sync
2. **Watch Redis keys** - `redis-cli MONITOR` to see what's happening
3. **Log everything initially** - Remove later, helps debugging now
4. **Start with Tic Tac Toe** - Fastest way to validate architecture
5. **Use Postman for API testing** - Before testing in UI
6. **Commit often** - Every working feature, even if small
7. **Deploy early** - EC2 setup on day 1, not day 15

---

**You've got a comprehensive project plan. Start building! 🚀**

**Next step:** Read `MULTIPLAYER_GAMES_PROJECT_SPEC.md` for full details
