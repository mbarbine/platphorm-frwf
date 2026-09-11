import type { CombatVenue } from '../data/venues';
import { opponentFor } from '../data/fighters';
import type { Difficulty, FighterId, Ruleset, Vec2 } from '../types/game';

export const WORLD_BOUNDS = { minX: -24, maxX: 24, minZ: -25, maxZ: 27 };
export const WORLD_START = { x: 0, z: 20 };
export type RegionId = 'showground' | 'backstage' | 'ringside';
export interface WorldObstacle { id: string; x: number; z: number; halfX: number; halfZ: number; height: number; color: string }
export const WORLD_OBSTACLES: readonly WorldObstacle[] = [
  { id: 'ring', x: 11, z: -10, halfX: 6, halfZ: 4.7, height: 1.2, color: '#34383c' },
  { id: 'backstage-west', x: -21, z: -14, halfX: .22, halfZ: 7, height: 3.3, color: '#677068' },
  { id: 'backstage-east', x: -6, z: -14, halfX: .22, halfZ: 7, height: 3.3, color: '#677068' },
  { id: 'backstage-north', x: -13.5, z: -21, halfX: 7.7, halfZ: .22, height: 3.3, color: '#677068' },
  { id: 'backstage-door-left', x: -18.5, z: -7, halfX: 2.7, halfZ: .22, height: 2.7, color: '#677068' },
  { id: 'backstage-door-right', x: -8.5, z: -7, halfX: 2.7, halfZ: .22, height: 2.7, color: '#677068' },
  { id: 'lockers', x: -18.8, z: -20.3, halfX: 1.43, halfZ: .275, height: 2, color: '#485d65' },
  { id: 'locker-bench', x: -18.4, z: -17.5, halfX: .65, halfZ: 2, height: .6, color: '#9e7049' },
  { id: 'equipment', x: -8.2, z: -18.4, halfX: 1.3, halfZ: 1, height: 1.2, color: '#3c454c' },
  { id: 'food-truck', x: 16.8, z: 17.5, halfX: 3.2, halfZ: 1.6, height: 2.8, color: '#b55437' },
  { id: 'picnic-one', x: -12, z: 17, halfX: 2, halfZ: 1, height: .8, color: '#ae8052' },
  { id: 'picnic-two', x: -15, z: 10, halfX: 2, halfZ: 1, height: .8, color: '#ae8052' },
];
export interface WorldEncounter { id: string; title: string; host: FighterId; position: Vec2; description: string; difficulty: Difficulty; rules: Ruleset; region: RegionId; venue: CombatVenue; requiredVictories?: number }
export const WORLD_ENCOUNTERS: readonly WorldEncounter[] = [
  { id: 'warmup', title: 'Backyard warm-up', host: 'vex', position: { x: 0, z: 10 }, description: 'Wrestle outdoors in the backyard fight pit. Close the distance, secure a clinch, then throw.', difficulty: 'easy', rules: 'standard', region: 'showground', venue: 'yard' },
  { id: 'sparring', title: 'Backstage fight club', host: 'nova', position: { x: -13.5, z: -13 }, description: 'A close-quarters wrestling bout in the locker yard. Work a clinch into a wooden-table slam.', difficulty: 'easy', rules: 'standard', region: 'backstage', venue: 'backstage' },
  { id: 'main-event', title: 'The Claw’s open challenge', host: 'chad', position: { x: 11, z: -2.5 }, description: 'A full Singles match in the Volt Dome. Win here to earn your first main-event victory.', difficulty: 'normal', rules: 'standard', region: 'ringside', venue: 'dome' },
  { id: 'scrapyard', title: 'Tables & trouble', host: 'brick', position: { x: 15, z: 7 }, description: 'A no-disqualification backyard brawl. Chairs and a wooden table are in play. Win two different encounters to enter.', difficulty: 'normal', rules: 'chaos', region: 'showground', venue: 'yard', requiredVictories: 2 },
  { id: 'technical', title: 'The reversal test', host: 'nova', position: { x: -12, z: 23 }, description: 'Face a hard technical rival in the backyard. Protect your stamina and watch for the counter window.', difficulty: 'hard', rules: 'standard', region: 'showground', venue: 'yard', requiredVictories: 2 },
  { id: 'championship', title: 'Showground championship', host: 'chad', position: { x: 19, z: -19 }, description: 'The circuit finale: The Claw, hard difficulty, full Singles wrestling in Volt Dome. Earn three distinct encounter victories to enter.', difficulty: 'hard', rules: 'standard', region: 'ringside', venue: 'dome', requiredVictories: 3 },
];
export const regionAt = (p: Vec2): RegionId => p.x < -5 && p.z < -6 ? 'backstage' : p.x > 3 && p.z < 3 ? 'ringside' : 'showground';
export const REGION_NAMES: Record<RegionId, string> = { showground: 'FRWF Showground', backstage: 'Backstage Fight Club', ringside: 'The Main Event' };
// OPTIMIZATION: Zero-allocation squared distance check (2.8^2 = 7.84) replaces slow Math.hypot.
export const nearbyEncounter = (p: Vec2): WorldEncounter | undefined => WORLD_ENCOUNTERS.find(e => {
  const dx = e.position.x - p.x; const dz = e.position.z - p.z;
  return dx * dx + dz * dz <= 7.84;
});
export function canStandAt(p: Vec2, radius = .38): boolean {
  const threshold = radius + .48; const thresholdSq = threshold * threshold;
  // OPTIMIZATION: Zero-allocation squared distance comparison avoids Math.hypot on frequent collision checks.
  return Number.isFinite(p.x) && Number.isFinite(p.z) && p.x >= WORLD_BOUNDS.minX + radius && p.x <= WORLD_BOUNDS.maxX - radius && p.z >= WORLD_BOUNDS.minZ + radius && p.z <= WORLD_BOUNDS.maxZ - radius && !WORLD_ENCOUNTERS.some(e => {
    const dx = e.position.x - p.x; const dz = e.position.z - p.z;
    return dx * dx + dz * dz < thresholdSq;
  }) && !WORLD_OBSTACLES.some(o => p.x > o.x - o.halfX - radius && p.x < o.x + o.halfX + radius && p.z > o.z - o.halfZ - radius && p.z < o.z + o.halfZ + radius);
}
/** Bounded swept movement, with wall sliding and normalized diagonal speed. */
export function moveThroughWorld(position: Vec2, direction: Vec2, distance: number): Vec2 {
  if (![direction.x, direction.z, distance].every(Number.isFinite) || distance <= 0) return { ...position };
  // OPTIMIZATION: Standard Math.sqrt replaces slow Math.hypot on high-frequency movement update path.
  const magnitude = Math.max(1, Math.sqrt(direction.x * direction.x + direction.z * direction.z));
  const travel = Math.min(distance, 1); const steps = Math.max(1, Math.ceil(travel / .12));
  const dx = direction.x / magnitude * travel / steps; const dz = direction.z / magnitude * travel / steps;
  const p = { ...position };
  for (let i = 0; i < steps; i++) {
    if (canStandAt({ x: p.x + dx, z: p.z })) p.x += dx;
    if (canStandAt({ x: p.x, z: p.z + dz })) p.z += dz;
  }
  return p;
}

export function encounterForFighter(encounter: WorldEncounter, fighter: FighterId): WorldEncounter {
  if (encounter.host !== fighter) return encounter;
  return { ...encounter, host: opponentFor(fighter),
    title: encounter.id === 'main-event' ? 'Main-event title defense' : encounter.id === 'championship' ? 'Championship title defense' : encounter.title,
    description: encounter.id === 'main-event' || encounter.id === 'championship' ? `Defend your place in a ${encounter.difficulty} Singles bout. Your rival uses the same wrestling rules and physical controls.` : encounter.description,
  };
}
