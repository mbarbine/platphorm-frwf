import { describe, expect, it } from 'vitest';
import { ALL_BODY_SEGMENTS } from '../game/physics/bodySchema';

describe('bodySchema gripAnchorEligible allocation performance', () => {
  it('produces identical boolean results for all body segment IDs', () => {
    for (const id of ALL_BODY_SEGMENTS) {
      const inlineResult = ['head', 'chest', 'abdomen', 'pelvis'].includes(id);
      const directResult = id === 'head' || id === 'chest' || id === 'abdomen' || id === 'pelvis';
      expect(directResult).toBe(inlineResult);
    }
  });

  it('benchmarks direct equality checks without a machine-specific timing gate', () => {
    const iterations = 2_000_000;

    const inlineStart = performance.now();
    let inlineHits = 0;
    for (let i = 0; i < iterations; i++) {
      const id = ALL_BODY_SEGMENTS[i % ALL_BODY_SEGMENTS.length] ?? 'pelvis';
      if (['head', 'chest', 'abdomen', 'pelvis'].includes(id)) {
        inlineHits++;
      }
    }
    const inlineDuration = performance.now() - inlineStart;

    const directStart = performance.now();
    let directHits = 0;
    for (let i = 0; i < iterations; i++) {
      const id = ALL_BODY_SEGMENTS[i % ALL_BODY_SEGMENTS.length] ?? 'pelvis';
      if (id === 'head' || id === 'chest' || id === 'abdomen' || id === 'pelvis') {
        directHits++;
      }
    }
    const directDuration = performance.now() - directStart;

    expect(directHits).toBe(inlineHits);
    expect(Number.isFinite(directDuration)).toBe(true);
    expect(Number.isFinite(inlineDuration)).toBe(true);
  });
});
