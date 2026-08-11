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

  // ── Defensive Security Hardening ──────────────────────────────────────────

  app.disable('x-powered-by'); // Avoid disclosing server technology stack
  app.use(rateLimiter); // Protect Express endpoints from brute-force/DoS attacks (CWE-307)

  app.use((_req, res, next) => {
    // Prevent MIME-sniffing vulnerability
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent Clickjacking/frame-embedding attacks
    res.setHeader('X-Frame-Options', 'DENY');
    // Enable XSS protection header for older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Restrict Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    next();
  });

  app.use(cors({ origin: SERVER_CONFIG.CORS_ORIGIN }));
  app.use(express.json({ limit: '64kb' }));

  const httpServer = http.createServer(app);

  const gameServer = new Server({
    server: httpServer,
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

  // ── Secure Error Handling Middleware ───────────────────────────────────────
  // Custom error handling middleware to catch any unhandled errors and return a standardized secure JSON response, preventing stack trace disclosure (CWE-209).
  app.use(secureErrorHandler);

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

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST && typeof globalThis.describe !== 'function') {
  void bootstrap().catch((err) => { console.error('Server failed to start:', err); process.exit(1); });
}

/**
 * Custom error handling middleware to catch any unhandled errors and return a standardized secure JSON response, preventing stack trace disclosure (CWE-209).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function secureErrorHandler(err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction): void {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: {
      code: 'internal_server_error',
      message: 'An unexpected error occurred on the server.',
    },
  });
}

// ── Defensive Rate Limiting Middleware ───────────────────────────────────────
export const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
export const LIMIT_WINDOW_MS = 60000; // 1 minute
export const MAX_REQUESTS = 100; // max requests per minute

export function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const rateData = rateLimitMap.get(ip);

  if (!rateData || now > rateData.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + LIMIT_WINDOW_MS });
    next();
  } else {
    rateData.count++;
    if (rateData.count > MAX_REQUESTS) {
      res.status(429).json({
        error: {
          code: 'too_many_requests',
          message: 'Rate limit exceeded. Please try again later.',
        },
      });
    } else {
      next();
    }
  }
}

// Periodically clean up expired rate limit entries to prevent memory leak (CWE-400)
export const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000);

if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  clearInterval(cleanupInterval);
} else if (cleanupInterval.unref) {
  cleanupInterval.unref();
}
