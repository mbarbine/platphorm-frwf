import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';

const origin = 'https://frwf.platphormnews.com';
const testKey = 'local-test-operator-only';
let worker: Miniflare;
const post = (path: string, body: unknown, authorized = false) => worker.dispatchFetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: `Bearer ${testKey}` } : {}) }, body: JSON.stringify(body) });

beforeAll(async () => {
  worker = new Miniflare(convertV4MiniflareOptions({ modules: true, scriptPath: 'dist/index.js', compatibilityDate: '2026-09-07',
    durableObjects: { MATCHES: { className: 'MatchRoom', useSQLite: true } }, d1Databases: ['DB'], r2Buckets: ['ASSETS'],
    bindings: { ENVIRONMENT: 'development', PUBLIC_ORIGIN: origin, RELEASE: 'integration-test', SOURCE_SHA: '1234567890abcdef', PLATPHORM_API_KEY: testKey },
  }));
  const db = await worker.getD1Database('DB');
  const migration = await readFile('migrations/0001_game.sql', 'utf8');
  for (const statement of migration.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
});

afterAll(async () => { await worker?.dispose(); });

const connectWebSocket = async (roomId: string, ticket: string) => {
  const socketRes = await worker.dispatchFetch(`${origin}/api/rooms/${roomId}/socket`, {
    headers: { Origin: origin, Upgrade: 'websocket', 'Sec-WebSocket-Protocol': `frwf-v1, ${ticket}` },
  });
  expect(socketRes.status).toBe(101);
  const ws = socketRes.webSocket;
  expect(ws).not.toBeNull();
  if (!ws) throw new Error('WebSocket connection failed');
  ws.accept();
  return ws;
};

const nextSocketMessage = <T>(socket: WebSocket, predicate: (message: Record<string, unknown>) => boolean): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.removeEventListener('message', onMessage); reject(new Error('Timed out waiting for Durable Object message')); }, 5000);
    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      let value: Record<string, unknown>;
      try { value = JSON.parse(event.data) as Record<string, unknown>; } catch { return; }
      if (!predicate(value)) return;
      clearTimeout(timeout); socket.removeEventListener('message', onMessage); resolve(value as T);
    };
    socket.addEventListener('message', onMessage);
  });

