import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error - JavaScript file lacks type definitions in server
import handler from '../../../api/mcp.js';

describe('MCP Serverless Endpoint Handler', () => {
  it('handles GET introspection requests successfully', () => {
    const req = { method: 'GET' };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          status: 'introspection_only',
        }),
      })
    );
  });

  it('rejects unsupported HTTP methods with 405', () => {
    const req = { method: 'PUT' };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Method not allowed' },
    });
  });

  it('handles valid JSON-RPC POST requests', () => {
    const req = {
      method: 'POST',
      body: { jsonrpc: '2.0', id: 1, method: 'ping' },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    });
  });

  it('catches unhandled exceptions during request processing and fails securely with 500', () => {
    const req = {
      method: 'POST',
      get body() {
        throw new Error('Unexpected property getter failure');
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler(req as any, res as any);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: 'Internal error' },
    });

    consoleErrorSpy.mockRestore();
  });
});
