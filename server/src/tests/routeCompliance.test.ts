import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error - JavaScript file lacks type definitions in server
import handler from '../../../api/v1/route-compliance.js';

describe('Route Compliance Serverless Handler', () => {
  it('redirects to the base domain with sanitized/validated timeoutMs when input is valid', () => {
    const req = {
      method: 'GET',
      headers: {
        host: 'platphormnews.com',
      },
      query: {
        timeoutMs: '1500',
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(307);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Location',
      'https://base.platphormnews.com/api/v1/route-compliance?domain=platphormnews.com&mode=full&timeoutMs=1500'
    );
  });

  it('falls back to default 1200ms when timeoutMs is invalid or missing', () => {
    const req = {
      method: 'GET',
      headers: {
        host: 'news.platphormnews.com',
      },
      query: {
        timeoutMs: 'invalid_timeout',
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(307);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Location',
      'https://base.platphormnews.com/api/v1/route-compliance?domain=news.platphormnews.com&mode=full&timeoutMs=1200'
    );
  });

  it('rejects untrusted domains with a 400 response', () => {
    const req = {
      method: 'GET',
      headers: {
        host: 'malicious.com',
      },
      query: {},
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({
          code: 'untrusted_domain',
        }),
      })
    );
  });

  it('rejects non-GET and non-HEAD methods with a 405 response', () => {
    const req = {
      method: 'POST',
      headers: {
        host: 'platphormnews.com',
      },
      query: {},
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      json: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET, HEAD');
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: 'method_not_allowed',
        message: 'Only GET and HEAD methods are allowed.',
      },
    });
  });

  it('allows HEAD method and redirects successfully', () => {
    const req = {
      method: 'HEAD',
      headers: {
        host: 'platphormnews.com',
      },
      query: {
        timeoutMs: '1200',
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(307);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Location',
      'https://base.platphormnews.com/api/v1/route-compliance?domain=platphormnews.com&mode=full&timeoutMs=1200'
    );
  });
});
