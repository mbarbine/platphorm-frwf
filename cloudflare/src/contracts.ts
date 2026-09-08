import { z } from 'zod';
import { PROTOCOL_VERSION } from '../../packages/game-protocol/src/version';
import { VOLT_DOME } from '../../src/game/data/arena';

export const fighterId = z.enum(['atlas', 'vex', 'nova', 'brick', 'chad']);
export const roomOptions = z.object({ ruleset: z.enum(['standard', 'chaos']).default('standard') }).strict();
const action = z.object({
  action: z.enum(['move', 'run', 'quickStrike', 'heavyStrike', 'grapple', 'guard']),
  phase: z.enum(['started', 'held', 'released']),
  sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  timestamp: z.number().finite().nonnegative(),
  direction: z.object({ x: z.number().finite().min(-1).max(1), y: z.number().finite().min(-1).max(1) }).strict(),
  source: z.literal('network'),
}).strict();
const version = { protocolVersion: z.literal(PROTOCOL_VERSION) };
export const clientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('command'), ...version, seq: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), event: action, clientTimestamp: z.number().finite().nonnegative() }).strict(),
  z.object({ type: z.literal('selectFighter'), ...version, fighterId }).strict(),
  z.object({ type: z.literal('ready'), ...version }).strict(),
  z.object({ type: z.literal('rematch'), ...version }).strict(),
  z.object({ type: z.literal('ping'), ...version, clientTimestamp: z.number().finite().nonnegative() }).strict(),
]);

export const gameInfo = {
  name: 'RINGFALL: CHAOS CIRCUIT', canonicalUrl: 'https://frwf.platphormnews.com',
  map: 'volt-dome', fighters: fighterId.options, protocolVersion: PROTOCOL_VERSION,
  local: { world: { locations: ['showground', 'backstage', 'ringside'], encounters: 6, venues: ['yard', 'backstage', 'dome'], combat: 'instanced_bouts', persistence: 'device_local_only' }, wrestling: ['physical strikes', 'paired throws', 'supported breakfalls', 'geometric cross-body covers'], modes: ['singles', 'battle_royale'], rulesets: ['standard', 'chaos'], simulationHz: 60, renderer: 'Three.js + Rapier', inputs: ['keyboard', 'gamepad', 'touch', 'webxr'] },
  online: { modes: ['private_singles'], simulationHz: 30, commands: ['move', 'run', 'quickStrike', 'heavyStrike', 'grapple', 'guard'], limitations: ['Online rules are a smaller swept-contact simulation; not BodyWorks parity.', 'Operator-created room tickets required.', 'No public matchmaking or persistent player identity.'] },
} as const;

export const bundledMap = {
  id: 'volt-dome', version: '2.0.0', compatibilityVersion: 1, title: 'The Volt Dome',
  geometry: VOLT_DOME,
  spawns: [{ x: -3.25, z: 0 }, { x: 3.25, z: 0 }, { x: 0, z: -2.45 }, { x: -1.85, z: 2.35 }, { x: 1.85, z: 2.35 }],
  modes: ['singles', 'battle_royale'], author: 'PlatPhormNews',
  collisionAuthority: ['ring', 'floor', 'ropes', 'posts', 'steps', 'barricades', 'props'],
  delivery: 'bundled-procedural',
};
// Published contracts identify the implemented arena, not arbitrary executable levels.
export const mapPublication = z.object({
  id: z.literal('volt-dome'), version: z.string().regex(/^\d+\.\d+\.\d+$/).max(24),
  compatibilityVersion: z.literal(1), title: z.string().min(1).max(80),
  spawns: z.array(z.object({ x: z.number().finite().min(-5.3).max(5.3), z: z.number().finite().min(-3.8).max(3.8) }).strict()).length(5),
  geometry: z.literal('bundled-volt-dome-v2'),
}).strict().superRefine((map, ctx) => {
  for (let i = 0; i < map.spawns.length; i++) for (let j = i + 1; j < map.spawns.length; j++) {
    const a = map.spawns[i]; const b = map.spawns[j];
    if (a && b && Math.hypot(a.x - b.x, a.z - b.z) < 1.2) ctx.addIssue({ code: 'custom', message: 'Spawn points overlap', path: ['spawns', j] });
  }
});

export async function readJson(request: Request, limit = 16384): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'json_required');
  if (Number(request.headers.get('content-length')) > limit) throw new HttpError(413, 'payload_too_large');
  const reader = request.body?.getReader(); if (!reader) throw new HttpError(400, 'invalid_json');
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      total += value.byteLength; if (total > limit) { await reader.cancel(); throw new HttpError(413, 'payload_too_large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'invalid_json'); }
  finally { reader.releaseLock(); }
}
export class HttpError extends Error { constructor(readonly status: number, readonly code: string) { super(code); } }
export const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
