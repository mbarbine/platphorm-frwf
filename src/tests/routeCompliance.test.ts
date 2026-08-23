import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error - JavaScript serverless function lacks type definitions
import handler from '../../api/v1/route-compliance.js';

describe('Route Compliance Serverless Handler Security Checks', () => {
  it('redirects to the base domain with sanitized timeoutMs when input is valid', () => {
    const req = {
      method: 'GET',
      headers: { host: 'platphormnews.com' },
      query: { timeoutMs: '1500' },
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

  it('rejects chained X-Forwarded-Host header payloads attempting to bypass domain validation (CWE-290/CWE-346)', () => {
    const req = {
      method: 'GET',
      headers: {
        'x-forwarded-host': 'untrusted.com, base.platphormnews.com',
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
          details: { domain: 'untrusted.com' },
        }),
      })
    );
  });

  it('correctly processes valid X-Forwarded-Host with port and secondary proxies', () => {
    const req = {
      method: 'GET',
      headers: {
        'x-forwarded-host': 'platphormnews.com:443, proxy.internal',
      },
      query: {},
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

  it('rejects non-GET and non-HEAD methods with 405 Method Not Allowed', () => {
    const req = {
      method: 'POST',
      headers: { host: 'platphormnews.com' },
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
  });
});
