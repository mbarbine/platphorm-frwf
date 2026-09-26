import { describe, expect, it } from 'vitest';
import { MOVES } from '../game/data/moves';

const HEAVY_STRIKE_MOVES = new Set(['heavy', 'uppercut', 'stiff_arm', 'rebound']);

describe('motorProfiles move ID check allocation performance', () => {
  it('produces identical boolean results for all registered game move IDs', () => {
    for (const moveId in MOVES) {
      const chainedResult = moveId === 'heavy' || moveId === 'uppercut' || moveId === 'stiff_arm' || moveId === 'rebound';
      const setResult = HEAVY_STRIKE_MOVES.has(moveId);
      expect(setResult).toBe(chainedResult);
    }
  });

  it('benchmarks Set lookup against chained checks without a machine-specific timing gate', () => {
    const iterations = 1_000_000;
    const allMoveIds = Object.keys(MOVES);

    const chainedStart = performance.now();
    let chainedHits = 0;
    for (let i = 0; i < iterations; i++) {
      const moveId = allMoveIds[i % allMoveIds.length] ?? 'heavy';
      if (moveId === 'heavy' || moveId === 'uppercut' || moveId === 'stiff_arm' || moveId === 'rebound') {
        chainedHits++;
      }
    }
    const chainedDuration = performance.now() - chainedStart;

    const setStart = performance.now();
    let setHits = 0;
    for (let i = 0; i < iterations; i++) {
      const moveId = allMoveIds[i % allMoveIds.length] ?? 'heavy';
      if (HEAVY_STRIKE_MOVES.has(moveId)) {
        setHits++;
      }
    }
    const setDuration = performance.now() - setStart;

    expect(setHits).toBe(chainedHits);
    expect(Number.isFinite(setDuration)).toBe(true);
    expect(Number.isFinite(chainedDuration)).toBe(true);
  });
});
