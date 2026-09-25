import { describe, test, expect } from 'vitest';
import { ALL_BODY_SEGMENTS, type BodySegmentId } from '../game/physics/bodySchema';

describe('PhysicsRuntime Hot Loop Benchmark', () => {
  test('measures rig.bodies loop iteration performance', { timeout: 20000 }, () => {
    const iterations = 5_000_000;

    // Simulated rig.bodies object with 16 segment bodies
    const mockRigBodies: Partial<Record<BodySegmentId, { isValid: () => boolean; mass: () => number }>> = {};
    for (const segment of ALL_BODY_SEGMENTS) {
      mockRigBodies[segment] = {
        isValid: () => true,
        mass: () => 10,
      };
    }

    const rig = {
      bodies: mockRigBodies,
      bodyEntries: ALL_BODY_SEGMENTS.map(segment => ({ segment, body: mockRigBodies[segment]! })),
      bodyList: ALL_BODY_SEGMENTS.map(segment => mockRigBodies[segment]!),
    };

    // Baseline: for...in loop over rig.bodies
    const startBaseline = performance.now();
    let baselineMassTotal = 0;
    for (let i = 0; i < iterations; i++) {
      for (const _segment in rig.bodies) {
        const body = rig.bodies[_segment as BodySegmentId];
        if (body?.isValid()) {
          baselineMassTotal += body.mass();
        }
      }
    }
    const endBaseline = performance.now();
    const baselineTime = endBaseline - startBaseline;

    // Option A: for...of ALL_BODY_SEGMENTS loop
    const startForOf = performance.now();
    let forOfMassTotal = 0;
    for (let i = 0; i < iterations; i++) {
      for (const segment of ALL_BODY_SEGMENTS) {
        const body = rig.bodies[segment];
        if (body?.isValid()) {
          forOfMassTotal += body.mass();
        }
      }
    }
    const endForOf = performance.now();
    const forOfTime = endForOf - startForOf;

    // Option C: pre-cached bodyEntries indexed loop
    const startEntries = performance.now();
    let entriesMassTotal = 0;
    for (let i = 0; i < iterations; i++) {
      const entries = rig.bodyEntries;
      for (let e = 0; e < entries.length; e++) {
        const entry = entries[e];
        if (entry.body.isValid()) {
          entriesMassTotal += entry.body.mass();
        }
      }
    }
    const endEntries = performance.now();
    const entriesTime = endEntries - startEntries;

    // Option D: pre-cached bodyList indexed loop
    const startList = performance.now();
    let listMassTotal = 0;
    for (let i = 0; i < iterations; i++) {
      const list = rig.bodyList;
      for (let b = 0; b < list.length; b++) {
        const body = list[b];
        if (body.isValid()) {
          listMassTotal += body.mass();
        }
      }
    }
    const endList = performance.now();
    const listTime = endList - startList;

    console.log(`\n--- BENCHMARK RESULTS (rig.bodies loop) ---`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Baseline (for...in): ${baselineTime.toFixed(2)} ms`);
    console.log(`Option A (for...of ALL_BODY_SEGMENTS): ${forOfTime.toFixed(2)} ms`);
    console.log(`Option C (pre-cached bodyEntries): ${entriesTime.toFixed(2)} ms`);
    console.log(`Option D (pre-cached bodyList): ${listTime.toFixed(2)} ms`);
    console.log(`bodyEntries Speedup: ${(baselineTime / entriesTime).toFixed(2)}x (${((1 - entriesTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`bodyList Speedup: ${(baselineTime / listTime).toFixed(2)}x (${((1 - listTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`-------------------------\n`);

    expect(forOfMassTotal).toBe(baselineMassTotal);
    expect(entriesMassTotal).toBe(baselineMassTotal);
    expect(listMassTotal).toBe(baselineMassTotal);
  });
});
