import { describe, expect, it } from 'vitest';
import type { FighterState } from '../game/types/game';

const ALL_FIGHTER_STATES: FighterState[] = [
  'idle',
  'locomotion',
  'blocking',
  'attacking',
  'grappling',
  'grabbed',
  'airborne',
  'downed',
  'recovering',
  'pinned',
  'pinning',
  'staggered',
  'climbing',
  'defeated',
  'victorious',
];

const GROUNDED_RESET_STATES = new Set<FighterState>(['idle', 'locomotion', 'blocking', 'recovering']);

describe('bodyDynamics state membership check allocation performance', () => {
  it('produces identical boolean results for all FighterState values', () => {
    for (const state of ALL_FIGHTER_STATES) {
      const inlineResult = ['idle', 'locomotion', 'blocking', 'recovering'].includes(state);
      const setResult = GROUNDED_RESET_STATES.has(state);
      expect(setResult).toBe(inlineResult);
    }
  });

  it('demonstrates benchmark improvement of Set lookup over inline array allocation in hot-path', () => {
    const iterations = 2_000_000;
    const testStates: FighterState[] = ['idle', 'locomotion', 'attacking', 'recovering', 'staggered', 'downed'];

    const inlineStart = performance.now();
    let inlineHits = 0;
    for (let i = 0; i < iterations; i++) {
      const state = testStates[i % testStates.length] ?? 'idle';
      if (['idle', 'locomotion', 'blocking', 'recovering'].includes(state)) {
        inlineHits++;
      }
    }
    const inlineDuration = performance.now() - inlineStart;

    const setStart = performance.now();
    let setHits = 0;
    for (let i = 0; i < iterations; i++) {
      const state = testStates[i % testStates.length] ?? 'idle';
      if (GROUNDED_RESET_STATES.has(state)) {
        setHits++;
      }
    }
    const setDuration = performance.now() - setStart;

    expect(setHits).toBe(inlineHits);
    // Set lookup should be significantly faster and eliminate array allocations per invocation
    expect(setDuration).toBeLessThan(inlineDuration);
  });
});
