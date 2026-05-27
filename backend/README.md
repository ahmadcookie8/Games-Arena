# Games Arena - Backend

Node.js + Express + Socket.io + TypeScript backend for the Games Arena multiplayer platform.

## Quick Start

```bash
cp .env.example .env
# Edit .env with your MongoDB URI

npm install
docker-compose up -d    # Start Redis
npm run dev             # http://localhost:3000
```

## Health Check

```bash
curl http://localhost:3000/api/health
```

## Structure

```
src/
├── server.ts          # Express + Socket.io entry point
├── config.ts          # Environment config
├── games/             # Game logic (GameBase, Chess, Uno, etc.)
├── models/            # MongoDB schemas
├── routes/            # API route definitions
├── controllers/       # Request handlers
├── services/          # Business logic
├── types/             # TypeScript interfaces
├── utils/             # Redis, MongoDB, validators
└── middleware/        # Auth, CORS, error handler
```

See `../getting_started/DEVELOPER_HANDOFF.md` for full implementation guide.
