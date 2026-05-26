# Multiplayer Games Server - Setup & Quick Reference

## 🎮 Project Overview

A real-time multiplayer platform supporting multiple board and card games (Chess, Checkers, Tic Tac Toe, Uno, President) with persistent game state, allowing users to play across the internet and resume games anytime.

**Tech Stack:** MERN + TypeScript | Socket.io | Docker | AWS EC2 t4g.micro | Vercel  
**Domain:** penguincookie.ca  
**GitHub:** https://github.com/ahmadcookie8/Games-Arena  
**Cost:** Free (12 months), then ~$6-7/month

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Node.js v18+
- Docker & Docker Compose
- Git

### Local Development

```bash
# Clone and navigate
git clone https://github.com/ahmadcookie8/Games-Arena.git
cd Games-Arena

# Backend
cd backend
cp .env.example .env
# Edit .env: Add your MongoDB URI and Redis URL
npm install
docker-compose up -d    # Start MongoDB + Redis
npm run dev             # Start Node.js server (http://localhost:3000)

# Frontend (in new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev             # Start React (http://localhost:5173)
```

**That's it!** Open http://localhost:5173 in your browser.

---

## 📋 Checklist: What You Need to Set Up

### Before You Start
- [ ] **GitHub Account** - for code repository
- [ ] **MongoDB Atlas Free Account** - https://www.mongodb.com/cloud/atlas
  - Create a cluster (free tier)
  - Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/multiplayer-games`
- [ ] **Docker Desktop** - https://www.docker.com/products/docker-desktop/
- [ ] **AWS Account** - https://aws.amazon.com (for EC2 later)
- [ ] **Vercel Account** - https://vercel.com (for frontend hosting)

### Local Development (Week 1)
- [ ] Clone repository
- [ ] Create `.env` files (backend & frontend)
- [ ] Install Node.js dependencies
- [ ] Start Docker containers (MongoDB + Redis)
- [ ] Run backend and frontend locally
- [ ] Test Socket.io connection
- [ ] Create first game (Tic Tac Toe)

### Production Deployment (Week 3+)
- [ ] Launch AWS EC2 t4g.micro instance
- [ ] Configure EC2 security groups & SSH access
- [ ] Install Docker on EC2
- [ ] Set up GitHub Actions secrets
- [ ] Configure Vercel environment variables
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to EC2
- [ ] Point domain to EC2

---

## 📁 Project Structure

```
multiplayer-games/
├── frontend/                    # React + TypeScript
│   ├── src/
│   │   ├── pages/              # Dashboard, GameBoard, Auth, etc.
│   │   ├── components/         # Game boards, UI components
│   │   ├── hooks/              # useSocket, useGameState
│   │   ├── types/              # TypeScript interfaces
│   │   └── App.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .env.example
│
├── backend/                     # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── games/              # Game logic (Chess.ts, Uno.ts, etc.)
│   │   ├── models/             # MongoDB schemas
│   │   ├── routes/             # API endpoints
│   │   ├── services/           # Business logic
│   │   ├── types/              # TypeScript interfaces
│   │   ├── middleware/         # Auth, error handling
│   │   ├── utils/              # Redis, MongoDB setup
│   │   └── server.ts           # Main Express app
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── docker-compose.yml      # MongoDB + Redis setup
│   ├── .env.example
│   └── README.md
│
├── .github/
│   └── workflows/              # GitHub Actions CI/CD
│       ├── deploy-frontend.yml
│       └── deploy-backend.yml
│
└── MULTIPLAYER_GAMES_PROJECT_SPEC.md  # Full technical spec
```

---

## ⚙️ Environment Variables

### Backend (backend/.env)

```bash
# Server
NODE_ENV=development
PORT=3000

# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/multiplayer-games?retryWrites=true&w=majority

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-super-secret-key-change-this-in-production

# CORS
CORS_ORIGIN=http://localhost:5173

# Logging
LOG_LEVEL=debug
```

**Getting MongoDB URI:**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Click "Connect" → "Drivers"
4. Copy connection string
5. Replace `<password>` with your actual password

### Frontend (frontend/.env)

```bash
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
VITE_ENV=development
```

---

## 🐳 Docker Commands

```bash
# Start services (MongoDB + Redis)
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f redis
docker-compose logs -f node

# Rebuild images
docker-compose build

# Remove all volumes (WARNING: deletes data)
docker-compose down -v
```

---

## 🔧 Common Commands

```bash
# Backend
npm run dev              # Start with hot reload
npm run build            # Compile TypeScript
npm run start            # Run compiled code
npm run test             # Run tests
npm run lint             # Check code style

