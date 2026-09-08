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
    bindings: { ENVIRONMENT: 'development', PUBLIC_ORIGIN: origin, RELEASE: 'integration-test', PLATPHORM_API_KEY: testKey },
  }));
  const db = await worker.getD1Database('DB');
  const migration = await readFile('migrations/0001_game.sql', 'utf8');
  for (const statement of migration.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
});
afterAll(async () => { await worker?.dispose(); });
describe('real Worker / Durable Object / D1 / R2 integration', () => {
  it('probes storage and returns genuinely empty results with no credential disclosure', async () => {
    const health = await worker.dispatchFetch(origin + '/api/health');
    expect(await health.json()).toMatchObject({ ok: true, data: { databaseStatus: 'operational', assetStatus: 'operational', routeComplianceScore: null } });
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
  it('preserves trace identity and JSON-RPC ids while rejecting foreign origins and large batches', async () => {
    const trace = '00-11111111111111111111111111111111-2222222222222222-01';
    const response = await worker.dispatchFetch(origin + '/api/health', { headers: { traceparent: trace, Origin: origin } });
    expect(response.headers.get('X-PlatPhorm-Trace-Id')).toBe('11111111111111111111111111111111');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect((await worker.dispatchFetch(origin + '/api/health', { headers: { Origin: 'https://outside.example' } })).status).toBe(403);
    const rpc = await post('/api/mcp', [{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', id: 'info', method: 'tools/list' }]);
    const replies = await rpc.json() as { id: unknown }[]; expect(replies.map(r => r.id)).toEqual([1, 'info']);
    const batch = await post('/api/mcp', Array.from({ length: 21 }, () => ({ jsonrpc: '2.0', id: 1, method: 'ping' })));
    expect(await batch.json()).toMatchObject({ error: { code: -32600 } });
  });
});
