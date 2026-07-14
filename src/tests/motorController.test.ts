import { describe, expect, it } from 'vitest';
import { computeMotorTorque } from '../game/physics/motorController';

const parameters = { stiffness: 300, damping: 48, maxTorque: 340, strength: 1, fatigue: 0 } as const;

describe('articulated pose motor stability', () => {
  it('leaves a settled joint inside the physical dead band alone', () => {
    const torque = computeMotorTorque(
      { x: 0, y: 0, z: 0, w: 1 }, { x: .001, y: 0, z: 0, w: .999_999_5 },
      { x: .01, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, parameters,
    );
    expect(torque).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('still produces a bounded correction for a visible pose error', () => {
    const torque = computeMotorTorque(
      { x: 0, y: 0, z: 0, w: 1 }, { x: .2, y: 0, z: 0, w: Math.sqrt(.96) },
      { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, parameters,
    );
    expect(torque.x).toBeGreaterThan(0);
    expect(Math.hypot(torque.x, torque.y, torque.z)).toBeLessThanOrEqual(parameters.maxTorque);
  });
});
