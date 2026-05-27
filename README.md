# Games-Arena

A real-time multiplayer games platform for Chess, Tic Tac Toe, Checkers, Uno, and President.

## Documentation

Project setup and architecture notes live in `getting_started/`. Start with:

- `getting_started/00_START_HERE.md`
- `getting_started/README_SETUP.md`
- `getting_started/MULTIPLAYER_GAMES_PROJECT_SPEC.md`

## Local Development

Backend:

```bash
cd backend
npm install
copy .env.example .env
docker compose up -d redis
npm run dev
```

Frontend:

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

The frontend runs at `http://localhost:5173`; the backend API runs at `http://localhost:3000`.

## Verification

```bash
cd backend && npm run build
cd frontend && npm run build
```
