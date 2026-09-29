import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { SERVER_CONFIG } from '../config';

interface MockResponse {
  status: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

function createMockResponse(): MockResponse & Response {
  const res: Partial<MockResponse> = {
    setHeader: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    end: vi.fn(),
  };
  res.status = vi.fn().mockReturnValue(res);
  return res as MockResponse & Response;
}

type ExpressRouteHandler = (req: Partial<Request>, res: Response, next?: NextFunction) => void;

function findRouteHandler(app: unknown, path: string, method = 'get'): ExpressRouteHandler | undefined {
  const expressApp = app as {
    _router?: {
      stack?: Array<{
        route?: {
          path: string;
          methods: Record<string, boolean>;
          stack: Array<{ handle: ExpressRouteHandler }>;
        };
      }>;
    };
  };

  const stack = expressApp._router?.stack ?? [];
  for (const layer of stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      return layer.route.stack[0]?.handle;
    }
  }
  return undefined;
}

function getSecurityHeadersMiddleware(app: unknown): ExpressRouteHandler | undefined {
  const expressApp = app as {
    _router?: {
      stack?: Array<{
        name?: string;
        handle?: ExpressRouteHandler;
      }>;
    };
  };

  const stack = expressApp._router?.stack ?? [];
  // Find anonymous middleware with 3 parameters (req, res, next)
  for (const layer of stack) {
    if (!layer.name || layer.name === '<anonymous>') {
      if (layer.handle && layer.handle.length === 3) {
        return layer.handle;
      }
    }
  }
  return undefined;
}

describe('createApp Express application unit tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('disables x-powered-by header on the Express app instance', async () => {
    const { createApp } = await import('../index');
    const app = createApp();

    expect(app.disabled('x-powered-by')).toBe(true);
  });

  it('applies security headers via custom security middleware', async () => {
    const { createApp } = await import('../index');
    const app = createApp();
    const securityMiddleware = getSecurityHeadersMiddleware(app);

    expect(securityMiddleware).toBeDefined();

    if (securityMiddleware) {
      const req: Partial<Request> = {};
      const res = createMockResponse();
      const next = vi.fn();

      securityMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      expect(res.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(res.setHeader).toHaveBeenCalledWith('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, max-age=0');
      expect(next).toHaveBeenCalled();
    }
  });

  it('responds with operational status on GET /health', async () => {
    const { createApp } = await import('../index');
    const app = createApp();
    const handler = findRouteHandler(app, '/health');

    expect(handler).toBeDefined();

    if (handler) {
      const req: Partial<Request> = {};
      const res = createMockResponse();

      handler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        version: SERVER_CONFIG.PROTOCOL_VERSION,
        uptime: expect.any(Number),
      });
    }
  });

  it('responds with operational status on GET /ready', async () => {
    const { createApp } = await import('../index');
    const app = createApp();
    const handler = findRouteHandler(app, '/ready');

    expect(handler).toBeDefined();

    if (handler) {
      const req: Partial<Request> = {};
      const res = createMockResponse();

      handler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        ok: true,
      });
    }
  });

  it('responds with version info on GET /version', async () => {
    const { createApp } = await import('../index');
    const app = createApp();
    const handler = findRouteHandler(app, '/version');

    expect(handler).toBeDefined();

    if (handler) {
      const req: Partial<Request> = {};
      const res = createMockResponse();

      handler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        version: SERVER_CONFIG.PROTOCOL_VERSION,
        nodeEnv: SERVER_CONFIG.NODE_ENV,
      });
    }
  });

  it('returns standardized 500 JSON via secureErrorHandler without leaking error details', async () => {
    const { secureErrorHandler } = await import('../index');
    const sensitiveError = new Error('Database password leak or internal trace details');
    const req = {} as Request;
    const res = createMockResponse();
    const next = vi.fn();

    secureErrorHandler(sensitiveError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'internal_server_error',
        message: 'An unexpected error occurred on the server.',
      },
    });

    const responsePayload = JSON.stringify(res.json.mock.calls[0][0]);
    expect(responsePayload).not.toContain('Database password');
    expect(responsePayload).not.toContain('stack');
  });

  it('conditionally mounts /colyseus route when MONITOR_ENABLED is true', async () => {
    vi.resetModules();
    vi.stubEnv('MONITOR_ENABLED', 'true');

    const { createApp } = await import('../index');
    const app = createApp();

    const expressApp = app as {
      _router?: {
        stack?: Array<{
          regexp?: { source?: string };
          route?: { path: string };
        }>;
      };
    };

    const hasMonitorRoute = expressApp._router?.stack?.some(
      (layer) =>
        layer.route?.path === '/colyseus' ||
        (layer.regexp?.source && layer.regexp.source.includes('colyseus'))
    );

    expect(hasMonitorRoute).toBe(true);

    vi.unstubAllEnvs();
  });
});
