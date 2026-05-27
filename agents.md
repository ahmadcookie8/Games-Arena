# Agents Guide

This file is a compact handoff for Codex or any future agent picking up the repo.
It reflects the current codebase, not just the original spec docs.

## Project Identity

Games Arena is a multiplayer game platform with a React frontend and an Express/Socket.io backend.
The original docs in `getting_started/` describe a broader multi-game platform, but the current live implementation is focused on:

- Cookie-based auth with optional email
- Live multiplayer Tic Tac Toe
- Dashboard/lobby updates over Socket.io
- MongoDB for persistence
- Redis for caching

## Current Product Goal

The app should let a user:

1. Sign up with `username`, `password`, and optional `email`
2. Log in with either username or email plus password
3. Stay logged in via an HttpOnly JWT cookie
4. Create or join a Tic Tac Toe game
5. See game/player state update live without refreshing
6. Resume the last logged-in session after a browser refresh

Non-Tic-Tac-Toe games still exist in code, but the UI currently exposes only Tic Tac Toe.

## Repo Layout

### Root

- `README.md` - short project overview
- `agents.md` - this handoff file
- `getting_started/` - original setup/spec docs
- `backend/` - API, sockets, persistence, game logic
- `frontend/` - Vite React app

### Backend

Important folders and files:

- `backend/src/server.ts` - Express app, Socket.io server, socket auth, room joins, move handling
- `backend/src/controllers/authController.ts` - signup, login, me, logout
- `backend/src/controllers/gameController.ts` - REST game endpoints
- `backend/src/services/gameService.ts` - create/join/resume/move logic
- `backend/src/services/socketNotifier.ts` - central socket emit helper
- `backend/src/models/User.ts` - Mongo user schema
- `backend/src/models/Game.ts` - Mongo game schema
- `backend/src/models/GameSnapshot.ts` - snapshot storage
- `backend/src/games/` - game logic classes
- `backend/src/utils/authToken.ts` - JWT cookie helpers
- `backend/src/utils/validators.ts` - Zod request validation
- `backend/src/middleware/auth.ts` - JWT auth middleware
- `backend/src/middleware/errorHandler.ts` - API error shaping

### Frontend

Important folders and files:

- `frontend/src/App.tsx` - routes and protected route wrapper
- `frontend/src/pages/Auth.tsx` - login/signup form
- `frontend/src/pages/Dashboard.tsx` - lobby, create/join, active/completed games
- `frontend/src/pages/GameBoard.tsx` - active game screen
- `frontend/src/pages/GameHistory.tsx` - history page
- `frontend/src/hooks/useAuth.ts` - auth state and `/api/auth/me` bootstrap
- `frontend/src/hooks/useSocket.ts` - socket lifecycle and event bindings
- `frontend/src/hooks/useGameState.ts` - game fetch/store
- `frontend/src/lib/api.ts` - Axios client with `withCredentials: true`
- `frontend/src/lib/socket.ts` - Socket.io client with `withCredentials: true`
- `frontend/src/components/` - game boards, player cards, move history, leaderboard
- `frontend/src/types/` - shared client types

## Current Implementation State

### Authentication

Auth is now cookie-based.

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Behavior:

- Passwords are hashed with bcrypt before storage
- Mongo stores `passwordHash`, not a plain `password`
- `email` is optional and unique when present
- Login accepts either `identifier=username` or `identifier=email`
- JWT payload stays minimal: `{ userId, username }`
- The frontend no longer relies on localStorage for auth persistence
- Session restore happens by calling `/api/auth/me` on app load

Important backend auth files:

- `backend/src/controllers/authController.ts`
- `backend/src/utils/authToken.ts`
- `backend/src/models/User.ts`
- `backend/src/utils/validators.ts`

### Game Flow

The platform currently behaves like a Tic Tac Toe MVP.

Lobby flow:

1. Frontend loads `/api/games`
2. Dashboard shows active, waiting, and completed games
3. Create game uses `POST /api/games/create`
4. Join game uses `POST /api/games/join`
5. Game page navigates to `/game/:gameId`

Live updates:

- Client emits `joinRoom` after opening a game page
- Server joins the socket to the game room and a private `user:{userId}` room
- REST actions and socket actions emit `gamesChanged`
- Game room updates come through `gameUpdated`, `moveMade`, and `gameOver`

Tic Tac Toe rules are enforced server-side in `gameService.makeTicTacToeMove()`.
The server checks:

- game exists
- game is active
- game type is Tic Tac Toe
- exactly two players are present
- player is in the game
- it is that player's turn
- the move is valid and the cell is not occupied

On each valid move, the backend:

- updates `gameState`
- appends to `moveHistory`
- advances `currentTurnIndex` and `currentTurn`
- saves to MongoDB
- updates Redis cache
- emits live socket events
- marks the game completed on win or draw

Important backend game files:

- `backend/src/services/gameService.ts`
- `backend/src/services/socketNotifier.ts`
- `backend/src/games/TicTacToe.ts`
- `backend/src/models/Game.ts`
- `backend/src/controllers/gameController.ts`

## Frontend Behavior

### Auth State

`frontend/src/hooks/useAuth.ts` is the auth source of truth on the client.

