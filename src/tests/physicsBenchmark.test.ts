import { describe, it, expect } from 'vitest';
import { BodyWorksRuntime } from '../game/physics/physicsRuntime';
import type { RapierRigidBody } from '@react-three/rapier';
import type { BodySegmentId } from '../game/physics/bodySchema';

function createMockBody(): RapierRigidBody {
  return {
    isValid: () => true,
    mass: () => 5.0,
    translation: () => ({ x: 1.0, y: 2.0, z: 3.0 }),
    linvel: () => ({ x: 0.5, y: 0.0, z: -0.5 }),
    addForce: () => {},
    applyImpulse: () => {},
    setAdditionalMass: () => {},
  } as unknown as RapierRigidBody;
}

describe('Physics Runtime Loop Benchmark', () => {
  it('benchmarks rigPlanarCenter and rig velocity/acceleration methods', () => {
    const runtime = new BodyWorksRuntime();
    const mockBodies: Partial<Record<BodySegmentId, RapierRigidBody>> = {
      pelvis: createMockBody(),
      abdomen: createMockBody(),
      chest: createMockBody(),
      head: createMockBody(),
      leftUpperArm: createMockBody(),
      rightUpperArm: createMockBody(),
      leftForearm: createMockBody(),
      rightForearm: createMockBody(),
      leftHand: createMockBody(),
      rightHand: createMockBody(),
      leftThigh: createMockBody(),
      rightThigh: createMockBody(),
      leftShin: createMockBody(),
      rightShin: createMockBody(),
      leftFoot: createMockBody(),
      rightFoot: createMockBody(),
    };

    runtime.registerFighter('player', mockBodies, 15);

    const rig = (runtime as any).rigs.get('player');

    // Warmup
    for (let i = 0; i < 10_000; i++) {
      (runtime as any).rigPlanarCenter(rig);
      (runtime as any).applyRigAcceleration(rig, { x: 1, y: 2, z: 3 });
      (runtime as any).applyRigVelocityDelta(rig, { x: 0.1, y: 0.2, z: 0.3 });
    }

    const start = performance.now();
    const iterations = 1_000_000;
    for (let i = 0; i < iterations; i++) {
      (runtime as any).rigPlanarCenter(rig);
      (runtime as any).applyRigAcceleration(rig, { x: 1, y: 2, z: 3 });
      (runtime as any).applyRigVelocityDelta(rig, { x: 0.1, y: 0.2, z: 0.3 });
    }
    const end = performance.now();
    const elapsed = end - start;

    console.log(`[BENCHMARK] ${iterations} iterations executed in ${elapsed.toFixed(2)} ms (${(elapsed / iterations * 1000).toFixed(4)} us/iter)`);
    expect(elapsed).toBeGreaterThan(0);
  });
});
