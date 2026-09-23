import { describe, it, expect } from 'vitest';
import { BODY_SEGMENT_IDS, BodySegmentId } from '../game/physics/bodySchema';

interface MockBody {
  isValid: () => boolean;
  mass: () => number;
  translation: () => { x: number; y: number; z: number };
  linvel: () => { x: number; y: number; z: number };
  addForce: (v: { x: number; y: number; z: number }, wake: boolean) => void;
  applyImpulse: (v: { x: number; y: number; z: number }, wake: boolean) => void;
}

interface MockRig {
  bodies: Partial<Record<BodySegmentId, MockBody>>;
  bodyList: MockBody[];
  bodyEntries: [BodySegmentId, MockBody][];
}

function createMockRig(): MockRig {
  const bodies: Partial<Record<BodySegmentId, MockBody>> = {};
  const bodyList: MockBody[] = [];
  const bodyEntries: [BodySegmentId, MockBody][] = [];
  for (const segment of BODY_SEGMENT_IDS) {
    const b: MockBody = {
      isValid: () => true,
      mass: () => 5.0,
      translation: () => ({ x: 1.0, y: 2.0, z: 3.0 }),
      linvel: () => ({ x: 0.1, y: 0.2, z: 0.3 }),
      addForce: () => {},
      applyImpulse: () => {},
    };
    bodies[segment] = b;
    bodyList.push(b);
    bodyEntries.push([segment, b]);
  }
  return { bodies, bodyList, bodyEntries };
}

// 1. Baseline implementations using for...in
function rigPlanarCenterBaseline(rig: MockRig) {
  let mass = 0; let x = 0; let z = 0; let velocityX = 0; let velocityZ = 0;
  for (const _segment in rig.bodies) {
    const body = rig.bodies[_segment as BodySegmentId];
    if (!body?.isValid()) continue;
    const bodyMass = body.mass(); const position = body.translation(); const velocity = body.linvel();
    mass += bodyMass; x += position.x * bodyMass; z += position.z * bodyMass;
    velocityX += velocity.x * bodyMass; velocityZ += velocity.z * bodyMass;
  }
  const inverseMass = 1 / Math.max(.001, mass);
  return { x: x * inverseMass, z: z * inverseMass, velocityX: velocityX * inverseMass, velocityZ: velocityZ * inverseMass, mass };
}

function applyRigAccelerationBaseline(rig: MockRig, acceleration: { x: number; y: number; z: number }) {
  for (const _segment in rig.bodies) {
    const body = rig.bodies[_segment as BodySegmentId];
    if (!body?.isValid()) continue;
    const mass = body.mass(); body.addForce({ x: acceleration.x * mass, y: acceleration.y * mass, z: acceleration.z * mass }, true);
  }
}

function applyRigVelocityDeltaBaseline(rig: MockRig, delta: { x: number; y: number; z: number }) {
  for (const _segment in rig.bodies) {
    const body = rig.bodies[_segment as BodySegmentId];
    if (!body?.isValid()) continue;
    const mass = body.mass(); body.applyImpulse({ x: delta.x * mass, y: delta.y * mass, z: delta.z * mass }, true);
  }
}

// 2. Optimized implementations using rig.bodyList indexed for loop
function rigPlanarCenterOptimized(rig: MockRig) {
  let mass = 0; let x = 0; let z = 0; let velocityX = 0; let velocityZ = 0;
  for (let i = 0; i < rig.bodyList.length; i++) {
    const body = rig.bodyList[i];
    if (!body?.isValid()) continue;
    const bodyMass = body.mass(); const position = body.translation(); const velocity = body.linvel();
    mass += bodyMass; x += position.x * bodyMass; z += position.z * bodyMass;
    velocityX += velocity.x * bodyMass; velocityZ += velocity.z * bodyMass;
  }
  const inverseMass = 1 / Math.max(.001, mass);
  return { x: x * inverseMass, z: z * inverseMass, velocityX: velocityX * inverseMass, velocityZ: velocityZ * inverseMass, mass };
}

function applyRigAccelerationOptimized(rig: MockRig, acceleration: { x: number; y: number; z: number }) {
  for (let i = 0; i < rig.bodyList.length; i++) {
    const body = rig.bodyList[i];
    if (!body?.isValid()) continue;
    const mass = body.mass(); body.addForce({ x: acceleration.x * mass, y: acceleration.y * mass, z: acceleration.z * mass }, true);
  }
}

function applyRigVelocityDeltaOptimized(rig: MockRig, delta: { x: number; y: number; z: number }) {
  for (let i = 0; i < rig.bodyList.length; i++) {
    const body = rig.bodyList[i];
    if (!body?.isValid()) continue;
    const mass = body.mass(); body.applyImpulse({ x: delta.x * mass, y: delta.y * mass, z: delta.z * mass }, true);
  }
}

describe('Physics body iteration performance benchmark', () => {
  it('benchmarks baseline vs bodyList optimized rig body iteration', () => {
    const rig = createMockRig();
    const iterations = 1_000_000;

    // Baseline benchmark
    const startBaseline = performance.now();
    for (let i = 0; i < iterations; i++) {
      rigPlanarCenterBaseline(rig);
      applyRigAccelerationBaseline(rig, { x: 1, y: 0, z: 1 });
      applyRigVelocityDeltaBaseline(rig, { x: 0.1, y: 0, z: 0.1 });
    }
    const durationBaseline = performance.now() - startBaseline;

    // Optimized benchmark
    const startOptimized = performance.now();
    for (let i = 0; i < iterations; i++) {
      rigPlanarCenterOptimized(rig);
      applyRigAccelerationOptimized(rig, { x: 1, y: 0, z: 1 });
      applyRigVelocityDeltaOptimized(rig, { x: 0.1, y: 0, z: 0.1 });
    }
    const durationOptimized = performance.now() - startOptimized;

    console.log(`Baseline (for...in) duration for ${iterations} iterations: ${durationBaseline.toFixed(2)} ms`);
    console.log(`Optimized (bodyList array) duration for ${iterations} iterations: ${durationOptimized.toFixed(2)} ms`);
    console.log(`Speedup: ${(durationBaseline / durationOptimized).toFixed(2)}x`);

    expect(rigPlanarCenterOptimized(rig)).toEqual(rigPlanarCenterBaseline(rig));
    expect(durationOptimized).toBeLessThan(durationBaseline);
  });
});
