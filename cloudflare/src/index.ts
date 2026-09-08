import { HttpError, bundledMap, digest, gameInfo, mapPublication, readJson, roomOptions } from './contracts';
import type { Env } from './env';
export { MatchRoom } from './room';

const ok = (data: unknown, status = 200) => Response.json({ ok: true, data }, { status });
const fail = (code: string, status: number) => Response.json({ ok: false, error: { code, message: code.replaceAll('_', ' '), details: {} } }, { status });
const policy = 'Web dashboard, public-safe discovery, browser-based operations, trusted-domain discovery, standard route compliance, Vercel metadata capture, trace inspection, and agentic workflow discovery are intentionally supported for public read-only debugging and operator workflows. Mutating, administrative, ingestion, replay, fork, remediation, deployment, sync, test-triggering, reporting, and write actions require PLATPHORM_API_KEY.';

async function authorize(request: Request, env: Env) {
  if (!env.PLATPHORM_API_KEY) throw new HttpError(503, 'auth_not_configured');
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? request.headers.get('X-PlatPhorm-API-Key') ?? '';
  const [actual, expected] = await Promise.all([digest(supplied), digest(env.PLATPHORM_API_KEY)]);
  let mismatch = 0; for (let i = 0; i < expected.length; i++) mismatch |= (actual.charCodeAt(i) ^ expected.charCodeAt(i));
  if (mismatch) throw new HttpError(401, 'unauthorized');
  if (!env.DB) throw new HttpError(503, 'database_not_configured');
  const minute = Math.floor(Date.now() / 60000);
  const row = await env.DB.prepare("INSERT INTO operator_rate_limits(bucket,window,count) VALUES ('operator',?,1) ON CONFLICT(bucket) DO UPDATE SET window=excluded.window,count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END RETURNING count").bind(minute).first<{ count: number }>();
  if (!row || row.count > 30) throw new HttpError(429, 'rate_limited');
}

async function health(env: Env) {
  const probe = async (configured: boolean, run: () => Promise<unknown>) => {
    if (!configured) return 'not_configured';
    try { await run(); return 'operational'; } catch { return 'unavailable'; }
  };
  const [database, assets] = await Promise.all([
    probe(!!env.DB, async () => env.DB?.prepare('SELECT match_id FROM match_results LIMIT 1').all()),
    probe(!!env.ASSETS, async () => env.ASSETS?.list({ limit: 1 })),
  ]);
  return { service: 'ringfall-game-backend', version: env.RELEASE, environment: env.ENVIRONMENT, timestamp: new Date().toISOString(),
    status: database === 'operational' && assets === 'operational' && !!env.PLATPHORM_API_KEY ? 'operational' : 'degraded',
    databaseStatus: database, assetStatus: assets, matchRuntimeStatus: 'on_demand_not_probed', mcpStatus: 'implemented',
    traceContextAccepted: true, traceContextPropagated: false, traceExportEnabled: false, traceStatus: 'local_context_only',
    routeComplianceScore: null, routeComplianceBasis: 'Use live route checks; no hardcoded score.',
    authStatus: env.PLATPHORM_API_KEY ? 'configured' : 'not_configured', vercelMetadataCaptured: false,
    cacheStatus: 'not_applicable', telemetryStatus: 'unsupported',
  };
}

const paths = ['/api/health', '/api/v1/health', '/api/game', '/api/maps', '/api/modes', '/api/release', '/api/leaderboards', '/api/docs', '/api/openapi.json', '/api/mcp'];
function openapi(env: Env) {
  return { openapi: '3.1.0', info: { title: 'RINGFALL game backend', version: env.RELEASE }, servers: [{ url: env.PUBLIC_ORIGIN }],
    paths: Object.fromEntries([
      ...paths.map(path => [path, { get: { responses: { '200': { description: 'Public read-only result' }, '503': { description: 'Dependency unavailable' } } } }]),
      ['/api/rooms', { post: { security: [{ platformBearer: [] }, { platformKey: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, properties: { ruleset: { enum: ['standard', 'chaos'] } } } } } }, responses: { '201': { description: 'Room and two scoped player tickets. Keep tickets private.' }, '401': { description: 'PLATPHORM_API_KEY required' }, '429': { description: 'Rate limited' }, '503': { description: 'Not configured' } } } }],
    ]),
    components: { securitySchemes: { platformBearer: { type: 'http', scheme: 'bearer', description: 'PLATPHORM_API_KEY' }, platformKey: { type: 'apiKey', in: 'header', name: 'X-PlatPhorm-API-Key', description: 'PLATPHORM_API_KEY' } } },
  };
}

