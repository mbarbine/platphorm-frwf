import { Server } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { SERVER_CONFIG } from './config';
import { WrestlingRoom } from './rooms/WrestlingRoom';

// ──────────────────────────────────────────────────────────────────────────────
// RINGFALL authoritative game server entry point.
//
// The server runs a deterministic fixed-tick simulation (30 Hz), owns the
// canonical match state, and broadcasts compact state patches to clients who
// run the full physics presentation locally.
//
// DO NOT run this server inside Vercel serverless functions.
// Vercel hosts the static frontend only.
// This server requires persistent WebSocket support.
// ──────────────────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  const app = express();
  app.use(cors({ origin: SERVER_CONFIG.CORS_ORIGIN }));
  app.use(express.json({ limit: '64kb' }));

  const httpServer = http.createServer(app);

  const gameServer = new Server({
    server: httpServer,
    express: app,
  });

  // ── Room definitions ───────────────────────────────────────────────────────
  gameServer.define('wrestling', WrestlingRoom, { ruleset: 'standard', difficulty: 'normal' })
    .enableRealtimeListing();

  gameServer.define('wrestling_chaos', WrestlingRoom, { ruleset: 'chaos', difficulty: 'normal' })
    .enableRealtimeListing();

  gameServer.define('wrestling_hard', WrestlingRoom, { ruleset: 'standard', difficulty: 'hard' })
    .enableRealtimeListing();

  gameServer.define('practice', WrestlingRoom, { ruleset: 'standard', difficulty: 'normal', private: true });

  // ── Operational endpoints ──────────────────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ ok: true, version: SERVER_CONFIG.PROTOCOL_VERSION, uptime: process.uptime() }));
  app.get('/ready', (_req, res) => res.json({ ok: true }));
  app.get('/version', (_req, res) => res.json({ version: SERVER_CONFIG.PROTOCOL_VERSION, nodeEnv: SERVER_CONFIG.NODE_ENV }));

  // ── Development monitor ────────────────────────────────────────────────────
  if (SERVER_CONFIG.MONITOR_ENABLED) {
    app.use('/colyseus', monitor());
    console.log(`🔍 Colyseus monitor: http://localhost:${SERVER_CONFIG.PORT}/colyseus`);
  }

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n📴 Received ${signal} — draining connections…`);
    await gameServer.gracefullyShutdown(false);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err); });
  process.on('unhandledRejection', (reason) => { console.error('Unhandled rejection:', reason); });

  // ── Listen ─────────────────────────────────────────────────────────────────
  await gameServer.listen(SERVER_CONFIG.PORT, SERVER_CONFIG.HOSTNAME);
  console.log(`🤼 RINGFALL Game Server`);
  console.log(`   Address: ws://${SERVER_CONFIG.HOSTNAME}:${SERVER_CONFIG.PORT}`);
  console.log(`   Env:     ${SERVER_CONFIG.NODE_ENV}`);
  console.log(`   Version: ${SERVER_CONFIG.PROTOCOL_VERSION}`);
  console.log(`   Tick:    ${SERVER_CONFIG.SERVER_TICK_RATE} Hz`);
}

void bootstrap().catch((err) => { console.error('Server failed to start:', err); process.exit(1); });
