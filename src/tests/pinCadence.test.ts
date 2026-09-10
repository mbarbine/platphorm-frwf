import { describe, expect, it } from 'vitest';
import { advanceMatch, createMatch } from '../game/systems/combat';
const input = { move: { x: 0, z: 0 }, run: false, block: false, commands: [] };
function cover(health = 10) {
  const model = createMatch('atlas', 'nova', 'standard', 'normal');
  model.player.state = 'pinning'; model.opponent.state = 'pinned'; model.opponent.health = health; model.opponent.stamina = 0;
  return model;
}
describe('a real three-count and a complete kick-out window', () => {
  it('announces each count after a full second and never resolves early', () => {
    const model = cover();
    advanceMatch(model, .9, input); expect(model.player.pinCount).toBe(0);
    advanceMatch(model, .1, input); expect(model.player.pinCount).toBe(1);
    advanceMatch(model, 1, input); expect(model.player.pinCount).toBe(2); expect(model.resolved).toBe(false);
    model.slowMotion = 0;
    advanceMatch(model, .9, input); expect(model.player.pinCount).toBe(2); expect(model.resolved).toBe(false);
    advanceMatch(model, .1, input); expect(model.result?.method).toBe('PINFALL');
  });
  it('lets a fresh opponent escape an early cover instead of awarding an easy win', () => {
    const model = cover(100); model.opponent.stamina = model.opponent.staminaCap;
    for (let i = 0; i < 300 && model.opponent.state === 'pinned'; i++) advanceMatch(model, 1 / 60, input);
    expect(model.resolved).toBe(false); expect(model.playerStats.nearFalls).toBe(1); expect(model.opponent.state).toBe('downed');
  });
  it('accepts a player kick-out after two seconds until the third count', () => {
    const model = cover(); model.player.state = 'pinned'; model.opponent.state = 'pinning'; model.player.health = 60; model.player.stamina = 20;
    model.opponent.stateElapsed = 2.6; model.opponent.pinCount = 2; model.player.pinEscape = 90;
    advanceMatch(model, .01, { ...input, commands: ['context'] });
    expect(model.resolved).toBe(false); expect(model.player.state).toBe('downed'); expect(model.opponentStats.nearFalls).toBe(1);
  });
});