const tools = [
  { name: 'get_game_info', description: 'Local and online game capabilities and limitations', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'list_maps', description: 'Read the implemented bundled arena', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_server_status', description: 'Probe D1 and R2 availability', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
];
async function rpc(input: unknown, env: Env): Promise<unknown | null> {
  const item = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
  const hasId = item && Object.hasOwn(item, 'id');
  const id = item && (typeof item.id === 'string' || typeof item.id === 'number' || item.id === null) ? item.id : null;
  const error = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (!item || item.jsonrpc !== '2.0' || typeof item.method !== 'string' || (hasId && id === null && item.id !== null)) return error(-32600, 'Invalid Request');
  const params = item.params;
  if (params !== undefined && (!params || typeof params !== 'object' || Array.isArray(params))) return hasId ? error(-32602, 'Invalid params') : null;
  let result: unknown;
  switch (item.method) {
    case 'initialize': result = { protocolVersion: '2024-11-05', capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: { name: 'ringfall-game-backend', version: env.RELEASE } }; break;
    case 'ping': result = {}; break;
    case 'tools/list': result = { tools }; break;
    case 'resources/list': result = { resources: [{ uri: 'frwf://game', name: 'Game capabilities', mimeType: 'application/json' }] }; break;
    case 'resources/read':
      if ((params as Record<string, unknown>)?.uri !== 'frwf://game') return hasId ? error(-32602, 'Unknown resource') : null;
      result = { contents: [{ uri: 'frwf://game', mimeType: 'application/json', text: JSON.stringify(gameInfo) }] }; break;
    case 'prompts/list': result = { prompts: [] }; break;
    case 'prompts/get': return hasId ? error(-32602, 'No prompts registered') : null;
    case 'tools/call': {
      const call = params as { name?: string; arguments?: unknown } | undefined;
      if (!call || !tools.some(tool => tool.name === call.name) || (call.arguments !== undefined && (!call.arguments || typeof call.arguments !== 'object' || Array.isArray(call.arguments) || Object.keys(call.arguments).length))) return hasId ? error(-32602, 'Invalid tool or arguments') : null;
      const value = call.name === 'get_game_info' ? gameInfo : call.name === 'list_maps' ? [bundledMap] : await health(env);
      result = { content: [{ type: 'text', text: JSON.stringify(value) }] }; break;
    }
    default: return hasId ? error(-32601, 'Method not found') : null;
  }
  return hasId ? { jsonrpc: '2.0', id, result } : null;
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url); const path = url.pathname;
  const origin = request.headers.get('Origin');
  if (origin && origin !== env.PUBLIC_ORIGIN) throw new HttpError(403, 'origin_not_allowed');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (/^\/api\/rooms\/[a-f0-9-]{36}\/socket$/.test(path) && request.method === 'GET') {
    if (!origin) throw new HttpError(403, 'origin_required');
    const roomId = path.split('/')[3];
    if (!roomId) throw new HttpError(400, 'invalid_room');
    return env.MATCHES.getByName(roomId).fetch(request);
  }
  if (request.method === 'POST' && path === '/api/mcp') {
    let body: unknown;
    try { body = await readJson(request); } catch (error) {
      if (error instanceof HttpError && error.code === 'invalid_json') return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      throw error;
    }
    if (Array.isArray(body) && (body.length === 0 || body.length > 20)) return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid batch' } });
    const results = (await Promise.all((Array.isArray(body) ? body : [body]).map(item => rpc(item, env)))).filter(item => item !== null);
    return results.length ? Response.json(Array.isArray(body) ? results : results[0]) : new Response(null, { status: 204 });
  }
  if (request.method === 'POST' && path === '/api/rooms') {
    await authorize(request, env);
    const options = roomOptions.safeParse(await readJson(request)); if (!options.success) throw new HttpError(400, 'invalid_room_options');
    const id = crypto.randomUUID(); return ok(await env.MATCHES.getByName(id).initialize(id, options.data.ruleset), 201);
  }
  if (request.method === 'POST' && path === '/api/maps/publish') {
    await authorize(request, env); if (!env.DB) throw new HttpError(503, 'database_not_configured');
    if (!env.ASSETS) throw new HttpError(503, 'assets_not_configured');
    const parsed = mapPublication.safeParse(await readJson(request)); if (!parsed.success) throw new HttpError(400, 'invalid_map');
    const content = JSON.stringify(parsed.data); const hash = await digest(content); const objectKey = `maps/${hash}.json`;
    const previous = await env.DB.prepare('SELECT digest FROM map_versions WHERE map_id=? AND version=?').bind(parsed.data.id, parsed.data.version).first<{ digest: string }>();
    if (previous && previous.digest !== hash) throw new HttpError(409, 'version_already_published');
    await env.ASSETS.put(objectKey, content, { httpMetadata: { contentType: 'application/json', cacheControl: 'public, max-age=31536000, immutable' } });
    await env.DB.prepare('INSERT OR IGNORE INTO map_versions (digest,map_id,version,object_key,published_at) VALUES (?,?,?,?,?)').bind(hash, parsed.data.id, parsed.data.version, objectKey, new Date().toISOString()).run();
    // A concurrent publisher may have won the version constraint after our read.
    const stored = await env.DB.prepare('SELECT digest FROM map_versions WHERE map_id=? AND version=?').bind(parsed.data.id, parsed.data.version).first<{ digest: string }>();
    if (stored?.digest !== hash) throw new HttpError(409, 'version_already_published');
    return ok({ digest: hash, path: `/api/maps/assets/${hash}`, runtimeActivation: 'not_supported_metadata_only' }, 201);
  }
  if (request.method !== 'GET') return fail('method_not_allowed', 405);
  if (path === '/api/health' || path === '/api/v1/health' || path === '/api/status') return ok(await health(env));
  if (path === '/api/game' || path === '/.well-known/platphorm.json') return ok(gameInfo);
  if (path === '/api/maps') return ok({ maps: [bundledMap] });
  if (path === '/api/maps/volt-dome') return ok(bundledMap);
  if (path === '/api/modes') return ok({ local: gameInfo.local.modes, online: gameInfo.online.modes });
  if (path === '/api/release') return ok({ release: env.RELEASE, environment: env.ENVIRONMENT });
  if (path === '/api/leaderboards') {
    if (!env.DB) throw new HttpError(503, 'database_not_configured');
    const rows = await env.DB.prepare('SELECT winner_fighter AS fighter, COUNT(*) AS wins FROM match_results WHERE winner_fighter IS NOT NULL GROUP BY winner_fighter ORDER BY wins DESC LIMIT 5').all();
    return ok({ status: rows.results.length ? 'available' : 'empty', scope: 'fighter_wins', playerRankings: 'unsupported_no_player_identity', entries: rows.results });
  }
  if (/^\/api\/maps\/assets\/[a-f0-9]{64}$/.test(path)) {
    if (!env.DB || !env.ASSETS) throw new HttpError(503, 'assets_not_configured');
    const hash = path.slice('/api/maps/assets/'.length);
    const record = await env.DB.prepare('SELECT object_key FROM map_versions WHERE digest=?').bind(hash).first<{ object_key: string }>();
    if (!record) return fail('map_not_found', 404);
    const object = await env.ASSETS.get(record.object_key); if (!object) throw new HttpError(503, 'map_object_missing');
    return new Response(object.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=31536000, immutable', ETag: object.httpEtag } });
  }
  if (path === '/api/openapi.json' || path === '/openapi.yaml') return Response.json(openapi(env), { headers: { 'Content-Type': path.endsWith('.yaml') ? 'application/yaml' : 'application/json' } });
  if (path === '/api' || path === '/api/docs') return ok({ product: gameInfo.name, routes: paths, openapi: '/api/openapi.json', protected: ['/api/rooms', '/api/maps/publish'], websocket: { path: '/api/rooms/{roomId}/socket', protocols: ['frwf-v1', 'operator-issued player ticket'], heartbeatSeconds: 10, resumeSeconds: 30 }, limitations: gameInfo.online.limitations });
  if (path === '/api/mcp' || path === '/.well-known/mcp.json') return ok({ name: 'RINGFALL game backend', endpoint: '/api/mcp', transport: 'JSON-RPC 2.0', tools, auth: 'public read-only introspection; room creation is a protected REST operation' });
  if (path === '/.well-known/trust.json') return ok({ policy, auth: 'PLATPHORM_API_KEY', trustedDomains: ['*.platphormnews.com'], browserOrigin: env.PUBLIC_ORIGIN, publicReadAccess: true, protectedActions: ['room creation', 'map publication'], delegatedAccess: 'A room ticket authorizes one player seat for one hour; never exposes the platform key.', dataExposure: 'No player identity, IP, raw command body or credentials in public discovery.', unsupported: ['trace export', 'report generation', 'telemetry ingestion', 'public matchmaking'] });
  if (path === '/.well-known/agents.json' || path === '/.well-known/ai-plugin.json' || path === '/llms-index.json') return ok({ name: gameInfo.name, canonicalUrl: gameInfo.canonicalUrl, api: '/api/docs', mcp: '/api/mcp', capabilities: tools.map(tool => tool.name), game: gameInfo });
  if (path === '/llms.txt' || path === '/llms-full.txt') return new Response(`# ${gameInfo.name}\n\nVercel delivers the game. This Worker operates protected private online rooms and durable match results.\n\n- [Game](${gameInfo.canonicalUrl})\n- [API](/api/docs)\n- [Health](/api/health)\n- [MCP](/api/mcp)\n\n${gameInfo.online.limitations.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  if (path === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nSitemap: ${env.PUBLIC_ORIGIN}/sitemap.xml\n`);
  if (path === '/.well-known/security.txt') return new Response('Contact: https://github.com/mbarbine/platphorm-frwf/security\nExpires: 2027-09-07T00:00:00Z\n');
  if (path === '/sitemap.xml' || path === '/sitemap-index.xml') return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${gameInfo.canonicalUrl}</loc></url></urlset>`, { headers: { 'Content-Type': 'application/xml' } });
  if (path === '/rss.xml') return new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>RINGFALL</title><link>${gameInfo.canonicalUrl}</link><description>Release feed; no release events published by this backend.</description></channel></rss>`, { headers: { 'Content-Type': 'application/rss+xml' } });
  if (path === '/feed.xml') return new Response(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><id>${gameInfo.canonicalUrl}</id><title>RINGFALL</title><updated>2026-09-07T00:00:00Z</updated><link href="${gameInfo.canonicalUrl}"/></feed>`, { headers: { 'Content-Type': 'application/atom+xml' } });
  if (path === '/manifest.webmanifest') return Response.json({ name: gameInfo.name, short_name: 'RINGFALL', start_url: gameInfo.canonicalUrl, display: 'standalone', icons: [], description: 'Game backend; installability is owned by the Vercel client.' });
  return fail('not_found', 404);
}

export default {
  async fetch(request: Request, env: Env) {
    let response: Response;
    try { response = await route(request, env); } catch (error) { response = error instanceof HttpError ? fail(error.code, error.status) : fail('backend_unavailable', 503); }
    if (response.status === 101) return response;
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff'); headers.set('Referrer-Policy', 'no-referrer');
    headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
    const incoming = request.headers.get('traceparent') ?? '';
    const match = /^00-([a-f0-9]{32})-([a-f0-9]{16})-([a-f0-9]{2})$/.exec(incoming);
    const traceId = match?.[1] && match[2] && !/^0+$/.test(match[1]) && !/^0+$/.test(match[2]) ? match[1] : crypto.randomUUID().replaceAll('-', '');
    const spanId = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
    headers.set('traceparent', `00-${traceId}-${spanId}-01`); headers.set('X-PlatPhorm-Trace-Id', traceId);
    headers.set('X-PlatPhorm-Request-Id', crypto.randomUUID());
    if (response.status === 429) headers.set('Retry-After', '60');
    if (request.headers.get('Origin') === env.PUBLIC_ORIGIN) {
      headers.set('Access-Control-Allow-Origin', env.PUBLIC_ORIGIN); headers.set('Vary', 'Origin');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-PlatPhorm-API-Key, traceparent');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
