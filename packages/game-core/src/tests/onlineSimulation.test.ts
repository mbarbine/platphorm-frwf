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
  it('moves only from a sequenced player command and rejects duplicates', () => {
    const match = createOnlineMatch([{ sessionId: 'p1', fighterId: 'atlas' }, { sessionId: 'p2', fighterId: 'nova' }]);
    expect(applyOnlineAction(match, 'p1', action('move', 1, { x: 1, y: 0 }), 1)).toBe(true);
    advance(match, .2);
    expect(match.fighters.get('p1')?.posX).toBeGreaterThan(-1.8);
    expect(applyOnlineAction(match, 'p1', action('move', 1, { x: -1, y: 0 }), 1)).toBe(false);
    expect(match.fighters.get('p1')?.lastCommandSeq).toBe(1);
  });

  it('expires movement when held input stops arriving', () => {
    const match = createOnlineMatch([{ sessionId: 'p1', fighterId: 'atlas' }, { sessionId: 'p2', fighterId: 'nova' }]);
    expect(applyOnlineAction(match, 'p1', action('move', 1, { x: 1, y: 0 }), 1)).toBe(true);
    advance(match, .5);
    const player = match.fighters.get('p1');
    expect(player?.moveX).toBe(0);
    expect(player?.velocityX).toBe(0);
    expect(player?.posX).toBeLessThan(-1.2);
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
