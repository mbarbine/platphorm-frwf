# RINGFALL Local Development

## Prerequisites

- Node.js 20+
- pnpm 9.15.0 (`corepack enable`)
- Docker Desktop (optional, for game server + Redis)

## Quick start — browser-only (no server)

```bash
pnpm install
pnpm dev           # Vite at http://localhost:5173
```

Single-player and local vs-AI work without the game server.

## Quick start — with authoritative multiplayer

```bash
pnpm install
docker compose up --build -d     # game server on :2567, Redis on :6379
pnpm dev
```

Open the game, click **Multiplayer**, and share the room link.

## Running individual packages

```bash
# Frontend only
pnpm --filter platphorm-frwf dev

# Server only (hot reload)
pnpm --filter @frwf/game-server dev

# Type-check everything
pnpm typecheck

# Tests
pnpm test
pnpm --filter @frwf/game-server test
```

## Environment variables

Copy `docker/development.env.example` to `server/.env` and fill in values.

The frontend reads:
- `VITE_GAME_SERVER_URL` — WebSocket URL for the Colyseus server (default: `ws://localhost:2567`)

## Colyseus monitor

When `MONITOR_ENABLED=true` (the default in development), visit:
`http://localhost:2567/colyseus`

## Health checks

- `GET http://localhost:2567/health` → `{ ok: true, version: "1.0.0", uptime: N }`
- `GET http://localhost:2567/ready` → `{ ok: true }`

## Docker teardown

```bash
docker compose down -v    # removes volumes including Redis data
```
