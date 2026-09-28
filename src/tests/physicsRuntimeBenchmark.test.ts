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

  test("measures torso contact check performance in cover evidence refresh", { timeout: 30000 }, () => {
    const iterations = 2_000_000;

    const TORSO_COVER_SEGMENTS: readonly BodySegmentId[] = ["chest", "abdomen"] as const;

    const createMockBody = () => ({
      numColliders: () => 1,
      collider: (_index: number) => ({ id: "collider" }),
    });

    const attackerBodies: Record<string, ReturnType<typeof createMockBody>> = {
      chest: createMockBody(),
      abdomen: createMockBody(),
    };

    const defenderBodies: Record<string, ReturnType<typeof createMockBody>> = {
      chest: createMockBody(),
      abdomen: createMockBody(),
    };

    const rigsMap = new Map<string, { bodies: typeof attackerBodies }>();
    rigsMap.set("attacker", { bodies: attackerBodies });
    rigsMap.set("defender", { bodies: defenderBodies });

    const cover = { attacker: "attacker" as const, defender: "defender" as const };

    const mockWorld = {
      contactPair: (_c1: unknown, _c2: unknown, cb: (manifold: { numSolverContacts: () => number }) => void) => {
        cb({ numSolverContacts: () => 1 });
      },
    };

    const startBaseline = performance.now();
    let baselineContacts = 0;
    for (let i = 0; i < iterations; i++) {
      let torsoContact = false;
      for (const aSegment of ["chest", "abdomen"] as const) for (const bSegment of ["chest", "abdomen"] as const) {
        const aBody = rigsMap.get(cover.attacker)?.bodies[aSegment];
        const bBody = rigsMap.get(cover.defender)?.bodies[bSegment];
        if (aBody?.numColliders() && bBody?.numColliders()) mockWorld.contactPair(aBody.collider(0), bBody.collider(0), manifold => {
          torsoContact ||= manifold.numSolverContacts() > 0;
        });
      }
      if (torsoContact) baselineContacts++;
    }
    const baselineTime = performance.now() - startBaseline;

    const startOptimized = performance.now();
    let optimizedContacts = 0;
    for (let i = 0; i < iterations; i++) {
      let torsoContact = false;
      const attackerRig = rigsMap.get(cover.attacker);
      const defenderRig = rigsMap.get(cover.defender);
      if (attackerRig && defenderRig && mockWorld) {
        for (const aSegment of TORSO_COVER_SEGMENTS) {
          const aBody = attackerRig.bodies[aSegment];
          if (!aBody || !aBody.numColliders()) continue;
          const aCollider = aBody.collider(0);
          for (const bSegment of TORSO_COVER_SEGMENTS) {
            const bBody = defenderRig.bodies[bSegment];
            if (!bBody || !bBody.numColliders()) continue;
            mockWorld.contactPair(aCollider, bBody.collider(0), manifold => {
              if (manifold.numSolverContacts() > 0) torsoContact = true;
            });
            if (torsoContact) break;
          }
          if (torsoContact) break;
        }
      }
      if (torsoContact) optimizedContacts++;
    }
    const optimizedTime = performance.now() - startOptimized;

    console.log(`\n--- BENCHMARK RESULTS (Torso Contact Check) ---`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Baseline (Repeated lookups & no early break): ${baselineTime.toFixed(2)} ms`);
    console.log(`Optimized (Pre-cached rigs & early break): ${optimizedTime.toFixed(2)} ms`);
    console.log(`Speedup: ${(baselineTime / optimizedTime).toFixed(2)}x (${((1 - optimizedTime / baselineTime) * 100).toFixed(1)}% reduction)`);
    console.log(`-------------------------\n`);

    expect(optimizedContacts).toBe(baselineContacts);
  });

});