import { describe, expect, it } from 'vitest';
import { gaitCycle, gaitRunBlend } from '../game/animation/gaitCycle';
import { locomotionPose } from '../game/animation/locomotion';

describe('grounded walking and running', () => {
  it('never leaves both walking feet in swing and includes double support', () => {
    let doubleSupport = 0;
    for (let i = 0; i < 360; i++) {
      const phase = i / 360 * Math.PI * 2;
      const left = gaitCycle(phase); const right = gaitCycle(phase + Math.PI);
      expect(left.planted || right.planted).toBe(true);
      if (left.planted && right.planted) doubleSupport++;
      if (left.planted) expect(left.lift).toBe(0);
    }
    expect(doubleSupport).toBeGreaterThan(50);
  });

  it('keeps travel and clearance continuous through toe-off and heel strike', () => {
    for (const run of [0, .5, 1]) {
      for (let i = -360; i < 360; i++) {
        const phase = i / 360 * Math.PI * 2;
        const a = gaitCycle(phase, run); const b = gaitCycle(phase + .0001, run);
        expect(Math.abs(a.travel - b.travel)).toBeLessThan(.001);
        expect(Math.abs(a.lift - b.lift)).toBeLessThan(.001);
        expect(a.lift).toBeGreaterThanOrEqual(0);
        expect(a.lift).toBeLessThanOrEqual(1);
      }
    }
  });

  it('raises the running recovery knee without turning backsteps into a sprint', () => {
    const knee = (speed: number) => Math.max(...Array.from({ length: 120 }, (_, i) =>
      Math.abs(locomotionPose({ x: 0, z: speed }, 0, i / 120 * Math.PI * 2).leftShin[0])));
    expect(knee(4.8)).toBeGreaterThan(knee(2.2) * 1.05);
    expect(knee(-4.8)).toBeLessThan(.31);
    expect(gaitRunBlend(2.2)).toBe(0);
    expect(gaitRunBlend(4.8)).toBe(1);
  });

  it('keeps the live walk readable without exaggerating the limb swing', () => {
    const poses = Array.from({ length: 120 }, (_, i) =>
      locomotionPose({ x: 0, z: 2.1 }, 0, i / 120 * Math.PI * 2, true, 'atlas'));
    const peak = (selector: (pose: (typeof poses)[number]) => number) =>
      Math.max(...poses.map((pose) => Math.abs(selector(pose))));

    expect(peak((pose) => pose.leftLeg[0])).toBeGreaterThan(.3);
    expect(peak((pose) => pose.leftLeg[0])).toBeLessThan(.4);
    expect(peak((pose) => pose.leftShin[0])).toBeGreaterThan(.2);
    expect(peak((pose) => pose.leftShin[0])).toBeLessThan(.31);
    expect(peak((pose) => pose.leftArm[0] - pose.rightArm[0])).toBeGreaterThan(.2);
    expect(peak((pose) => pose.leftArm[0] - pose.rightArm[0])).toBeLessThan(.3);
    expect(poses.some((pose) => pose.leftLeg[0] * pose.rightLeg[0] < 0)).toBe(true);
  });
});
