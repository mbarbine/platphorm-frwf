import { describe, expect, it } from 'vitest';
import { finishCelebrationPose } from '../game/animation/finishMotion';

describe('resolved match finish celebration', () => {
  it('uses a changing, alternating fist-pump pose instead of a frozen victory stance', () => {
    const firstBeat = finishCelebrationPose(.3);
    const secondBeat = finishCelebrationPose(1.8);

    expect(firstBeat.leftArm[0]).not.toBe(secondBeat.leftArm[0]);
    expect(firstBeat.rightArm[0]).not.toBe(secondBeat.rightArm[0]);
    expect(firstBeat.rootY).not.toBe(secondBeat.rootY);
    expect(Math.abs(firstBeat.leftArm[0])).toBeGreaterThan(2.5);
    expect(Math.abs(firstBeat.rightArm[0])).toBeGreaterThan(2.5);
  });

  it('repeats cleanly for the full post-match decision beat', () => {
    expect(finishCelebrationPose(2.4)).toEqual(finishCelebrationPose(0));
    expect(finishCelebrationPose(4.8)).toEqual(finishCelebrationPose(0));
  });
});