describe('real Worker / Durable Object / D1 / R2 integration', () => {
  it('serves the new Turkey Dome map beside the compatible original arena map', async () => {
    const response = await worker.dispatchFetch(origin + '/api/maps');
    const json = await response.json() as { data: { maps: { id: string; title: string; environment?: string }[] } };
    expect(response.status).toBe(200);
    expect(json.data.maps.map(map => map.id)).toContain('turkey-dome');
    expect(json.data.maps.find(map => map.id === 'turkey-dome')).toMatchObject({ title: 'Turkey Dome', environment: 'turkey-barn-farm' });
    expect(json.data.maps.find(map => map.id === 'volt-dome')?.title).toBe('FRWF Arena');
    const detail = await worker.dispatchFetch(origin + '/api/maps/turkey-dome');
    expect(await detail.json()).toMatchObject({ ok: true, data: { id: 'turkey-dome', title: 'Turkey Dome' } });
  });
  it('probes storage and returns genuinely empty results with no credential disclosure', async () => {
    const health = await worker.dispatchFetch(origin + '/api/health');
    expect(health.headers.get('X-Frame-Options')).toBe('DENY');
    expect(health.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
    expect(health.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(await health.json()).toMatchObject({ ok: true, data: { databaseStatus: 'operational', assetStatus: 'operational', routeComplianceScore: null } });
    const release = await worker.dispatchFetch(origin + '/api/release');
    expect(await release.json()).toMatchObject({ data: { release: 'integration-test', gitSha: '1234567890abcdef' } });
    const scores = await worker.dispatchFetch(origin + '/api/leaderboards');
    expect(await scores.json()).toMatchObject({ data: { status: 'empty', entries: [], playerRankings: 'unsupported_no_player_identity' } });
    const trust = await worker.dispatchFetch(origin + '/.well-known/trust.json'); expect(await trust.text()).not.toContain(testKey);
  });

  it('requires the platform key before allocating a room and issues separate scoped tickets', async () => {
    expect((await post('/api/rooms', {})).status).toBe(401);
    const response = await post('/api/rooms', { ruleset: 'standard' }, true); expect(response.status).toBe(201);
    const json = await response.json() as { data: { roomId: string; tickets: { role: string; ticket: string }[] } };
    expect(json.data.tickets).toHaveLength(2); expect(json.data.tickets[0]?.ticket).not.toBe(json.data.tickets[1]?.ticket);
    expect(JSON.stringify(json)).not.toContain(testKey);
    const rejected = await worker.dispatchFetch(`${origin}/api/rooms/${json.data.roomId}/socket`, { headers: { Origin: origin, Upgrade: 'websocket', 'Sec-WebSocket-Protocol': 'frwf-v1,invalid' } });
    expect(rejected.status).toBe(401);
  });

  it('runs a real private match lobby through authoritative movement and sequence acknowledgement', async () => {
    const response = await post('/api/rooms', { ruleset: 'standard' }, true);
    const json = await response.json() as { data: { roomId: string; tickets: { role: string; ticket: string }[] } };
    const firstTicket = json.data.tickets.find(ticket => ticket.role === 'player1')?.ticket;
    const secondTicket = json.data.tickets.find(ticket => ticket.role === 'player2')?.ticket;
    if (!firstTicket || !secondTicket) throw new Error('Both scoped player tickets must be issued');
    const first = await connectWebSocket(json.data.roomId, firstTicket);
    const second = await connectWebSocket(json.data.roomId, secondTicket);
    try {
      const activeFirst = nextSocketMessage<{ phase: string }>(first as unknown as WebSocket, message => message.type === 'roomState' && message.phase === 'active');
      const activeSecond = nextSocketMessage<{ phase: string }>(second as unknown as WebSocket, message => message.type === 'roomState' && message.phase === 'active');
      first.send(JSON.stringify({ type: 'ready', protocolVersion: '2.0.0' }));
      second.send(JSON.stringify({ type: 'ready', protocolVersion: '2.0.0' }));
      await Promise.all([activeFirst, activeSecond]);

      const movedSnapshot = nextSocketMessage<{ seq: number; fighters: { posX: number; posZ: number }[] }>(second as unknown as WebSocket,
        message => message.type === 'snapshot' && Array.isArray(message.fighters) && typeof message.seq === 'number'
          && Number((message.fighters[0] as { posX?: unknown } | undefined)?.posX) > -2.29);
      const accepted = nextSocketMessage<{ accepted: boolean; seq: number }>(first as unknown as WebSocket, message => message.type === 'commandAck' && message.seq === 1);
      first.send(JSON.stringify({ type: 'command', protocolVersion: '2.0.0', seq: 1, clientTimestamp: 1,
        event: { action: 'move', phase: 'held', sequence: 1, timestamp: 1, direction: { x: 1, y: 0 }, source: 'network' } }));
      expect(await accepted).toMatchObject({ accepted: true, seq: 1 });

      const snapshot = await movedSnapshot;
      expect(snapshot.fighters).toHaveLength(2);
      expect(snapshot.fighters.every(fighter => Number.isFinite(fighter.posX))).toBe(true);
      expect(snapshot.fighters[0]?.posX).toBeGreaterThan(-2.29);

      const rejectedDuplicate = nextSocketMessage<{ accepted: boolean; seq: number }>(first as unknown as WebSocket, message => message.type === 'commandAck' && message.seq === 1);
      first.send(JSON.stringify({ type: 'command', protocolVersion: '2.0.0', seq: 1, clientTimestamp: 2,
        event: { action: 'move', phase: 'released', sequence: 1, timestamp: 2, direction: { x: 0, y: 0 }, source: 'network' } }));
      expect(await rejectedDuplicate).toMatchObject({ accepted: false, seq: 1 });
    } finally {
      first.close(); second.close();
    }
  });

  describe('MatchRoom WebSocket error handling', () => {
    it('closes room WebSocket with code 1008 on invalid JSON message', async () => {
      const response = await post('/api/rooms', { ruleset: 'standard' }, true);
      const json = await response.json() as { data: { roomId: string; tickets: { role: string; ticket: string }[] } };
      const ticket = json.data.tickets[0]?.ticket;
      if (!ticket) throw new Error('Player WebSocket ticket was not issued');
      const ws = await connectWebSocket(json.data.roomId, ticket);

      const closePromise = new Promise<{ code: number; reason: string }>(resolve => {
        ws.addEventListener('close', (event: { code: number; reason: string }) => {
          resolve({ code: event.code, reason: event.reason });
        });
      });
      ws.send('invalid json payload {');
      const closeEvent = await closePromise;
      expect(closeEvent.code).toBe(1008);
      expect(closeEvent.reason).toBe('Invalid JSON');
    });

    it('closes room WebSocket with code 1009 on oversized message (> 4096 bytes)', async () => {
      const response = await post('/api/rooms', { ruleset: 'standard' }, true);
      const json = await response.json() as { data: { roomId: string; tickets: { role: string; ticket: string }[] } };
      const ticket = json.data.tickets[0]?.ticket;
      if (!ticket) throw new Error('Player WebSocket ticket was not issued');
      const ws = await connectWebSocket(json.data.roomId, ticket);

      const closePromise = new Promise<{ code: number; reason: string }>(resolve => {
        ws.addEventListener('close', (event: { code: number; reason: string }) => {
          resolve({ code: event.code, reason: event.reason });
        });
      });
      const oversizedPayload = JSON.stringify({ type: 'ping', padding: 'x'.repeat(5000) });
      ws.send(oversizedPayload);
      const closeEvent = await closePromise;
      expect(closeEvent.code).toBe(1009);
      expect(closeEvent.reason).toBe('Message too large');
    });

    it('closes room WebSocket with code 1008 when message rate limit is exceeded (> 120 msgs/sec)', async () => {
      const response = await post('/api/rooms', { ruleset: 'standard' }, true);
      const json = await response.json() as { data: { roomId: string; tickets: { role: string; ticket: string }[] } };
      const ticket = json.data.tickets[0]?.ticket;
      if (!ticket) throw new Error('Player WebSocket ticket was not issued');
      const ws = await connectWebSocket(json.data.roomId, ticket);

      const closePromise = new Promise<{ code: number; reason: string }>(resolve => {
        ws.addEventListener('close', (event: { code: number; reason: string }) => {
          resolve({ code: event.code, reason: event.reason });
        });
      });
      const pingMsg = JSON.stringify({ type: 'ping', clientTimestamp: Date.now() });
      for (let i = 0; i < 122; i++) {
        ws.send(pingMsg);
      }
      const closeEvent = await closePromise;
      expect(closeEvent.code).toBe(1008);
      expect(closeEvent.reason).toBe('Message rate exceeded');
    });

    it('returns error message with code invalid_message when JSON payload fails schema validation', async () => {
      const response = await post('/api/rooms', { ruleset: 'standard' }, true);
      const json = await response.json() as { data: { roomId: string; tickets: { role: string; ticket: string }[] } };
      const ticket = json.data.tickets[0]?.ticket;
      if (!ticket) throw new Error('Player WebSocket ticket was not issued');
      const ws = await connectWebSocket(json.data.roomId, ticket);

      const errorMessagePromise = new Promise<{ type: string; code: string }>(resolve => {
        ws.addEventListener('message', (event) => {
          if (typeof event.data === 'string') {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'error') {
                resolve(msg);
              }
            } catch {
              // ignore
            }
          }
        });
      });
      ws.send(JSON.stringify({ type: 'unrecognized_type', data: 123 }));
      const errorMsg = await errorMessagePromise;
      expect(errorMsg).toMatchObject({ type: 'error', code: 'invalid_message' });
    });
  });

  it('preserves trace identity and JSON-RPC ids while rejecting foreign origins and large batches', async () => {
    const trace = '00-11111111111111111111111111111111-2222222222222222-01';
    const response = await worker.dispatchFetch(origin + '/api/health', { headers: { traceparent: trace, Origin: origin } });
    expect(response.headers.get('X-PlatPhorm-Trace-Id')).toBe('11111111111111111111111111111111');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
    expect((await worker.dispatchFetch(origin + '/api/health', { headers: { Origin: 'https://outside.example' } })).status).toBe(403);
    const rpc = await post('/api/mcp', [{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', id: 'info', method: 'tools/list' }]);
    const replies = await rpc.json() as { id: unknown }[]; expect(replies.map(r => r.id)).toEqual([1, 'info']);
    const batch = await post('/api/mcp', Array.from({ length: 21 }, () => ({ jsonrpc: '2.0', id: 1, method: 'ping' })));
    expect(await batch.json()).toMatchObject({ error: { code: -32600 } });
  });

  it('returns a traceable generic 503 and logs only safe metadata for unexpected backend failures', async () => {
    const db = await worker.getD1Database('DB');
    await db.prepare('DROP TABLE match_results').run();
    const response = await worker.dispatchFetch(origin + '/api/leaderboards');
    const body = await response.json() as { ok: boolean; error: { code: string; details: { requestId?: string } } };
    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, error: { code: 'backend_unavailable' } });
    expect(body.error.details.requestId).toBe(response.headers.get('X-PlatPhorm-Request-Id'));
    expect(await db.prepare('CREATE TABLE match_results (match_id TEXT PRIMARY KEY, map_id TEXT NOT NULL, ruleset TEXT NOT NULL, release TEXT NOT NULL, winner_fighter TEXT, method TEXT NOT NULL, duration REAL NOT NULL, hype REAL NOT NULL, completed_at TEXT NOT NULL)').run()).toBeTruthy();
    await db.prepare('CREATE INDEX IF NOT EXISTS results_completed ON match_results(completed_at DESC)').run();
  });
});
