import { describe, test, expect } from 'vitest';

describe('PhysicsRuntime Hot Loop Benchmark', () => {
  test('measures state membership check performance', () => {
    const iterations = 10_000_000;

    // Test data setup
    const keys = ['rival1', 'rival2', 'rival3'] as const;
    const model = {
      rival1: { state: 'idle' },
      rival2: { state: 'attacking' },
      rival3: { state: 'locomotion' },
    };

    // Baseline: Array.includes
    const startBaseline = performance.now();
    let baselineMatches = 0;
    for (let i = 0; i < iterations; i++) {
      const key = keys[i % 3] ?? 'rival1';
      const state = model[key].state;
      if (!['idle', 'locomotion'].includes(state)) {
        baselineMatches++;
      }
    }
    const endBaseline = performance.now();
    const baselineTime = endBaseline - startBaseline;

    // Optimized: Direct equality check
    const startOptimized = performance.now();
    let optimizedMatches = 0;
    for (let i = 0; i < iterations; i++) {
      const key = keys[i % 3] ?? 'rival1';
      const state = model[key].state;
      if (state !== 'idle' && state !== 'locomotion') {
        optimizedMatches++;
      }
    }
    const endOptimized = performance.now();
    const optimizedTime = endOptimized - startOptimized;

    console.log(`\n--- BENCHMARK RESULTS ---`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Baseline (Array.includes): ${baselineTime.toFixed(2)} ms`);
    console.log(`Optimized (state !== 'idle' && state !== 'locomotion'): ${optimizedTime.toFixed(2)} ms`);
    console.log(`Speedup: ${(baselineTime / optimizedTime).toFixed(2)}x (${((1 - optimizedTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`-------------------------\n`);

    expect(baselineMatches).toBe(optimizedMatches);
  });

  test('measures for...in vs ALL_BODY_SEGMENTS iteration performance', { timeout: 15_000 }, () => {
    const ALL_BODY_SEGMENTS = [
      'head', 'chest', 'abdomen', 'pelvis',
      'leftThigh', 'leftShin', 'leftFoot',
      'rightThigh', 'rightShin', 'rightFoot',
      'leftUpperArm', 'leftLowerArm', 'leftHand',
      'rightUpperArm', 'rightLowerArm', 'rightHand'
    ] as const;

    const bodies: Record<string, { isValid: () => boolean; mass: () => number }> = {};
    for (const seg of ALL_BODY_SEGMENTS) {
      bodies[seg] = { isValid: () => true, mass: () => 1.5 };
    }

    const iterations = 1_000_000;

    // Run baseline first
    let baselineMass = 0;
    const startBaseline = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const _segment in bodies) {
        const body = bodies[_segment];
        if (body?.isValid()) baselineMass += body.mass();
      }
    }
    const baselineTime = performance.now() - startBaseline;

    // Run optimized (for...of ALL_BODY_SEGMENTS) second
    let optimizedMass = 0;
    const startOptimized = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const segment of ALL_BODY_SEGMENTS) {
        const body = bodies[segment];
        if (body?.isValid()) optimizedMass += body.mass();
      }
    }
    const optimizedTime = performance.now() - startOptimized;

    console.log(`\n--- BODIES ITERATION BENCHMARK RESULTS ---`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Baseline (for...in): ${baselineTime.toFixed(2)} ms`);
    console.log(`Optimized (for...of ALL_BODY_SEGMENTS): ${optimizedTime.toFixed(2)} ms`);
    console.log(`Speedup: ${(baselineTime / optimizedTime).toFixed(2)}x (${((1 - optimizedTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`-------------------------------------------\n`);

    expect(optimizedMass).toBe(baselineMass);
  });
});
