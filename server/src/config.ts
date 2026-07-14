// ──────────────────────────────────────────────────────────────────────────────
// RINGFALL game server configuration.
// All values have safe defaults for local development.
// Production values are injected through environment variables.
// ──────────────────────────────────────────────────────────────────────────────

export const SERVER_CONFIG = {
  PORT: Number(process.env.PORT) || 2567,
  HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
  NODE_ENV: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
  REDIS_URL: process.env.REDIS_URL ?? null,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',

  /** Rate at which the server runs the authoritative simulation (Hz). */
  SERVER_TICK_RATE: 30,

  /** Rate at which compact state snapshots are broadcast to clients (Hz). */
  SNAPSHOT_RATE: 20,

  /** Seconds a disconnected player can reconnect before AI replacement. */
  RECONNECT_GRACE_SECONDS: 30,

  /** Maximum players + spectators per room. */
  MAX_CLIENTS_PER_ROOM: 4,

  /** Automatic room disposal after this many ms of inactivity. */
  ROOM_IDLE_TIMEOUT_MS: 60_000,

  /** Maximum match duration before automatic timeout result. */
  MATCH_TIMEOUT_SECONDS: 600,

  /** Expose Colyseus monitor endpoint (dev only). */
  MONITOR_ENABLED: process.env.MONITOR_ENABLED === 'true' || process.env.NODE_ENV !== 'production',

  PROTOCOL_VERSION: '1.0.0',
} as const;
