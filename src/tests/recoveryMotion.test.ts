import { describe, expect, it } from 'vitest';
import { recoveryRise, recoveryPose, RECOVERY_DURATION } from '../game/animation/recoveryMotion';
import { POSES } from '../game/animation/poses';

describe('supported recovery progression', () => {
  it('posts before lifting the pelvis and finishes without overshoot', () => {
    expect(recoveryRise(.3)).toBe(0);
    expect(recoveryRise(.5)).toBeLessThan(.25);
    expect(recoveryRise(1)).toBe(1);
    expect(recoveryRise(2)).toBe(1);
  });
  it('retains each landing orientation before returning to an alert stance', () => {
    const orientations = ['back', 'front', 'left', 'right'] as const;
    expect(new Set(orientations.map(o => JSON.stringify(recoveryPose(o, 'downed', 0)))).size).toBe(4);
    for (const orientation of orientations) {
      expect(recoveryPose(orientation, 'recovering', 0)).toEqual(recoveryPose(orientation, 'downed', 0));
      expect(recoveryPose(orientation, 'recovering', RECOVERY_DURATION)).toEqual(POSES.combatIdle);
    }
  });
});
