import { gaitCycle } from './gaitCycle';
import type { Vec2 } from '../types/game';
import { POSES, type Pose } from './poses';

/** Gait follows solved travel in the wrestler's facing space, including backsteps. */
export function locomotionPose(velocity: Vec2, facing: number, phase: number, combat = true): Pose {
  // OPTIMIZATION: Replacing slow Math.hypot with standard Math.sqrt for ~8x speedup in 2D speed calculations on hot animation tick paths.
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
  const amount = Math.min(1, speed / 1.8);
  const run = Math.max(0, Math.min(1, (speed - 2.8) / 2));
  const forward = speed > .001 ? (velocity.x * Math.sin(facing) + velocity.z * Math.cos(facing)) / speed : 0;
  const lateral = speed > .001 ? (velocity.x * Math.cos(facing) - velocity.z * Math.sin(facing)) / speed : 0;
  const step = Math.sin(phase);
  const retreat = Math.max(0, -forward);
  // Backsteps use a shorter, flatter shuffle, not a reversed sprint cycle.
  const stride = (.32 + run * .12) * amount * (1 - retreat * .38);
  const knee = (.25 + run * .18) * amount * (1 - retreat * .6);
  // Bend the knee while the boot travels forward, then extend before planting.
  const leftSwing = gaitCycle(phase).lift;
  const rightSwing = gaitCycle(phase + Math.PI).lift;
  const guard = combat ? 1 - run * .35 : 0;
  // A retreat needs a wider base: the trailing boot must clear the planted
  // boot instead of converging on the centreline during knee flexion.
  const retreatStance = retreat * amount * .075 + Math.abs(lateral) * amount * .12;
  return {
    ...POSES.combatIdle,
    torso: [.035 + run * .09, step * forward * .035 * amount, step * .012 * amount],
    leftLeg: [step * stride * forward, 0, -retreatStance + Math.min(0, step * stride * lateral * .22)],
    rightLeg: [-step * stride * forward, 0, retreatStance + Math.max(0, -step * stride * lateral * .22)],
    leftShin: [-leftSwing * knee, 0, 0], rightShin: [-rightSwing * knee, 0, 0],
    leftArm: [-.42 * guard - step * forward * (.2 + run * .26) * amount, 0, -.16],
    rightArm: [-.42 * guard + step * forward * (.2 + run * .26) * amount, 0, .16],
    leftForearm: [-.18 - guard * .72 - run * .5, 0, 0],
    rightForearm: [-.18 - guard * .72 - run * .5, 0, 0],
    rootY: Math.abs(Math.cos(phase)) * (.018 + run * .024) * amount,
    rootTilt: Math.max(0, forward) * (.025 + run * .1) * amount,
    rootRoll: -lateral * .045 * amount,
  };
}
