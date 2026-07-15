import { describe, expect, it } from 'vitest';
import { chasePoseAngularVelocity, computeMotorTorque, strikePoseChain } from '../game/physics/motorController';

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

  it('chases a time-critical pose through bounded physical angular velocity', () => {
    const velocity = chasePoseAngularVelocity(
      { x: 0, y: 0, z: 0, w: 1 }, { x: -.5, y: 0, z: 0, w: Math.sqrt(.75) },
      { x: 0, y: 0, z: 0 }, 7.2, 6.4, .24,
    );
    expect(velocity.x).toBeLessThan(0);
    expect(Math.abs(velocity.x)).toBeLessThanOrEqual(6.4);
    expect(velocity.y).toBe(0); expect(velocity.z).toBe(0);
  });

  it('drives one complete articulated chain for each physical strike source', () => {
    expect(strikePoseChain('rightHand')).toEqual(['rightUpperArm', 'rightForearm', 'rightHand']);
    expect(strikePoseChain('leftFoot')).toEqual(['leftThigh', 'leftShin', 'leftFoot']);
    expect(strikePoseChain('chest')).toEqual(['chest', 'abdomen', 'leftUpperArm', 'rightUpperArm']);
    expect(strikePoseChain('head')).toEqual(['head']);
  });
});
