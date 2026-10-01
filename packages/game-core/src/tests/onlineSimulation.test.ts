import { describe, expect, it } from 'vitest';
import type { ActionEvent, GameAction } from '@frwf/game-protocol';
import { applyOnlineAction, createOnlineMatch, eliminateOnlineFighter, stepOnlineMatch } from '../onlineSimulation.js';

const action = (name: GameAction, sequence: number, direction = { x: 0, y: 0 }, phase: ActionEvent['phase'] = 'started'): ActionEvent => ({
  action: name, phase, sequence, timestamp: sequence * 16, direction, source: 'network',
});

const advance = (match: ReturnType<typeof createOnlineMatch>, seconds: number): ReturnType<typeof stepOnlineMatch> => {
  let impacts: ReturnType<typeof stepOnlineMatch> = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 30) {
    const next = stepOnlineMatch(match, 1 / 30); if (next.length > 0) impacts = next;
  }
  return impacts;
};

describe('online deterministic authority', () => {
  it('moves with bounded acceleration from a sequenced command and rejects duplicates', () => {
    const match = createOnlineMatch([{ sessionId: 'p1', fighterId: 'atlas' }, { sessionId: 'p2', fighterId: 'nova' }]);
    expect(applyOnlineAction(match, 'p1', action('move', 1, { x: 1, y: 0 }), 1)).toBe(true);
    advance(match, .1);
    const player = match.fighters.get('p1');
    expect(player?.posX).toBeGreaterThan(-2.3);
    expect(player?.posX).toBeLessThan(-2.2);
    expect(player?.velocityX).toBeGreaterThan(0);
    expect(player?.velocityX).toBeLessThan(1.85);
    expect(applyOnlineAction(match, 'p1', action('move', 1, { x: -1, y: 0 }), 1)).toBe(false);
    expect(match.fighters.get('p1')?.lastCommandSeq).toBe(1);
  });

  it('eases to a stop when held input expires instead of freezing or coasting', () => {
    const match = createOnlineMatch([{ sessionId: 'p1', fighterId: 'atlas' }, { sessionId: 'p2', fighterId: 'nova' }]);
    expect(applyOnlineAction(match, 'p1', action('move', 1, { x: 1, y: 0 }), 1)).toBe(true);
    advance(match, .65);
    const player = match.fighters.get('p1');
    expect(player?.moveX).toBe(0);
    expect(player?.velocityX).toBeLessThan(.08);
    expect(player?.posX).toBeGreaterThan(-2.0);
    expect(player?.posX).toBeLessThan(-1.8);
  });

  it('keeps two ungrappled bodies from occupying the same space', () => {
    const match = createOnlineMatch([{ sessionId: 'p1', fighterId: 'atlas' }, { sessionId: 'p2', fighterId: 'nova' }]);
    const p1 = match.fighters.get('p1'); const p2 = match.fighters.get('p2');
    if (!p1 || !p2) throw new Error('missing fighters');
    p1.posX = 0; p1.posZ = 0; p2.posX = .05; p2.posZ = 0;
    for (let i = 0; i < 5; i += 1) advance(match, 1 / 30);
    expect(Math.hypot(p2.posX - p1.posX, p2.posZ - p1.posZ)).toBeGreaterThanOrEqual(.619);
    expect([p1.posX, p1.posZ, p2.posX, p2.posZ].every(Number.isFinite)).toBe(true);
  });

  it('does not award a punch outside swept collider contact', () => {
    const match = createOnlineMatch([{ sessionId: 'p1', fighterId: 'atlas' }, { sessionId: 'p2', fighterId: 'nova' }]);
    expect(applyOnlineAction(match, 'p1', action('quickStrike', 1), 1)).toBe(true);
    const impacts = advance(match, 1);
    expect(impacts).toHaveLength(0);
    expect(match.fighters.get('p2')?.health).toBe(100);
  });

  it('links hooks and an uppercut only after the prior recovery window opens', () => {
    const match = createOnlineMatch([{ sessionId: 'p1', fighterId: 'atlas' }, { sessionId: 'p2', fighterId: 'nova' }]);
    const p1 = match.fighters.get('p1');
    if (!p1) throw new Error('missing player');
    expect(applyOnlineAction(match, 'p1', action('quickStrike', 1), 1)).toBe(true);
    expect(p1.moveId).toBe('jab');
    expect(applyOnlineAction(match, 'p1', action('quickStrike', 2), 2)).toBe(false);
    advance(match, .5);
    expect(p1.attackPhase).toBe('recovery');
    expect(applyOnlineAction(match, 'p1', action('quickStrike', 3, { x: 1, y: 0 }), 3)).toBe(true);
    expect(p1.moveId).toBe('right_hook');
    advance(match, .55);
    expect(p1.attackPhase).toBe('recovery');
    expect(applyOnlineAction(match, 'p1', action('quickStrike', 4, { x: -1, y: 0 }), 4)).toBe(true);
    expect(p1.moveId).toBe('left_hook');
    advance(match, .55);
    expect(applyOnlineAction(match, 'p1', action('quickStrike', 5, { x: 0, y: -1 }), 5)).toBe(true);
    expect(p1.moveId).toBe('uppercut');
  });

  it('maps directional power inputs to a readable kick, roundhouse, or uppercut', () => {
    const match = createOnlineMatch([{ sessionId: 'p1', fighterId: 'atlas' }, { sessionId: 'p2', fighterId: 'nova' }]);
    const p1 = match.fighters.get('p1');
    if (!p1) throw new Error('missing player');
    expect(applyOnlineAction(match, 'p1', action('heavyStrike', 1, { x: 0, y: 1 }), 1)).toBe(true);
    expect(p1.moveId).toBe('front_kick');
    advance(match, 1.1);
    expect(applyOnlineAction(match, 'p1', action('heavyStrike', 2, { x: 1, y: 0 }), 2)).toBe(true);
    expect(p1.moveId).toBe('roundhouse');
    advance(match, 1.1);
    expect(applyOnlineAction(match, 'p1', action('heavyStrike', 3, { x: 0, y: -1 }), 3)).toBe(true);
    expect(p1.moveId).toBe('uppercut');
  });

  it('scores a visible-range jab only when its swept hand collider reaches the opponent', () => {
    const match = createOnlineMatch([{ sessionId: 'p1', fighterId: 'atlas' }, { sessionId: 'p2', fighterId: 'nova' }]);
    const p1 = match.fighters.get('p1'); const p2 = match.fighters.get('p2');
    if (!p1 || !p2) throw new Error('missing fighters');
    p1.posX = -.55; p2.posX = .55;
    expect(applyOnlineAction(match, 'p1', action('quickStrike', 1), 1)).toBe(true);
    const impacts = advance(match, 1);
    expect(impacts.some((impact) => impact.moveId === 'jab' && impact.targetSessionId === 'p2')).toBe(true);
    expect(p2.health).toBeLessThan(100);
  });

  it('requires grapple contact before a slam can damage and knock down', () => {
    const match = createOnlineMatch([{ sessionId: 'p1', fighterId: 'atlas' }, { sessionId: 'p2', fighterId: 'nova' }]);
    const p1 = match.fighters.get('p1'); const p2 = match.fighters.get('p2');
    if (!p1 || !p2) throw new Error('missing fighters');
    expect(applyOnlineAction(match, 'p1', action('heavyStrike', 1), 1)).toBe(true);
    advance(match, 1); expect(p2.health).toBe(100);

    p1.posX = -.45; p2.posX = .45;
    expect(applyOnlineAction(match, 'p1', action('grapple', 2), 2)).toBe(true);
    advance(match, .8); expect(p1.grappleTarget).toBe('p2'); expect(p2.combatState).toBe('grabbed');
    expect(applyOnlineAction(match, 'p1', action('heavyStrike', 3), 3)).toBe(true);
    const impacts = advance(match, 1.2);
    expect(impacts.some((impact) => impact.moveId === 'slam')).toBe(true);
    expect(p2.health).toBeLessThan(90); expect(p2.combatState).toMatch(/downed|idle/);
  });
});


