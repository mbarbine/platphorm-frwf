import { POSES } from './poses';
import type { Pose } from './poses';

/** A readable, repeatable celebration beat for the final wrestler standing. */
export const finishCelebrationPose = (elapsed: number): Pose => {
  const cycle = Math.max(0, elapsed) % 2.4;
  const leftPump = cycle < 1.2 ? Math.sin(cycle * Math.PI / 1.2) : 0;
  const rightPump = cycle >= 1.2 ? Math.sin((cycle - 1.2) * Math.PI / 1.2) : 0;
  const bounce = Math.max(leftPump, rightPump);
  return {
    ...POSES.victory,
    torso: [.08 + Math.sin(cycle * Math.PI / 1.2) * .09, Math.sin(cycle * Math.PI / 1.2) * .12, 0],
    leftArm: [-2.62 - leftPump * .52, 0, -.28],
    rightArm: [-2.62 - rightPump * .52, 0, .28],
    leftForearm: [-.28 - leftPump * .5, 0, 0],
    rightForearm: [-.28 - rightPump * .5, 0, 0],
    rootY: .11 + bounce * .16,
    rootRoll: Math.sin(cycle * Math.PI / 1.2) * .08,
  };
};
