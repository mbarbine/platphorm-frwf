import { describe, test, expect } from 'vitest';
import { ALL_BODY_SEGMENTS, type BodySegmentId } from '../game/physics/bodySchema';

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

    console.log(`\n--- BENCHMARK RESULTS (State Membership) ---`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Baseline (Array.includes): ${baselineTime.toFixed(2)} ms`);
    console.log(`Optimized (state !== 'idle' && state !== 'locomotion'): ${optimizedTime.toFixed(2)} ms`);
    console.log(`Speedup: ${(baselineTime / optimizedTime).toFixed(2)}x (${((1 - optimizedTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`-------------------------\n`);

    expect(baselineMatches).toBe(optimizedMatches);
  });

  test('measures for...in vs pre-cached bodyEntries iteration performance', { timeout: 15_000 }, () => {
    const iterations = 5_000_000;

    type MockBody = { mass: () => number; isValid: () => boolean };
    const mockBodies: Partial<Record<BodySegmentId, MockBody>> = {};
    const bodyEntries: { segment: BodySegmentId; body: MockBody }[] = [];
    const bodyList: MockBody[] = [];

    for (const seg of ALL_BODY_SEGMENTS) {
      const body = { mass: () => 10, isValid: () => true };
      mockBodies[seg] = body;
      bodyEntries.push({ segment: seg, body });
      bodyList.push(body);
    }
    const rig = { bodies: mockBodies, bodyEntries, bodyList };

    // Baseline: for...in loop over object keys
    const startBaseline = performance.now();
    let baselineMass = 0;
    for (let i = 0; i < iterations; i++) {
      for (const _segment in rig.bodies) {
        const body = rig.bodies[_segment as BodySegmentId];
        if (!body?.isValid()) continue;
        baselineMass += body.mass();
      }
    }
    const baselineTime = performance.now() - startBaseline;

    // for...of loop over ALL_BODY_SEGMENTS
    const startForOfAll = performance.now();
    let forOfAllMass = 0;
    for (let i = 0; i < iterations; i++) {
      for (const segment of ALL_BODY_SEGMENTS) {
        const body = rig.bodies[segment];
        if (!body?.isValid()) continue;
        forOfAllMass += body.mass();
      }
    }
    const forOfAllTime = performance.now() - startForOfAll;

    // Indexed for loop over pre-cached bodyEntries
    const startBodyEntries = performance.now();
    let bodyEntriesMass = 0;
    const entriesLen = rig.bodyEntries.length;
    for (let i = 0; i < iterations; i++) {
      for (let e = 0; e < entriesLen; e++) {
        const entry = rig.bodyEntries[e];
        if (!entry.body.isValid()) continue;
        bodyEntriesMass += entry.body.mass();
      }
    }
    const bodyEntriesTime = performance.now() - startBodyEntries;

    // Indexed for loop over pre-cached bodyList
    const startBodyList = performance.now();
    let bodyListMass = 0;
    const listLen = rig.bodyList.length;
    for (let i = 0; i < iterations; i++) {
      for (let b = 0; b < listLen; b++) {
        const body = rig.bodyList[b];
        if (!body.isValid()) continue;
        bodyListMass += body.mass();
      }
    }
    const bodyListTime = performance.now() - startBodyList;

    console.log(`\n--- BENCHMARK RESULTS (Body Iteration Methods) ---`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Baseline (for...in loop over rig.bodies): ${baselineTime.toFixed(2)} ms`);
    console.log(`ALL_BODY_SEGMENTS lookup: ${forOfAllTime.toFixed(2)} ms`);
    console.log(`Pre-cached bodyEntries indexed loop: ${bodyEntriesTime.toFixed(2)} ms`);
    console.log(`Pre-cached bodyList indexed loop: ${bodyListTime.toFixed(2)} ms`);
    console.log(`Speedup (bodyEntries vs for...in): ${(baselineTime / bodyEntriesTime).toFixed(2)}x (${((1 - bodyEntriesTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`Speedup (bodyList vs for...in): ${(baselineTime / bodyListTime).toFixed(2)}x (${((1 - bodyListTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`-------------------------\n`);

    expect(baselineMass).toBe(forOfAllMass);
    expect(baselineMass).toBe(bodyEntriesMass);
    expect(baselineMass).toBe(bodyListMass);
  });
});