- It bootstraps user state with `/api/auth/me`
- It keeps a loading state so protected routes wait for auth restore
- Logout clears the server cookie and resets local state

### Dashboard

`frontend/src/pages/Dashboard.tsx` currently only exposes Tic Tac Toe creation.

- `GAME_TYPES` is restricted to `['ticTacToe']`
- It listens for `gamesChanged` and refetches the game list
- It shows active and completed games
- It includes a join-by-code form
- It includes leaderboard rendering

### Game Board

`frontend/src/pages/GameBoard.tsx` renders the active game view.

- It fetches game state by `gameId`
- It joins the socket room for live updates
- It listens for `gameUpdated`, `moveMade`, and `gameOver`
- It renders only the Tic Tac Toe board for now
- It shows waiting-for-player, turn status, completion state, players, and move history

Important frontend game files:

- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/GameBoard.tsx`
- `frontend/src/pages/Auth.tsx`
- `frontend/src/components/TicTacToeBoard.tsx`
- `frontend/src/components/MoveHistory.tsx`
- `frontend/src/components/PlayerCard.tsx`
- `frontend/src/components/Leaderboard.tsx`
- `frontend/src/hooks/useGameState.ts`
- `frontend/src/hooks/useSocket.ts`

## Socket Contract

Current socket events in practice:

- Client -> server: `joinRoom`
- Client -> server: `joinGame`
- Client -> server: `makeMove`
- Server -> client: `welcome`
- Server -> client: `gameUpdated`
- Server -> client: `moveMade`
- Server -> client: `gameOver`
- Server -> client: `gamesChanged`
- Server -> client: `gamePaused`

Socket auth:

- Server reads JWT from the HttpOnly cookie first
- Bearer token fallback still exists for transition/debugging
- Frontend socket client uses `withCredentials: true`

## Data Model

### User

`backend/src/models/User.ts`

- `username` unique, lowercase, trimmed
- `email` optional, lowercase, trimmed, sparse unique
- `passwordHash` required and hidden by default
- `stats`, `lastSeenAt`, `isActive`, `preferences`

### Game

`backend/src/models/Game.ts`

- `gameType`
- `status`
- `gameCode`
- `players[]`
- `currentTurnIndex`
- `currentTurn`
- `gameState`
- `moveHistory[]`
- timestamps
- `result`
- `metadata`

### Snapshots

`backend/src/models/GameSnapshot.ts`

- Used for reconstructing older or long-running game states
- Present in code, but the current Tic Tac Toe MVP does not rely heavily on snapshot replay yet

## Environment Variables

Key backend vars:

- `NODE_ENV`
- `PORT`
- `MONGODB_URI`
- `REDIS_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`

Key frontend vars:

- `VITE_API_URL`
- `VITE_SOCKET_URL`

Important local note:

- `backend/docker-compose.yml` should not force production cookies during local HTTP development.
- The current setup uses development mode locally so the auth cookie is usable on `http://localhost`.

Current public deployment layout:

- Frontend: `https://games-arena.penguincookie.ca` on Vercel
- Backend API: `https://api.penguincookie.ca` on EC2 behind Nginx
- Backend CORS origin in production: `https://games-arena.penguincookie.ca`
- Vercel frontend env vars should point at `https://api.penguincookie.ca`
- EC2 Nginx proxies `api.penguincookie.ca` to the Node container on `127.0.0.1:3000`
- Certbot/Let's Encrypt is used for HTTPS on the API domain

## Important Practical Notes

1. The `getting_started/` docs are useful context, but they are broader than the current implementation.
2. The current app is not a full multi-game platform in the UI.
3. Tic Tac Toe is the working multiplayer path to preserve and extend.
4. Auth problems usually mean either:
   - the running server is stale, or
   - the browser is not sending/keeping the cookie, or
   - the wrong database is being used.
5. The project uses Docker for the backend in development/verification, so rebuilds matter when source changes.
6. For production deploys, the GitHub Actions backend workflow builds a Docker image, pushes it to Docker Hub, then SSHes into EC2 and runs `docker compose pull` / `docker compose up -d --no-build`.
7. The EC2 host does not automatically `git pull` repo files during deploy, so host-side config files like `backend/docker-compose.yml` must be synced manually if they change.
8. `backend/docker-compose.yml` must pass `CORS_ORIGIN` into the container so production CORS follows `games-arena.penguincookie.ca`.

## Useful Commands

Backend:

```bash
cd backend
npm install
npm run build
npm run lint
npm test
```

Frontend:

```bash
cd frontend
npm install
npm run build
npm run lint
npm test
```

Docker backend:

```bash
cd backend
docker compose --env-file .env up -d --build
```

## If You Need to Resume Quickly

Read these first:

1. `getting_started/DEVELOPER_HANDOFF.md`
2. `getting_started/MULTIPLAYER_GAMES_PROJECT_SPEC.md`
3. `backend/src/server.ts`
4. `backend/src/services/gameService.ts`
5. `frontend/src/pages/Dashboard.tsx`
6. `frontend/src/pages/GameBoard.tsx`

Then inspect:

- auth flow in `backend/src/controllers/authController.ts`
- cookie helpers in `backend/src/utils/authToken.ts`
- client auth in `frontend/src/hooks/useAuth.ts`
- socket client setup in `frontend/src/lib/socket.ts`