describe('six-wrestler authoritative bouts', () => {
  const players = Array.from({ length: 6 }, (_, index) => ({ sessionId: `seat${index + 1}`, fighterId: 'atlas' as const }));

  it('spawns six distinct bodies facing toward the ring center', () => {
    const match = createOnlineMatch(players);
    expect(match.fighters.size).toBe(6);
    const actors = [...match.fighters.values()];
    for (const actor of actors) {
      expect(Math.sin(actor.facing) * actor.posX + Math.cos(actor.facing) * actor.posZ).toBeLessThan(-2);
      for (const other of actors) if (other !== actor) expect(Math.hypot(actor.posX - other.posX, actor.posZ - other.posZ)).toBeGreaterThan(2);
    }
  });

  it('accepts the same sequence independently from every human seat', () => {
    const match = createOnlineMatch(players);
    const initial = [...match.fighters.values()].map(actor => actor.posZ);
    for (const player of players) expect(applyOnlineAction(match, player.sessionId, action('move', 1, { x: 0, y: 1 }), 1)).toBe(true);
    advance(match, .1);
    [...match.fighters.values()].forEach((actor, index) => {
      expect(actor.posZ).toBeGreaterThan(initial[index] ?? Infinity);
      expect(actor.lastCommandSeq).toBe(1);
      expect(applyOnlineAction(match, actor.sessionId, action('move', 1), 1)).toBe(false);
    });
  });

  it('separates every pair when six bodies collide at the same point', () => {
    const match = createOnlineMatch(players);
    for (const actor of match.fighters.values()) { actor.posX = 0; actor.posZ = 0; }
    advance(match, 1);
    const actors = [...match.fighters.values()];
    for (const actor of actors) for (const other of actors) if (other !== actor) {
      expect(Math.hypot(actor.posX - other.posX, actor.posZ - other.posZ)).toBeGreaterThan(.61);
    }
  });

  it('continues after an elimination, rejects eliminated input, and crowns the last survivor', () => {
    const match = createOnlineMatch(players);
    eliminateOnlineFighter(match, 'seat1');
    expect(match.resolved).toBe(false);
    expect(applyOnlineAction(match, 'seat1', action('move', 1), 1)).toBe(false);
    advance(match, 2);
    expect(match.fighters.get('seat1')?.combatState).toBe('defeated');
    for (let seat = 2; seat <= 5; seat += 1) eliminateOnlineFighter(match, `seat${seat}`);
    expect(match.resolved).toBe(true);
    expect(match.winnerSessionId).toBe('seat6');
    expect(match.fighters.get('seat6')?.combatState).toBe('victorious');
  });

  it('hits the nearby wrestler rather than the first other seat in the roster', () => {
    const match = createOnlineMatch(players);
    const actor = match.fighters.get('seat1'); const target = match.fighters.get('seat6');
    if (!actor || !target) throw new Error('missing fighters');
    actor.posX = 0; actor.posZ = 0; actor.facing = Math.PI / 2;
    target.posX = 1.1; target.posZ = 0;
    expect(applyOnlineAction(match, 'seat1', action('quickStrike', 1), 1)).toBe(true);
    const impacts = advance(match, .6);
    expect(impacts.some(impact => impact.targetSessionId === 'seat6')).toBe(true);
    expect(target.health).toBeLessThan(100);
    expect(match.fighters.get('seat2')?.health).toBe(100);
  });

  it('keeps a committed punch facing fixed when another wrestler crosses behind', () => {
    const match = createOnlineMatch(players);
    const actor = match.fighters.get('seat1'); const target = match.fighters.get('seat6');
    if (!actor || !target) throw new Error('missing fighters');
    actor.posX = 0; actor.posZ = 0; actor.facing = Math.PI / 2;
    target.posX = -.8; target.posZ = 0;
    applyOnlineAction(match, 'seat1', action('quickStrike', 1), 1);
    advance(match, .3);
    expect(actor.facing).toBe(Math.PI / 2);
    expect(target.health).toBe(100);
  });

  it('rejects unsupported sizes and duplicate identities rather than overwriting players', () => {
    expect(() => createOnlineMatch(players.slice(0, 1))).toThrow();
    expect(() => createOnlineMatch([...players, { sessionId: 'seat7', fighterId: 'atlas' }])).toThrow();
    expect(() => createOnlineMatch([{ sessionId: 'same', fighterId: 'atlas' }, { sessionId: 'same', fighterId: 'nova' }])).toThrow();
  });
});