# Frontend
npm run dev              # Start Vite dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run test             # Run tests
npm run lint             # Check code style
```

---

## 🌐 API Endpoints

### Authentication
```
POST   /api/auth/signup          # Create account (username only)
POST   /api/auth/login           # Login
GET    /api/auth/me              # Get current user (protected)
```

### Games
```
POST   /api/games/create         # Create new game
GET    /api/games                # List all games (active, completed)
GET    /api/games/:gameId        # Get specific game
POST   /api/games/:gameId/join   # Join game by code
POST   /api/games/:gameId/resign # Resign from game
GET    /api/games/:gameId/resume # Resume paused game
GET    /api/games/:gameId/history# Get move history
```

### Users & Stats
```
GET    /api/users/:userId        # Get user profile
GET    /api/users/:userId/stats  # Get user statistics
GET    /api/leaderboards         # Get global leaderboards
GET    /api/leaderboards/:type   # Get leaderboard for game type
```

### Health
```
GET    /api/health               # Health check (MongoDB, Redis status)
```

---

## 🔌 Socket.io Events

### Main Game Events

```javascript
// Player creates game
socket.emit('createGame', { gameType: 'chess' })

// Player joins game
socket.emit('joinGame', { gameCode: 'ABC123' })

// Make a move
socket.emit('makeMove', { gameId: 'xyz', move: 'e2-e4' })

// Receive move from opponent
socket.on('moveMade', (data) => { ... })

// Game over
socket.on('gameOver', (data) => { ... })

// Pause game
socket.emit('pauseGame', { gameId: 'xyz' })

// Resume game
socket.emit('resumeGame', { gameId: 'xyz' })

// Get full game state (on reconnect)
socket.emit('getGameState', { gameId: 'xyz' })
```

---

## 🎮 Supported Games

### Phase 1 (MVP)
- ✅ **Tic Tac Toe** - Simple 3x3 grid
- ✅ **Chess** - Full rules, move validation, checkmate detection
- ✅ **Checkers** - Jump, king, capture rules

### Phase 2 (Week 4+)
- 🔄 **Uno** - 4 players, action cards, draw mechanics
- 🔄 **President** - 5+ players, ranking system

---

## 📊 Database Schema Overview

### MongoDB Collections

**Users**
```javascript
{
  _id: ObjectId,
  username: string,
  createdAt: Date,
  stats: {
    gamesPlayed: number,
    gamesWon: number,
    gamesLost: number,
    winRate: number
  }
}
```

**Games**
```javascript
{
  _id: ObjectId,
  gameType: string,
  status: 'active' | 'completed' | 'paused',
  players: Array,
  gameState: any,           // Board, hands, etc.
  moveHistory: Array,
  createdAt: Date,
  lastMoveAt: Date
}
```

**Game Snapshots** (for fast resume)
```javascript
{
  _id: ObjectId,
  gameId: ObjectId,
  gameState: any,
  moveNumber: number,
  createdAt: Date
}
```

### Redis Keys

```
game:{gameType}:{gameId}     # Active game state
session:{userId}:{socketId}  # Player session
online:users                 # Set of online users
leaderboard:{gameType}       # Sorted leaderboard
stats:{userId}               # Cached user stats
```

---

## 🚀 Deployment Steps

### Step 1: Set Up AWS EC2

```bash
# 1. Go to AWS Console → EC2 → Launch Instance
# 2. Select t4g.micro (free tier eligible)
# 3. Select Ubuntu 22.04 LTS
# 4. Create new security group:
#    - Allow SSH (port 22) from your IP
#    - Allow HTTP (port 80) for Let's Encrypt
#    - Allow HTTPS (port 443) for SSL
#    - Allow TCP 3000 from 0.0.0.0 (or Vercel IPs)
# 5. Create key pair, save .pem file
# 6. Launch instance

# Connect to instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker $USER

# Clone repo
git clone https://github.com/yourusername/multiplayer-games.git
cd multiplayer-games/backend

# Create .env with production values
nano .env
# Add:
# MONGODB_URI=<your-atlas-uri>
# JWT_SECRET=<long-random-secret>
# NODE_ENV=production
# CORS_ORIGIN=https://yourdomain.com

# Start services
docker-compose up -d

# Verify
curl http://localhost:3000/api/health
```

### Step 2: Set Up Vercel (Frontend)

```bash
# 1. Go to https://vercel.com and sign in with GitHub
# 2. Click "New Project"
# 3. Import your GitHub repository
# 4. Select "frontend" folder as root
# 5. Add environment variables:
#    VITE_API_URL=https://your-ec2-domain.com
#    VITE_SOCKET_URL=https://your-ec2-domain.com
# 6. Deploy

