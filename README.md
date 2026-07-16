# Games Arena 🎮

A real-time multiplayer games platform where you can play **Chess, Checkers, Tic Tac Toe, Uno, President**, and more with friends online. Play anytime, pause mid-game, and resume days later—your game is always saved.

**Live:** [games.penguincookie.ca](https://games.penguincookie.ca)

## What is Games Arena?

Games Arena is a full-featured online gaming platform that brings the classic experience of board games and card games to the web. Whether you want a quick game of Tic Tac Toe or a serious chess match, you can play in real-time with low latency (<10ms), and your game progress is automatically saved.

### Key Features

- ✅ **2-5+ Players Per Game** — Real-time WebSocket synchronization
- ✅ **Multiple Game Types** — Chess, Checkers, Tic Tac Toe, Uno, President (with more coming)
- ✅ **Persistent Game State** — All games saved to MongoDB; never lose your progress
- ✅ **Resume Anytime** — Pause a game, close your browser, come back weeks later and pick up exactly where you left off
- ✅ **Move History & Replay** — See every move ever made in a game; review games to analyze strategy
- ✅ **Player Statistics** — Track your wins, losses, and win rates across all games
- ✅ **Leaderboards** — Global rankings for each game type; see how you stack up against others
- ✅ **Disconnect Resilience** — Temporary connection loss? No problem—rejoin within minutes without losing your place
- ✅ **Mobile Friendly** — Play on desktop or mobile with a responsive design

## How It Works

### The Game Loop

```
1. Create or join a game via share code
2. Play in real-time (moves sync instantly to all players)
3. Game state is saved to MongoDB after every move
4. Leave anytime—your game is preserved
5. Come back days later and resume exactly where you left off
```

### Technical Highlights

- **Real-time Sync:** WebSockets keep all players in-sync with <10ms latency
- **Scalable:** Handles 100+ concurrent games on affordable infrastructure (~$6/month)
- **Reliable:** Every move is validated on the server and persisted to the database
- **Resilient:** Players can disconnect and reconnect mid-game without losing their place

## Tech Stack

### Frontend
- **React 18** + **TypeScript** for type-safe UI development
- **Vite** for lightning-fast builds and development
- **Socket.io Client** for real-time communication
- **Zustand** for lightweight state management
- **Tailwind CSS** for responsive styling
- **Deployed on:** Vercel (free tier)

### Backend
- **Node.js** + **Express** + **TypeScript** for the REST API
- **Socket.io** for real-time WebSocket connections
- **MongoDB Atlas** (free tier) for persistent game storage
- **Redis** (Docker) for caching active games and sessions
- **Signed HttpOnly JWT cookies** with per-user session revocation
- **Deployed on:** AWS EC2 t4g.micro (~$6-7/month after free tier)

### Infrastructure
```
Frontend (Vercel)
      ↓ HTTPS + WebSocket
Backend (AWS EC2)
  ├─ Redis (Docker)    ← Fast cache for active games
  └─ Node.js/Express   ← API + WebSocket server
      ↓
MongoDB Atlas ← Persistent game storage
```

## Supported Games

### MVP (Core Games)
- **Chess** — Full move validation (castling, en passant, check/checkmate detection)
- **Tic Tac Toe** — Quick, simple, perfect for testing real-time sync

### Phase 2 (Coming Soon)
- **Checkers** — Jump rules, king promotion, piece capture validation
- **Uno** — Card deck management, action cards (Skip, Reverse, Draw 2), color selection
- **President** — Multi-player card game with role-based mechanics

## Local Development

### Prerequisites
- Node.js v18+
- Docker Desktop (for Redis)
- MongoDB Atlas account (free)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI
docker compose up -d redis
npm run dev
```

Backend runs at `http://localhost:3000`. Health check: `GET http://localhost:3000/api/health`

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs at `http://localhost:5173`

### Verify Everything Works

```bash
cd backend && npm run build
cd frontend && npm run build
```

## Project Structure

```
Games-Arena/
├── backend/                    # Node.js + Express server
│   ├── src/
│   │   ├── games/             # Game logic (Chess.ts, Uno.ts, etc.)
│   │   ├── models/            # MongoDB schemas (User, Game, GameSnapshot)
│   │   ├── routes/            # API endpoints
│   │   ├── controllers/       # Business logic
│   │   ├── services/          # Reusable services (Redis, MongoDB)
│   │   ├── middleware/        # Auth, error handling
│   │   ├── types/             # Shared TypeScript types
│   │   └── server.ts          # Express + Socket.io setup
│   └── package.json
│
├── frontend/                   # React + TypeScript UI
│   ├── src/
│   │   ├── pages/             # Dashboard, GameBoard, Auth, History
│   │   ├── components/        # Game boards, leaderboards, move history
│   │   ├── hooks/             # useSocket, useGameState, useAuth
│   │   ├── lib/               # Game rules, API client, Socket.io setup
│   │   ├── types/             # Shared types
│   │   └── App.tsx
│   └── package.json
│
├── getting_started/           # Comprehensive documentation
│   ├── 00_START_HERE.md       # Project overview & roadmap
│   ├── README_SETUP.md        # Setup & deployment guide
│   ├── MULTIPLAYER_GAMES_PROJECT_SPEC.md  # Complete technical spec
│   └── DEVELOPER_HANDOFF.md   # Implementation guide
│
└── README.md                  # This file
```

## API Overview

### Authentication
- `POST /api/auth/signup` — Create an account with username, password, and optional email
- `POST /api/auth/login` — Log in and receive the HttpOnly session cookie
- `GET /api/auth/me` — Get current user
- `POST /api/auth/logout` — Revoke all current sessions and clear the cookie

### Games
- `POST /api/games/create` — Create a new game
- `GET /api/games` — List all your games (active, waiting, completed)
- `POST /api/games/join` — Join a game via share code
- `GET /api/games/:gameId` — Get game details and current state
- `POST /api/games/:gameId/single-player/replay` — Verify a completed Snake or Maze Chase input replay
- `POST /api/games/:gameId/resign` — Resign from a game
- `GET /api/games/:gameId/history` — Get move history

### Statistics
- `GET /api/users/:userId/stats` — Get player stats
- `GET /api/leaderboards/:gameType` — Get leaderboard for a game type
- `GET /api/leaderboards/single-player/:gameType` — Get verified solo rankings
- `GET /api/leaderboards` — Get all leaderboards

## Real-time Events (Socket.io)

The authenticated client may emit only `joinRoom`, `makeMove`, and
`sendChatMessage`. Every payload is runtime validated and every operation uses
the unified acknowledgement envelope. Participant-specific updates arrive as
`gameUpdated`, `moveMade`, `gameOver`, `gamesChanged`, and `chatMessage`.

Snake and Maze Chase use the shared deterministic game engine and a server-issued
seed. Public solo rankings include only bounded input replays that the server can
reproduce; legacy or interrupted runs remain visible as explicitly unranked history.

## Deployment

Games Arena is deployed on:

- **Frontend:** Vercel (free tier)
  - Vercel's Git integration builds and deploys the `frontend/` project from `main`; there is no separate GitHub Actions frontend deployment
  - Domain: `https://games.penguincookie.ca`
  - Production environment variables point `VITE_API_URL` and `VITE_SOCKET_URL` at `https://api.penguincookie.ca`
  - `https://games-arena.penguincookie.ca` is a retired/parked hostname and must not be used for auth, CORS, or frontend environment variables

- **Backend:** AWS EC2 t4g.micro
  - Cost: ~$6-7/month after 12-month free tier
  - Database: MongoDB Atlas (free tier, 5GB storage)
  - Cache: Redis (Docker container)

Pull-request CI is intentionally lean. It can also be started manually, and runs the locked Node 24 installs, shared game-engine tests, the backend non-stress test suite and build, and the frontend build. The longer randomized stress test, frontend unit and browser suites, lint, audits, visual checks, real-service multiplayer journeys, and broad repository/container security scans remain available as local or manual checks; they are not represented as automatic gates on every pull request. CodeQL is manual-only.

The backend release workflow builds a commit-addressed Docker image, resolves its immutable registry digest, and deploys that exact digest to the existing EC2 Compose stack. Deployment is an in-place recreation of the service bound to `127.0.0.1:3000`, so a short API/WebSocket interruption is expected while the container is replaced. The workflow serializes production deployments, preserves the previous image reference, verifies the application health check, and restores the previous image if the candidate does not become healthy. This is not an active blue/green deployment.

The older blue/green scripts and Nginx slot-switching utilities remain in `backend/deploy/` for reference and possible future use, but the production workflow does not call or install them. Nginx continues to proxy `api.penguincookie.ca` to the single Compose service on `127.0.0.1:3000`.

Required production secrets are `DOCKER_HUB_USERNAME`, `DOCKER_HUB_PASSWORD`, `EC2_HOST`, `EC2_SSH_KEY`, and `EC2_KNOWN_HOSTS`. Capture the known-hosts entry through a trusted administrative channel; do not populate it with an unverified key scan during deployment. Install the versioned `backend/deploy/nginx-api.conf` on the host when the API proxy configuration changes.

Before the first hardened release, schedule a maintenance window, verify a MongoDB backup, run `npm run security:migrate` in report-only mode, and review its counts. Writes require the explicit `-- --apply --backup-confirmed` guard. Rotate `JWT_SECRET` (minimum 32 random bytes) during the same maintenance window; this intentionally invalidates all existing sessions. Full rollout and verification steps are recorded in `agents.md`.

See `backend/deploy/README.md` for the current deployment and rollback procedure.

## Development Roadmap

### Phase 1: MVP (Weeks 1-2) ✅
- [x] Real-time multiplayer infrastructure
- [x] Tic Tac Toe game logic
- [x] Chess game logic
- [x] User authentication (username-based)
- [x] Game persistence & resume

### Phase 2: Expansion (Weeks 3-4)
- [ ] Checkers game
- [ ] Uno game
- [ ] President game
- [ ] In-game chat
- [ ] Game invitations

### Phase 3: Polish & Features (Week 5+)
- [ ] ELO rating system
- [ ] Spectator mode
- [ ] Game replay animations
- [ ] Achievement badges
- [ ] Dark mode
- [ ] Mobile app (React Native)

## Documentation

Comprehensive documentation is available in the `getting_started/` directory:

- **00_START_HERE.md** — Start here! Project overview, architecture, and quick start checklist
- **README_SETUP.md** — Detailed setup instructions for local development and deployment
- **MULTIPLAYER_GAMES_PROJECT_SPEC.md** — Complete technical specification (database schemas, API routes, Socket.io events, game implementations)
- **DEVELOPER_HANDOFF.md** — Step-by-step implementation guide with priorities and common pitfalls

## Why This Project is Cool

✅ **Full-Stack:** Frontend, backend, database, DevOps  
✅ **Real-time Systems:** WebSockets, low-latency sync, concurrent game handling  
✅ **Complex Logic:** Game rules, move validation, state management  
✅ **Production Ready:** Deployed on real infrastructure with monitoring  
✅ **Portfolio Worthy:** A complete product you can show in interviews  
✅ **Scalable:** Handles 100+ concurrent games on affordable servers  

This project demonstrates all the skills companies care about: system design, full-stack development, DevOps, and real-world problem-solving.

## Contributing

This is an active development project. To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -am 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

## License

MIT License — feel free to use this project as inspiration for your own multiplayer games platform!

## Contact

- **Project Owner:** Ahmad Sheikh
- **Website:** [games.penguincookie.ca](https://games.penguincookie.ca)
- **GitHub:** [ahmadcookie8/Games-Arena](https://github.com/ahmadcookie8/Games-Arena)

---

**Ready to get started?** Head to the `getting_started/` directory and start with `00_START_HERE.md`! 🚀
