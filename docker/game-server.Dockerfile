FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
WORKDIR /app

# ── Dependency layer (cached unless lockfile changes) ──────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY packages/game-protocol/package.json ./packages/game-protocol/
COPY packages/game-core/package.json ./packages/game-core/
RUN pnpm install --filter "@frwf/game-server..." --frozen-lockfile

# ── Development image (hot reload via ts-node-dev) ─────────────────────────────
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY package.json ./
COPY pnpm-workspace.yaml ./
COPY packages ./packages
COPY server ./server
EXPOSE 2567
CMD ["pnpm", "--filter", "@frwf/game-server", "dev"]

# ── Build layer ────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages ./packages
COPY server ./server
RUN pnpm --filter "@frwf/game-server..." build

# ── Production image ───────────────────────────────────────────────────────────
FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY packages/game-protocol/package.json ./packages/game-protocol/
COPY packages/game-core/package.json ./packages/game-core/

RUN pnpm install --filter "@frwf/game-server..." --frozen-lockfile --prod

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/packages/game-protocol/dist ./packages/game-protocol/dist
COPY --from=builder /app/packages/game-core/dist ./packages/game-core/dist

EXPOSE 2567
USER node
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:2567/health || exit 1

CMD ["node", "server/dist/index.js"]