# Or use CLI
npm i -g vercel
cd frontend
vercel
```

### Step 3: Set Up Domain & SSL

```bash
# 1. Buy domain (Namecheap, Route53, etc.)
# 2. Point domain to EC2 IP using A record
# 3. Update CORS_ORIGIN in backend .env
# 4. Install Certbot for free SSL:
sudo apt install certbot python3-certbot-nginx -y
sudo certbot certonly --standalone -d yourdomain.com
```

### Step 4: GitHub Actions

```bash
# 1. Go to GitHub repo → Settings → Secrets
# 2. Add secrets:
#    EC2_HOST=your-ec2-ip
#    EC2_SSH_KEY=<your-private-ssh-key-content>
#    DOCKER_HUB_USERNAME=<your-docker-username>
#    DOCKER_HUB_PASSWORD=<your-docker-password>
#    VERCEL_TOKEN=<your-vercel-token>
#    VERCEL_ORG_ID=<your-org-id>
#    VERCEL_PROJECT_ID=<your-project-id>

# 3. Push to main branch
git push origin main

# 4. Watch GitHub Actions deploy automatically
```

---

## 🧪 Testing Locally

### Test Backend Health

```bash
# Check if server is running
curl http://localhost:3000/api/health

# Expected response:
# {
#   "status": "ok",
#   "uptime": 3600,
#   "mongodb": "connected",
#   "redis": "connected"
# }
```

### Test Socket.io

```bash
# Install socket.io-client CLI (optional)
npm install -g socket.io-client

# Or test in browser console:
# Go to http://localhost:5173
# Open DevTools → Console
# Manually create a game
```

### Create First Game

```bash
# 1. Sign up (username only)
# 2. Create Tic Tac Toe game
# 3. Get game code
# 4. Open in new browser window
# 5. Join with code
# 6. Play!
```

---

## 🆘 Troubleshooting

### "Cannot connect to MongoDB"
```bash
# Check MongoDB Atlas
# 1. Go to MongoDB Atlas dashboard
# 2. Verify connection string is correct
# 3. Check IP whitelist (allow 0.0.0.0 for development)
# 4. Verify .env has correct URI
```

### "Redis connection refused"
```bash
# Redis not running. Start it:
docker-compose up -d redis

# Or check if running:
docker-compose ps
```

### "Socket.io connection failed"
```bash
# Check CORS settings in backend
# Verify CORS_ORIGIN matches frontend URL
# Check firewall isn't blocking WebSockets
```

### "Frontend won't connect to backend"
```bash
# Check VITE_API_URL and VITE_SOCKET_URL in .env
# Must match backend URL (localhost:3000 for dev)
# Restart frontend after changing .env
```

### Port already in use
```bash
# Backend (3000):
lsof -i :3000
kill -9 <PID>

# MongoDB (27017):
lsof -i :27017
kill -9 <PID>

# Or change port in .env
PORT=3001
```

---

## 📈 Scaling (When You Have 100+ Players)

```bash
# 1. Increase Redis memory limit
# 2. Add database indexes to MongoDB
# 3. Use Socket.io clustering (Redis adapter)
# 4. Upgrade EC2 to t4g.small ($12/month)
# 5. Set up load balancer
```

---

## 💰 Cost Tracker

| Service | Cost | When |
|---------|------|------|
| AWS EC2 t4g.micro | $0 | First 12 months (free tier) |
| MongoDB Atlas | $0 | Always (free tier) |
| Redis | $0 | Included in EC2 |
| Vercel | $0 | Free tier usually sufficient |
| Domain | ~$1/month | Optional |
| **Total Year 1** | **~$0** | Free! |
| **Total Year 2+** | **~$6-7/month** | EC2 only |

---

## 📚 Learning Resources

- **Socket.io:** https://socket.io/docs/v4/
- **Express.js:** https://expressjs.com/
- **React:** https://react.dev
- **MongoDB:** https://docs.mongodb.com
- **Redis:** https://redis.io/docs
- **TypeScript:** https://www.typescriptlang.org/docs

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-game-type`
2. Implement game logic in `backend/src/games/`
3. Test locally
4. Push and create pull request

---

## 📝 File Checklist

Before deploying, ensure you have:

- [ ] `backend/.env` (with MongoDB URI)
- [ ] `frontend/.env` (with API URL)
- [ ] `.github/workflows/deploy-frontend.yml`
- [ ] `.github/workflows/deploy-backend.yml`
- [ ] `docker-compose.yml` in backend
- [ ] `Dockerfile` in backend
- [ ] `Dockerfile` in frontend (optional for Vercel)

---

## 🎯 Next Steps

1. **Week 1:** Local development, test Tic Tac Toe
2. **Week 2:** Add Chess game logic
3. **Week 3:** Deploy to AWS EC2 + Vercel
4. **Week 4:** Add Uno game
5. **Week 5+:** Add features (chat, stats, leaderboards)

---

## 📞 Support

Stuck? Check:
1. Backend logs: `docker-compose logs -f node`
2. Browser console (F12)
3. Full spec: `MULTIPLAYER_GAMES_PROJECT_SPEC.md`
4. GitHub issues in your repo

---

**Last Updated:** May 26, 2026  
**Status:** Ready to develop  
**Good luck! 🚀**
