// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FighterState } from '../game/types/game';

describe('physicsRuntime hot-path array allocation benchmark', () => {
  it('benchmarks array .includes vs Set .has for groundedControl check', () => {
    const states: FighterState[] = [
      'idle', 'locomotion', 'blocking', 'attacking', 'grappling',
      'recovering', 'staggered', 'victorious', 'downed', 'airborne',
      'jumping', 'climbing', 'pinning', 'pinned', 'defeated'
    ];

    const iterations = 10_000_000;

    // Baseline: Inline array creation + .includes()
    const startBaseline = performance.now();
    let trueCountBaseline = 0;
    for (let i = 0; i < iterations; i++) {
      const state = states[i % states.length];
      const isGrounded = ['idle', 'locomotion', 'blocking', 'attacking', 'grappling', 'recovering', 'staggered', 'victorious'].includes(state);
      if (isGrounded) trueCountBaseline++;
    }
    const durationBaseline = performance.now() - startBaseline;

    // Optimized: Module-level Set + .has()
    const GROUNDED_CONTROL_STATES = new Set<FighterState>([
      'idle', 'locomotion', 'blocking', 'attacking', 'grappling',
      'recovering', 'staggered', 'victorious'
    ]);

    const startOptimized = performance.now();
    let trueCountOptimized = 0;
    for (let i = 0; i < iterations; i++) {
      const state = states[i % states.length];
      const isGrounded = GROUNDED_CONTROL_STATES.has(state);
      if (isGrounded) trueCountOptimized++;
    }
    const durationOptimized = performance.now() - startOptimized;

    console.log(`\n--- BENCHMARK RESULTS ---`);
    console.log(`Baseline (inline array .includes): ${durationBaseline.toFixed(2)} ms`);
    console.log(`Optimized (Set .has):              ${durationOptimized.toFixed(2)} ms`);
    console.log(`Speedup:                           ${(durationBaseline / durationOptimized).toFixed(2)}x faster\n`);

    expect(trueCountBaseline).toBe(trueCountOptimized);
  });
});
