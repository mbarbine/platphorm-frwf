import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureCombatVenue, venueFor } from '../game/data/venues';
import { createMatch, requestCommand, resetTransientState } from '../game/systems/combat';
import { resolveContextAction } from '../game/systems/contextResolver';
import { isActionLegal } from '../game/ai/utilityAI';
import { circuitProgress, earnedMedals } from '../game/world/circuit';
import { freshWorld, parseWorldSave, useWorldSession } from '../game/world/worldSession';
import type { MatchResult } from '../game/types/game';
import { WORLD_ENCOUNTERS, canStandAt, encounterForFighter } from '../game/world/showground';

const result = (patch: Partial<MatchResult> = {}): MatchResult => ({ winner: 'player', method: 'PINFALL', duration: 60, hype: 70, grade: 'A', playerStats: { damageDealt: 90, counters: 1, grapples: 2, finishers: 0, nearFalls: 1, propImpacts: 0 }, highlights: { bestSpot: null, bestSlam: null, mostBrutalImpact: null, mostUnexpectedReversal: null }, ...patch });
afterEach(() => vi.unstubAllGlobals());
describe('location-specific physical wrestling rules', () => {
  it.each(['yard', 'backstage'] as const)('rematches in %s with fresh usable props and the same bounds', venue => {
    const model = createMatch('atlas', 'nova', 'chaos', 'normal'); configureCombatVenue(model, venue);
    const table = model.props[0]; if (!table) throw new Error('Table missing'); table.broken = true;
    const next = resetTransientState(model);
    expect(next.venue).toBe(venue); expect(next.props.every(p => !p.broken && Math.abs(p.position.x) < venueFor(next).halfWidth && Math.abs(p.position.z) < venueFor(next).halfDepth)).toBe(true);
    expect(next.propsById['table-1']).toBe(next.props[0]); expect(next.runtimeId).not.toBe(model.runtimeId);
  });
  it.each(['yard', 'backstage'] as const)('never offers phantom rope or corner traversal in %s', venue => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal'); configureCombatVenue(model, venue);
    for (const position of [{ x: 5, z: 3.3 }, { x: 6.2, z: 0 }, { x: 0, z: 4 }]) {
      model.player.position = position; model.opponent.position = { x: -3, z: -1 };
      expect(resolveContextAction(model, 'player').legalState).toBe(false); expect(isActionLegal(model, 'context', 'player')).toBe(false);
    }
  });
  it('calls a real table slam instead of moving toward an absent corner', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'easy'); configureCombatVenue(model, 'yard');
    model.player.position = { x: -.8, z: -3.2 }; model.opponent.position = { x: .8, z: -3.2 };
    expect(requestCommand(model, 'player', 'grapple')).toBe(true);
    expect(resolveContextAction(model, 'player').actionId).toBe('environmental_wrestling_move');
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.moveId).toBe('slam');
  });
  it('retains pinfalls outside the former ring footprint', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal'); configureCombatVenue(model, 'yard');
    model.player.position = { x: 7, z: 4 }; model.opponent.position = { x: 7, z: 4.9 }; model.opponent.state = 'downed';
    expect(resolveContextAction(model, 'player').actionId).toBe('pin');
  });
});
describe('earned local circuit progression', () => {
  it('requires actual victorious wrestling stats and excludes forfeits', () => {
    expect(earnedMedals(result())).toEqual(['victory', 'wrestler', 'showstopper']);
    expect(earnedMedals(result({ winner: 'opponent' }))).toEqual([]);
    expect(earnedMedals(result({ method: 'FORFEIT' }))).toEqual([]);
    expect(earnedMedals(result({ method: 'KNOCKOUT', playerStats: { ...result().playerStats, grapples: 0 } }))).toEqual(['victory']);
  });
  it('migrates old device saves and filters unknown medals', () => {
    const legacy = { version: 1, fighter: 'atlas', position: { x: 0, z: 20 }, facing: 0, visited: ['showground'], results: { warmup: { bouts: 2, wins: 1 } } };
    expect(parseWorldSave(JSON.stringify(legacy)).results).toEqual(legacy.results);
    expect(parseWorldSave(JSON.stringify(legacy)).medals).toEqual({ warmup: ['victory'] });
    expect(parseWorldSave(JSON.stringify({ ...legacy, medals: { warmup: ['victory', 'victory', 'admin'], unknown: ['showstopper'] } })).medals).toEqual({ warmup: ['victory'] });
  });
  it('persists each medal once and does not reward abandon or repeated finish calls', () => {
    const values = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k), setItem: (k: string, v: string) => values.set(k, v) });
    useWorldSession.setState({ save: freshWorld(), activeEncounter: null }); const session = useWorldSession.getState();
    session.move({ x: 0, z: 11 }, 0); expect(session.begin('warmup')).toBe(true); session.finish(true, result()); session.finish(true, result());
    expect(useWorldSession.getState().save.results.warmup?.bouts).toBe(1);
    const before = circuitProgress(useWorldSession.getState().save.results, useWorldSession.getState().save.medals);
    session.begin('warmup'); session.finish(true, result());
    expect(circuitProgress(useWorldSession.getState().save.results, useWorldSession.getState().save.medals)).toEqual(before);
    session.begin('warmup'); session.abandon(); expect(useWorldSession.getState().save.results.warmup?.bouts).toBe(2);
    expect(parseWorldSave(values.get('frwf.showground.v1') ?? null).medals.warmup).toHaveLength(3);
  });
  it('checks circuit unlocks at encounter entry even when the player reaches a locked host', () => {
    useWorldSession.setState({ save: { ...freshWorld(), position: { x: 15, z: 8 } }, activeEncounter: null });
    expect(useWorldSession.getState().begin('scrapyard')).toBe(false);
    useWorldSession.setState({ save: { ...useWorldSession.getState().save, results: { warmup: { bouts: 5, wins: 5 }, sparring: { bouts: 1, wins: 1 } } } });
    expect(useWorldSession.getState().begin('scrapyard')).toBe(true);
  });
  it('gives each host a reachable interaction point and a distinct opponent', () => {
    for (const encounter of WORLD_ENCOUNTERS) {
      expect(canStandAt({ x: encounter.position.x, z: encounter.position.z + 1.5 })).toBe(true);
      expect(encounterForFighter(encounter, encounter.host).host).not.toBe(encounter.host);
    }
  });
});
