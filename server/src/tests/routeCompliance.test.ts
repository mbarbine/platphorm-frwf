import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error - JavaScript file lacks type definitions in server
import handler from '../../../api/v1/route-compliance.js';

describe('Route Compliance Serverless Handler', () => {
  it('redirects to the base domain with sanitized/validated timeoutMs when input is valid', () => {
    const req = {
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
});
