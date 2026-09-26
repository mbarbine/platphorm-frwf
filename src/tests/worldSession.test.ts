import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canStandAt, moveThroughWorld, nearbyEncounter, regionAt, WORLD_START, WORLD_ENCOUNTERS, encounterForFighter } from '../game/world/showground';
import { freshWorld, parseWorldSave, useWorldSession } from '../game/world/worldSession';
import { createMatch, advanceMatch } from '../game/systems/combat';

describe('connected showground movement', () => {
  it('walks between the yard, backstage and ringside through real openings', () => {
    let position = { ...WORLD_START };
    const walkTo = (x: number, z: number) => {
      for (let i = 0; i < 500 && Math.hypot(x - position.x, z - position.z) > .08; i++) {
        const distance = Math.hypot(x - position.x, z - position.z);
        position = moveThroughWorld(position, { x: (x - position.x) / distance, z: (z - position.z) / distance }, Math.min(.1, distance));
        expect(canStandAt(position)).toBe(true);
      }
      expect(Math.hypot(x - position.x, z - position.z)).toBeLessThan(.1);
    };
    walkTo(-2, 20); walkTo(-2, -3); walkTo(-13.5, -3); walkTo(-13.5, -11);
    expect(regionAt(position)).toBe('backstage'); expect(nearbyEncounter(position)?.id).toBe('sparring');
    walkTo(-13.5, -3); walkTo(10, -2.5);
    expect(regionAt(position)).toBe('ringside'); expect(nearbyEncounter(position)?.id).toBe('main-event');
  });
  it('stops at the ring and slides along walls without diagonal speed boosts', () => {
    let position = { x: 9, z: -3 };
    for (let i = 0; i < 100; i++) position = moveThroughWorld(position, { x: 0, z: -1 }, .5);
    expect(position.z).toBeGreaterThan(-5); expect(canStandAt(position)).toBe(true);
    const straight = moveThroughWorld(WORLD_START, { x: 1, z: 0 }, .5);
    const diagonal = moveThroughWorld(WORLD_START, { x: 1, z: 1 }, .5);
    expect(Math.hypot(diagonal.x, diagonal.z - WORLD_START.z)).toBeCloseTo(Math.hypot(straight.x, straight.z - WORLD_START.z));
    expect(moveThroughWorld(WORLD_START, { x: NaN, z: 0 }, Infinity)).toEqual(WORLD_START);
  });
});
describe('device-local world continuity', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.restoreAllMocks();
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), clear: () => values.clear() });
    useWorldSession.setState({ save: freshWorld(), activeEncounter: null });
  });
  it('preserves position and actual completed results without awarding abandoned bouts', () => {
    const session = useWorldSession.getState(); session.enter('chad');
    expect(session.begin('main-event')).toBe(false);
    session.move({ x: 0, z: 11 }, Math.PI); expect(session.begin('warmup')).toBe(true);
    session.finish(true); session.finish(true);
    expect(useWorldSession.getState().save.results.warmup).toEqual({ bouts: 1, wins: 1 });
    expect(session.begin('warmup')).toBe(true); session.abandon();
    const restored = parseWorldSave(localStorage.getItem('frwf.showground.v1'));
    expect(restored.fighter).toBe('chad'); expect(restored.position).toEqual({ x: 0, z: 11 });
    expect(restored.results.warmup).toEqual({ bouts: 1, wins: 1 });
  });
  it('recovers corrupt, incompatible and obstructed saves at a valid checkpoint', () => {
    expect(parseWorldSave('broken')).toEqual(freshWorld());
    const bad = { ...freshWorld('chad'), position: { x: 11, z: -10 }, results: { warmup: { bouts: 1, wins: 99 } } };
    const parsed = parseWorldSave(JSON.stringify(bad));
    expect(parsed.position).toEqual(WORLD_START); expect(parsed.results).toEqual({}); expect(parsed.fighter).toBe('chad');
    expect(parseWorldSave(JSON.stringify({ ...bad, version: 200 }))).toEqual(freshWorld());
  });
  it('keeps exploration usable when browser storage is unavailable', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage denied'); });
    const session = useWorldSession.getState(); session.enter('nova'); session.move({ x: 0, z: 12 }, 0); session.checkpoint();
    expect(useWorldSession.getState().save.position.z).toBe(12); expect(useWorldSession.getState().saveStatus).toBe('unavailable');
  });
});
it('easy practice gives five seconds to orient without weakening either wrestler', () => {
  const easy = createMatch('atlas', 'nova', 'standard', 'easy', 812);
  const normal = createMatch('atlas', 'nova', 'standard', 'normal', 812);
  expect(easy.player.health).toBe(normal.player.health); expect(easy.opponent.health).toBe(normal.opponent.health);
  for (let i = 0; i < 240; i++) advanceMatch(easy, 1 / 60, { move: { x: 0, z: 0 }, run: false, block: false });
  expect(easy.opponent.attackInstanceId).toBe(0); expect(easy.aiControllers.opponent.movement).toEqual({ x: 0, z: 0 });
});

it('stops at a host body instead of walking through the visible wrestler', () => {
  let position = { x: 0, z: 12 };
  for (let i = 0; i < 120; i++) position = moveThroughWorld(position, { x: 0, z: -1 }, .1);
  expect(position.z).toBeGreaterThanOrEqual(10.86); expect(position.z).toBeLessThan(11.1);
});

it('uses the same distinct rival for world presentation and the offered bout', () => {
  for (const encounter of WORLD_ENCOUNTERS) {
    const offered = encounterForFighter(encounter, encounter.host);
    expect(offered.host).not.toBe(encounter.host); expect(offered.id).toBe(encounter.id);
    expect(encounterForFighter(encounter, 'atlas')).toBe(encounter);
  }
});
