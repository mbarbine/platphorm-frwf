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

    console.log(`\n--- BENCHMARK RESULTS ---`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Baseline (Array.includes): ${baselineTime.toFixed(2)} ms`);
    console.log(`Optimized (state !== 'idle' && state !== 'locomotion'): ${optimizedTime.toFixed(2)} ms`);
    console.log(`Speedup: ${(baselineTime / optimizedTime).toFixed(2)}x (${((1 - optimizedTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`-------------------------\n`);

    expect(baselineMatches).toBe(optimizedMatches);
  });

  test('measures for...in vs bodyEntries array loop performance on rig.bodies', () => {
    const iterations = 1_000_000;
    const mockRigBodies = {
      pelvis: { isValid: () => true, mass: () => 10, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      abdomen: { isValid: () => true, mass: () => 5, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      chest: { isValid: () => true, mass: () => 8, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      head: { isValid: () => true, mass: () => 3, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      leftUpperArm: { isValid: () => true, mass: () => 2, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      rightUpperArm: { isValid: () => true, mass: () => 2, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      leftForearm: { isValid: () => true, mass: () => 1.5, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      rightForearm: { isValid: () => true, mass: () => 1.5, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      leftHand: { isValid: () => true, mass: () => 0.8, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      rightHand: { isValid: () => true, mass: () => 0.8, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      leftThigh: { isValid: () => true, mass: () => 6, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      rightThigh: { isValid: () => true, mass: () => 6, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      leftShin: { isValid: () => true, mass: () => 4, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      rightShin: { isValid: () => true, mass: () => 4, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      leftFoot: { isValid: () => true, mass: () => 1.2, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
      rightFoot: { isValid: () => true, mass: () => 1.2, linvel: () => ({ x: 0, y: 0, z: 0 }), translation: () => ({ x: 0, y: 1, z: 0 }) },
    };

    const mockBodyEntries = ALL_BODY_SEGMENTS.map((segment) => ({ segment, body: mockRigBodies[segment] }));

    // Baseline: for...in on object
    const startBaseline = performance.now();
    let baselineMass = 0;
    for (let i = 0; i < iterations; i++) {
      for (const _segment in mockRigBodies) {
        const body = mockRigBodies[_segment as BodySegmentId];
        if (body.isValid()) baselineMass += body.mass();
      }
    }
    const endBaseline = performance.now();
    const durationBaseline = endBaseline - startBaseline;

    // for...of on bodyEntries array
    const startForOf = performance.now();
    let forOfMass = 0;
    for (let i = 0; i < iterations; i++) {
      for (const entry of mockBodyEntries) {
        if (entry.body.isValid()) forOfMass += entry.body.mass();
      }
    }
    const endForOf = performance.now();
    const durationForOf = endForOf - startForOf;

    // Indexed for loop on bodyEntries array
    const startIndexed = performance.now();
    let indexedMass = 0;
    for (let i = 0; i < iterations; i++) {
      for (let e = 0; e < mockBodyEntries.length; e++) {
        const entry = mockBodyEntries[e];
        if (entry.body.isValid()) indexedMass += entry.body.mass();
      }
    }
    const endIndexed = performance.now();
    const durationIndexed = endIndexed - startIndexed;

    console.log(`\n--- RIG BODIES ITERATION BENCHMARK ---`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Baseline (for...in): ${durationBaseline.toFixed(2)} ms`);
    console.log(`for...of bodyEntries: ${durationForOf.toFixed(2)} ms`);
    console.log(`Indexed for loop bodyEntries: ${durationIndexed.toFixed(2)} ms`);
    console.log(`Speedup (bodyEntries for...of vs Baseline): ${(durationBaseline / durationForOf).toFixed(2)}x (${((1 - durationForOf / durationBaseline) * 100).toFixed(1)}% reduction)`);
    console.log(`Speedup (bodyEntries indexed vs Baseline): ${(durationBaseline / durationIndexed).toFixed(2)}x (${((1 - durationIndexed / durationBaseline) * 100).toFixed(1)}% reduction)`);
    console.log(`---------------------------------------\n`);

    expect(indexedMass).toBe(baselineMass);
    expect(forOfMass).toBe(baselineMass);
    expect(durationIndexed).toBeLessThan(durationBaseline);
  });
});
