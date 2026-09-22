import { describe, expect, it } from 'vitest';
import { advanceMatch, createFighterRuntime, createMatch, requestCommand } from '../index.js';

describe('combat simulation API exports', () => {
  it('creates a match with fighters and initial state', () => {
    const match = createMatch('atlas', 'nova');
    expect(match).toBeDefined();
    expect(match.fighters.size).toBe(2);
    expect(match.resolved).toBe(false);
  });

  it('creates a fighter runtime instance', () => {
    const runtime = createFighterRuntime('atlas', { x: -1, z: 0 });
    expect(runtime.fighterId).toBe('atlas');
    expect(runtime.posX).toBe(-1);
    expect(runtime.health).toBe(100);
  });

  it('advances a match simulation frame', () => {
    const match = createMatch('atlas', 'nova');
    const initialElapsed = match.elapsed;
    advanceMatch(match, 1 / 30, { move: { x: 0, z: 0 }, run: false, block: false });
    expect(match.elapsed).toBeGreaterThan(initialElapsed);
  });

  it('accepts valid commands for fighters', () => {
    const match = createMatch('atlas', 'nova');
    const accepted = requestCommand(match, 'p1', 'quick', { x: 0, z: 0 });
    expect(accepted).toBe(true);
  });
});
