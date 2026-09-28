import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import {
  rateLimiter,
  rateLimitMap,
  cleanExpiredRateLimits,
  LIMIT_WINDOW_MS,
  MAX_REQUESTS,
  MAX_MAP_SIZE,
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

describe('rateLimiter middleware & rateLimitMap management', () => {
  beforeEach(() => {
    rateLimitMap.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    rateLimitMap.clear();
    vi.useRealTimers();
  });

  it('correctly resolves client IP from req.ip, req.socket.remoteAddress, or fallback unknown', () => {
    // Case 1: req.ip is present
    const req1 = { ip: '192.168.1.100', socket: { remoteAddress: '10.0.0.1' } } as unknown as Request;
    const res1 = createMockResponse();
    const next1 = vi.fn();
    rateLimiter(req1, res1, next1);
    expect(rateLimitMap.has('192.168.1.100')).toBe(true);
    expect(next1).toHaveBeenCalled();

    // Case 2: req.ip is missing, req.socket.remoteAddress is present
    const req2 = { ip: undefined, socket: { remoteAddress: '10.0.0.2' } } as unknown as Request;
    const res2 = createMockResponse();
    const next2 = vi.fn();
    rateLimiter(req2, res2, next2);
    expect(rateLimitMap.has('10.0.0.2')).toBe(true);
    expect(next2).toHaveBeenCalled();

    // Case 3: Both req.ip and socket.remoteAddress are missing
    const req3 = { ip: undefined, socket: {} } as unknown as Request;
    const res3 = createMockResponse();
    const next3 = vi.fn();
    rateLimiter(req3, res3, next3);
    expect(rateLimitMap.has('unknown')).toBe(true);
    expect(next3).toHaveBeenCalled();
  });

  it('resets request count and updates resetTime after the rate limit window expires', () => {
    vi.useFakeTimers();
    const now = 1_000_000;
    vi.setSystemTime(now);

    const ip = '10.0.0.5';
    const req = { ip, socket: {} } as unknown as Request;
    const res = createMockResponse();
    const next = vi.fn();

    // First request
    rateLimiter(req, res, next);
    expect(rateLimitMap.get(ip)).toEqual({
      count: 1,
      resetTime: now + LIMIT_WINDOW_MS,
    });

    // Advance time within the window
    vi.setSystemTime(now + 30_000);
    rateLimiter(req, res, next);
    expect(rateLimitMap.get(ip)).toEqual({
      count: 2,
      resetTime: now + LIMIT_WINDOW_MS,
    });

    // Advance time beyond window expiration (now + 60,001 ms)
    const newNow = now + LIMIT_WINDOW_MS + 1;
    vi.setSystemTime(newNow);
    rateLimiter(req, res, next);

    expect(rateLimitMap.get(ip)).toEqual({
      count: 1,
      resetTime: newNow + LIMIT_WINDOW_MS,
    });
  });

  it('allows requests up to MAX_REQUESTS and blocks requests exceeding the limit with 429 status', () => {
    vi.useFakeTimers();
    const now = 1_000_000;
    vi.setSystemTime(now);

    const ip = '172.16.0.1';
    const req = { ip, socket: {} } as unknown as Request;
    const res = createMockResponse();
    const next = vi.fn();

    // Send up to MAX_REQUESTS (100)
    for (let i = 0; i < MAX_REQUESTS; i++) {
      rateLimiter(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(MAX_REQUESTS);
    expect(res.status).not.toHaveBeenCalled();

    // 101st request should be throttled
    rateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(MAX_REQUESTS); // Not called again
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'too_many_requests',
        message: 'Rate limit exceeded. Please try again later.',
      },
    });

    // Verify Retry-After header with partial window remaining
    vi.setSystemTime(now + 45_000); // 15 seconds left
    const res2 = createMockResponse();
    rateLimiter(req, res2, next);
    expect(res2.setHeader).toHaveBeenCalledWith('Retry-After', '15');
  });

  it('purges expired entries when MAX_MAP_SIZE is reached for new incoming IPs', () => {
    vi.useFakeTimers();
    const baseTime = 1_000_000;
    vi.setSystemTime(baseTime);

    const res = createMockResponse();
    const next = vi.fn();

    // Fill map up to MAX_MAP_SIZE with expired entries for the first half
    for (let i = 0; i < MAX_MAP_SIZE; i++) {
      const ip = `10.0.${Math.floor(i / 256)}.${i % 256}`;
      rateLimitMap.set(ip, {
        count: 1,
        resetTime: i < 1000 ? baseTime - 1000 : baseTime + 60_000,
      });
    }

    expect(rateLimitMap.size).toBe(MAX_MAP_SIZE);

    // Incoming request from new IP should trigger expired entry purging
    const newReq = { ip: '192.168.99.99', socket: {} } as unknown as Request;
    rateLimiter(newReq, res, next);

    // The 1000 expired entries should have been deleted, plus the new IP added
    expect(rateLimitMap.size).toBe(MAX_MAP_SIZE - 1000 + 1);
    expect(rateLimitMap.has('192.168.99.99')).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  it('evicts the oldest entry when MAX_MAP_SIZE is reached and no entries are expired', () => {
    vi.useFakeTimers();
    const baseTime = 1_000_000;
    vi.setSystemTime(baseTime);

    const res = createMockResponse();
    const next = vi.fn();

    // Fill map up to MAX_MAP_SIZE with ALL active (unexpired) entries
    for (let i = 0; i < MAX_MAP_SIZE; i++) {
      const ip = `10.0.${Math.floor(i / 256)}.${i % 256}`;
      rateLimitMap.set(ip, {
        count: 1,
        resetTime: baseTime + 60_000,
      });
    }

    const oldestIp = '10.0.0.0';
    expect(rateLimitMap.has(oldestIp)).toBe(true);
    expect(rateLimitMap.size).toBe(MAX_MAP_SIZE);

    // Incoming request from new IP should evict oldest entry
    const newReq = { ip: '192.168.100.100', socket: {} } as unknown as Request;
    rateLimiter(newReq, res, next);

    expect(rateLimitMap.size).toBe(MAX_MAP_SIZE);
    expect(rateLimitMap.has(oldestIp)).toBe(false);
    expect(rateLimitMap.has('192.168.100.100')).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  it('cleanExpiredRateLimits purges only expired rate limit entries', () => {
    vi.useFakeTimers();
    const baseTime = 1_000_000;
    vi.setSystemTime(baseTime);

    rateLimitMap.set('10.0.0.1', { count: 10, resetTime: baseTime - 100 }); // Expired
    rateLimitMap.set('10.0.0.2', { count: 5, resetTime: baseTime + 30_000 }); // Active
    rateLimitMap.set('10.0.0.3', { count: 1, resetTime: baseTime - 1 }); // Expired

    cleanExpiredRateLimits();

    expect(rateLimitMap.has('10.0.0.1')).toBe(false);
    expect(rateLimitMap.has('10.0.0.2')).toBe(true);
    expect(rateLimitMap.has('10.0.0.3')).toBe(false);
    expect(rateLimitMap.size).toBe(1);
  });
});
