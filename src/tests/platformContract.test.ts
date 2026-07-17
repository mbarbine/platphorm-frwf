import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
const routes = [
  'public/api/health', 'public/api/v1/health', 'public/api/docs', 'public/openapi.yaml',
  'public/llms.txt', 'public/llms-full.txt', 'public/llms-index.json', 'public/robots.txt',
  'public/sitemap.xml', 'public/sitemap-index.xml', 'public/rss.xml', 'public/feed.xml',
  'public/manifest.webmanifest', 'public/.well-known/mcp.json', 'public/.well-known/agents.json',
  'public/.well-known/ai-plugin.json', 'public/.well-known/security.txt', 'public/.well-known/trust.json',
  'public/release.json', 'public/api/release',
] as const;

describe('PlatPhorm static game contract', () => {
  it('ships every applicable discovery surface with parseable structured files', () => {
    for (const route of routes) expect(existsSync(resolve(root, route)), route).toBe(true);
    for (const route of routes.filter((route) => route.endsWith('.json') || route.startsWith('public/api/'))) expect(() => JSON.parse(read(route))).not.toThrow();
    expect(read('public/rss.xml')).toMatch(/^<\?xml[^]*<rss/); expect(read('public/feed.xml')).toContain('<feed xmlns=');
    expect(read('public/sitemap.xml')).toContain('<urlset '); expect(read('public/sitemap-index.xml')).toContain('<sitemapindex ');
  });

  it('reports real game capabilities and honest static limitations', () => {
    const index = JSON.parse(read('public/llms-index.json')) as { data: { capabilities: string[] } };
    expect(index.data.capabilities).toEqual(expect.arrayContaining(['default_five_wrestler_battle_royale', 'battle_royale_target_cycle', 'battle_royale_spectator_controls', 'physical_grapple_and_slam', 'rope_rebound_and_ring_traversal', 'turnbuckle_aerials', 'webxr_arena_mode', 'spatial_audio']));
    const health = JSON.parse(read('public/api/health')) as { data: Record<string, unknown> };
    expect(health.data).toMatchObject({ status: 'operational', routeComplianceScore: 100, traceEnabled: false, vercelMetadataCaptured: false });
    expect(health.data.releaseIdentity).toMatchObject({ fighterCount: 5, moveCount: 36, criticalAssetCount: 1 });
    expect(health.data.observabilityComplianceScore).toBeNull();
  });

  it('uses the shared auth name, canonical host, trust policy, and XR delivery permission without leaking a key', () => {
    const publicText = routes.map(read).join('\n');
    for (const forbidden of ['TRACE_API_KEY', 'CLAWS_API_KEY', 'BROWSEROPS_API_KEY', 'DOCS_API_KEY', 'PLATPHORM_MCP_API_KEY']) expect(publicText).not.toContain(forbidden);
    expect(read('public/openapi.yaml')).toContain('https://frwf.platphormnews.com');
    expect(read('public/.well-known/trust.json')).toContain('PLATPHORM_API_KEY');
    expect(read('vercel.json')).toContain('xr-spatial-tracking=(self)');
  });
});
