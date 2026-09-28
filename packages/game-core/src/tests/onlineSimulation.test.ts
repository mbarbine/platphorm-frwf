import { describe, expect, it } from 'vitest';
import type { ActionEvent, GameAction } from '@frwf/game-protocol';
import { applyOnlineAction, createOnlineMatch, stepOnlineMatch } from '../onlineSimulation.js';

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
