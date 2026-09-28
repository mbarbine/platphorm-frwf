import { describe, test, expect } from 'vitest';
import { ALL_BODY_SEGMENTS, type BodySegmentId } from '../game/physics/bodySchema';

describe('PhysicsRuntime Hot Loop Benchmark', () => {
  test('measures state membership check performance', () => {
    const iterations = 10_000_000;

    const keys = ['rival1', 'rival2', 'rival3'] as const;
    const model = {
      rival1: { state: 'idle' },
      rival2: { state: 'attacking' },
      rival3: { state: 'locomotion' },
    };

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

    console.log(`\n--- BENCHMARK RESULTS (State check) ---`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Baseline (Array.includes): ${baselineTime.toFixed(2)} ms`);
    console.log(`Optimized (state !== 'idle' && state !== 'locomotion'): ${optimizedTime.toFixed(2)} ms`);
    console.log(`Speedup: ${(baselineTime / optimizedTime).toFixed(2)}x (${((1 - optimizedTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`-------------------------\n`);

    expect(baselineMatches).toBe(optimizedMatches);
  });

  test('measures iteration strategies for rig.bodies', { timeout: 30000 }, () => {
    const iterations = 5_000_000;

    const mockBodies: Partial<Record<BodySegmentId, { isValid: () => boolean; mass: () => number }>> = {};
    for (const segment of ALL_BODY_SEGMENTS) {
      mockBodies[segment] = {
        isValid: () => true,
        mass: () => 5.0,
      };
    }

    const bodyEntries: { segment: BodySegmentId; body: { isValid: () => boolean; mass: () => number } }[] = [];
    for (const segment of ALL_BODY_SEGMENTS) {
      const body = mockBodies[segment];
      if (body) {
        bodyEntries.push({ segment, body });
      }
    }

    // 1. Baseline: for...in loop over mockBodies
    const startBaseline = performance.now();
    let sum1 = 0;
    for (let i = 0; i < iterations; i++) {
      for (const _segment in mockBodies) {
        const body = mockBodies[_segment as BodySegmentId];
        if (body?.isValid()) {
          sum1 += body.mass();
        }
      }
    }
    const baselineTime = performance.now() - startBaseline;

    // 2. ALL_BODY_SEGMENTS with indexed for loop
    const startAllSegments = performance.now();
    let sum2 = 0;
    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < ALL_BODY_SEGMENTS.length; j++) {
        const segment = ALL_BODY_SEGMENTS[j];
        if (!segment) continue;
        const body = mockBodies[segment];
        if (body?.isValid()) {
          sum2 += body.mass();
        }
      }
    }
    const allSegmentsTime = performance.now() - startAllSegments;

    // 3. Cached bodyEntries with indexed for loop
    const startEntriesIndexed = performance.now();
    let sum3 = 0;
    for (let i = 0; i < iterations; i++) {
      const len = bodyEntries.length;
      for (let j = 0; j < len; j++) {
        const entry = bodyEntries[j];
        if (entry && entry.body.isValid()) {
          sum3 += entry.body.mass();
        }
      }
    }
    const entriesIndexedTime = performance.now() - startEntriesIndexed;

    // 4. Cached bodyEntries with for...of loop
    const startEntriesForOf = performance.now();
    let sum4 = 0;
    for (let i = 0; i < iterations; i++) {
      for (const entry of bodyEntries) {
        if (entry.body.isValid()) {
          sum4 += entry.body.mass();
        }
      }
    }
    const entriesForOfTime = performance.now() - startEntriesForOf;

    console.log(`\n--- BENCHMARK RESULTS (Rig Bodies Iteration) ---`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`1. Baseline (for...in): ${baselineTime.toFixed(2)} ms`);
    console.log(`2. ALL_BODY_SEGMENTS indexed for: ${allSegmentsTime.toFixed(2)} ms`);
    console.log(`3. Pre-cached bodyEntries indexed for: ${entriesIndexedTime.toFixed(2)} ms`);
    console.log(`4. Pre-cached bodyEntries for...of: ${entriesForOfTime.toFixed(2)} ms`);
    console.log(`Speedup (for...of bodyEntries vs for...in): ${(baselineTime / entriesForOfTime).toFixed(2)}x (${((1 - entriesForOfTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`-------------------------\n`);

    expect(sum2).toBe(sum1);
    expect(sum3).toBe(sum1);
    expect(sum4).toBe(sum1);
  });

  test('measures table prop lookup performance in advancePhysicalGrapple', () => {
    const iterations = 10_000_000;

    const mockProps = [
      { id: 'chair-1', kind: 'chair', broken: false, position: { x: 1, z: 2 } },
      { id: 'trash-1', kind: 'trash', broken: false, position: { x: -2, z: 3 } },
      { id: 'sign-1', kind: 'sign', broken: false, position: { x: -1, z: 1 } },
      { id: 'chair-2', kind: 'chair', broken: false, position: { x: 3, z: 2 } },
      { id: 'trash-2', kind: 'trash', broken: true, position: { x: -4, z: 0 } },
      { id: 'table-1', kind: 'table', broken: false, position: { x: 4, z: 5 } },
    ];
    const mockPropsById: Record<string, typeof mockProps[number]> = {};
    for (const p of mockProps) mockPropsById[p.id] = p;

    // Baseline: Array.prototype.find
    const startBaseline = performance.now();
    let baselineCount = 0;
    for (let i = 0; i < iterations; i++) {
      const table = mockProps.find((prop) => prop.kind === 'table' && !prop.broken);
      if (table) baselineCount++;
    }
    const baselineTime = performance.now() - startBaseline;

    // Option A: Indexed for loop
    const startLoop = performance.now();
    let loopCount = 0;
    for (let i = 0; i < iterations; i++) {
      let table: typeof mockProps[number] | undefined;
      for (let j = 0; j < mockProps.length; j++) {
        const prop = mockProps[j];
        if (prop && prop.kind === 'table' && !prop.broken) {
          table = prop;
          break;
        }
      }
      if (table) loopCount++;
    }
    const loopTime = performance.now() - startLoop;

    // Option B: Map / propsById direct lookup if table-1 is unbroken, fallback to loop
    const startDirect = performance.now();
    let directCount = 0;
    for (let i = 0; i < iterations; i++) {
      const primaryTable = mockPropsById['table-1'];
      let table = primaryTable && !primaryTable.broken ? primaryTable : undefined;
      if (!table) {
        for (let j = 0; j < mockProps.length; j++) {
          const prop = mockProps[j];
          if (prop && prop.kind === 'table' && !prop.broken) {
            table = prop;
            break;
          }
        }
      }
      if (table) directCount++;
    }
    const directTime = performance.now() - startDirect;

    console.log(`\n--- BENCHMARK RESULTS (Table Prop Lookup) ---`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Baseline (Array.find): ${baselineTime.toFixed(2)} ms`);
    console.log(`Option A (Indexed for loop): ${loopTime.toFixed(2)} ms`);
    console.log(`Option B (Direct propsById['table-1'] check): ${directTime.toFixed(2)} ms`);
    console.log(`Speedup Direct vs Baseline: ${(baselineTime / directTime).toFixed(2)}x (${((1 - directTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`-------------------------\n`);

    expect(loopCount).toBe(baselineCount);
    expect(directCount).toBe(baselineCount);
  });
});
