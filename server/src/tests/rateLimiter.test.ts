import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  rateLimiter,
  rateLimitMap,
  LIMIT_WINDOW_MS,
  MAX_REQUESTS,
  MAX_MAP_SIZE,
  cleanExpiredRateLimits,
} from '../index';

interface MockResponse {
  status: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

function createMockResponse(): MockResponse & Response {
  const res: Partial<MockResponse> = {
    setHeader: vi.fn(),
    json: vi.fn(),
    end: vi.fn(),
  };
  res.status = vi.fn().mockReturnValue(res);
  return res as MockResponse & Response;
}

describe('rateLimiter middleware and rate limit cleanup', () => {
  beforeEach(() => {
    rateLimitMap.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    rateLimitMap.clear();
    vi.useRealTimers();
  });

  describe('IP resolution hierarchy', () => {
    it('uses req.ip as highest priority when available', () => {
      const req = {
        ip: '192.168.1.50',
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      rateLimiter(req, res, next);

      expect(rateLimitMap.has('192.168.1.50')).toBe(true);
      expect(rateLimitMap.has('10.0.0.1')).toBe(false);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('falls back to req.socket.remoteAddress when req.ip is undefined', () => {
      const req = {
        socket: { remoteAddress: '10.0.0.5' },
      } as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      rateLimiter(req, res, next);

      expect(rateLimitMap.has('10.0.0.5')).toBe(true);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('falls back to "unknown" when neither req.ip nor req.socket.remoteAddress are provided', () => {
      const req = {
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      rateLimiter(req, res, next);

      expect(rateLimitMap.has('unknown')).toBe(true);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('request counting and window reset', () => {
    it('allows requests up to MAX_REQUESTS limit and tracks count', () => {
      const ip = '10.1.1.1';
      const req = { ip, socket: {} } as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      for (let i = 0; i < MAX_REQUESTS; i++) {
        rateLimiter(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(MAX_REQUESTS);
      expect(res.status).not.toHaveBeenCalled();

      const record = rateLimitMap.get(ip);
      expect(record).toBeDefined();
      expect(record?.count).toBe(MAX_REQUESTS);
    });

    it('resets rate limit count after window duration expires', () => {
      const now = 1000000;
      vi.setSystemTime(now);

      const ip = '10.1.1.2';
      const req = { ip, socket: {} } as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      // Exhaust limit
      for (let i = 0; i < MAX_REQUESTS; i++) {
        rateLimiter(req, res, next);
      }

      expect(rateLimitMap.get(ip)?.count).toBe(MAX_REQUESTS);

      // Advance time beyond window
      vi.setSystemTime(now + LIMIT_WINDOW_MS + 1000);

      rateLimiter(req, res, next);

      expect(next).toHaveBeenCalledTimes(MAX_REQUESTS + 1);
      expect(rateLimitMap.get(ip)?.count).toBe(1);
    });
  });

  describe('rate limit enforcement and Retry-After header', () => {
    it('blocks request with status 429 when MAX_REQUESTS is exceeded', () => {
      const now = 1000000;
      vi.setSystemTime(now);

      const ip = '10.1.1.3';
      const req = { ip, socket: {} } as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      for (let i = 0; i < MAX_REQUESTS; i++) {
        rateLimiter(req, res, next);
      }

      // Request 101 should be blocked
      rateLimiter(req, res, next);

      expect(next).toHaveBeenCalledTimes(MAX_REQUESTS);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'too_many_requests',
          message: 'Rate limit exceeded. Please try again later.',
        },
      });
    });

    it('clamps Retry-After header to at least 1 second when remaining reset time is < 1s', () => {
      const now = 1000000;
      vi.setSystemTime(now);

      const ip = '10.1.1.4';
      const req = { ip, socket: {} } as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      for (let i = 0; i < MAX_REQUESTS; i++) {
        rateLimiter(req, res, next);
      }

      // Advance time until 200ms before reset
      vi.setSystemTime(now + LIMIT_WINDOW_MS - 200);

      rateLimiter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '1');
    });
  });

  describe('MAX_MAP_SIZE capacity bound and eviction', () => {
    it('purges expired entries when map reaches MAX_MAP_SIZE capacity before adding new IP', () => {
      const now = 1000000;
      vi.setSystemTime(now);

      const res = createMockResponse();
      const next = vi.fn();

      // Fill map to MAX_MAP_SIZE with expired entries
      for (let i = 0; i < MAX_MAP_SIZE; i++) {
        rateLimitMap.set(`10.0.${Math.floor(i / 256)}.${i % 256}`, {
          count: 5,
          resetTime: now - 1000, // already expired
        });
      }

      expect(rateLimitMap.size).toBe(MAX_MAP_SIZE);

      const overflowReq = { ip: '172.16.0.1', socket: {} } as unknown as Request;
      rateLimiter(overflowReq, res, next);

      // Map should have purged all expired entries and now contain only the new entry
      expect(rateLimitMap.size).toBe(1);
      expect(rateLimitMap.has('172.16.0.1')).toBe(true);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('evicts oldest entry when map reaches MAX_MAP_SIZE capacity and all entries are active', () => {
      const now = 1000000;
      vi.setSystemTime(now);

      const res = createMockResponse();
      const next = vi.fn();

      // Fill map to MAX_MAP_SIZE with active entries
      const firstIp = '10.0.0.0';
      for (let i = 0; i < MAX_MAP_SIZE; i++) {
        rateLimitMap.set(`10.0.${Math.floor(i / 256)}.${i % 256}`, {
          count: 1,
          resetTime: now + LIMIT_WINDOW_MS,
        });
      }

      expect(rateLimitMap.size).toBe(MAX_MAP_SIZE);
      expect(rateLimitMap.has(firstIp)).toBe(true);

      const overflowReq = { ip: '172.16.0.2', socket: {} } as unknown as Request;
      rateLimiter(overflowReq, res, next);

      // Oldest entry (firstIp) should be evicted to make room for new IP
      expect(rateLimitMap.size).toBe(MAX_MAP_SIZE);
      expect(rateLimitMap.has(firstIp)).toBe(false);
      expect(rateLimitMap.has('172.16.0.2')).toBe(true);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanExpiredRateLimits utility', () => {
    it('deletes expired rate limit entries from rateLimitMap while keeping active entries', () => {
      const now = 1000000;
      vi.setSystemTime(now);

      rateLimitMap.set('10.0.0.1', { count: 3, resetTime: now - 500 }); // expired
      rateLimitMap.set('10.0.0.2', { count: 1, resetTime: now + 30000 }); // active
      rateLimitMap.set('10.0.0.3', { count: 10, resetTime: now - 1 }); // expired

      cleanExpiredRateLimits();

      expect(rateLimitMap.has('10.0.0.1')).toBe(false);
      expect(rateLimitMap.has('10.0.0.2')).toBe(true);
      expect(rateLimitMap.has('10.0.0.3')).toBe(false);
      expect(rateLimitMap.size).toBe(1);
    });
  });
});
