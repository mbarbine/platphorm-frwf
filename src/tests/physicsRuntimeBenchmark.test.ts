import { describe, expect, it } from 'vitest';
import { ALL_BODY_SEGMENTS, type BodySegmentId } from '../game/physics/bodySchema';
import type { RapierRigidBody } from '@react-three/rapier';

describe('physicsRuntime benchmark', () => {
  it('demonstrates speedup with pre-allocated bodyEntries array', () => {
    const createMockBody = () => ({
      isValid: () => true,
      mass: () => 10,
      translation: () => ({ x: 1, y: 2, z: 3 }),
      linvel: () => ({ x: 0.1, y: 0.2, z: 0.3 }),
      addForce: () => {},
      applyImpulse: () => {},
    } as unknown as RapierRigidBody);

    const bodies: Partial<Record<BodySegmentId, RapierRigidBody>> = {};
    for (const seg of ALL_BODY_SEGMENTS) {
      bodies[seg] = createMockBody();
    }

    const bodyEntries = ALL_BODY_SEGMENTS.map(segment => ({ segment, body: bodies[segment]! })).filter(e => Boolean(e.body));

    const iterations = 5_000_000;

    // 1. Baseline for...in
    const startForIn = performance.now();
    let massIn = 0;
    for (let i = 0; i < iterations; i++) {
      for (const _segment in bodies) {
        const body = bodies[_segment as BodySegmentId];
        if (body?.isValid()) massIn += body.mass();
      }
    }
    const elapsedForIn = performance.now() - startForIn;

    // 2. Optimized bodyEntries indexed loop
    const startBodyEntries = performance.now();
    let massEntries = 0;
    const len = bodyEntries.length;
    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < len; j++) {
        const entry = bodyEntries[j];
        if (entry.body.isValid()) massEntries += entry.body.mass();
      }
    }
    const elapsedBodyEntries = performance.now() - startBodyEntries;

    console.log(`[BENCHMARK] for...in: ${elapsedForIn.toFixed(2)}ms | bodyEntries indexed loop: ${elapsedBodyEntries.toFixed(2)}ms`);
    expect(massEntries).toBe(massIn);
    expect(elapsedBodyEntries).toBeLessThan(elapsedForIn);
  });
});
