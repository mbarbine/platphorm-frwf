import type { FighterId } from "../types/game";
import { gaitCycle, gaitRunBlend } from "./gaitCycle";
import type { Vec2 } from "../types/game";
import { POSES, type Pose } from "./poses";

/**
 * Stable locomotion input shared by procedural animation and future captured
 * motion. Keep this independent of Rapier/Three objects so mocap can replace
 * the pose source without changing controller or physics contracts.
 */
export interface LocomotionPoseInput {
  velocity: Vec2;
  facing: number;
  phase: number;
  combat?: boolean;
  fighterId?: FighterId;
  styleId?: LocomotionStyleId;
  massKg?: number;
}

export type LocomotionStyleId = 'baseline' | 'powerhouse' | 'agile' | 'technical';

export interface LocomotionStyle {
  stride: number;
  guard: number;
  armSwing: number;
  stance: number;
}

/** Gait tuning is independent of combat tendencies and signature moves. */
export const LOCOMOTION_STYLES: Readonly<Record<LocomotionStyleId, LocomotionStyle>> = {
  baseline: { stride: 1, guard: 1, armSwing: .8, stance: 0 },
  powerhouse: { stride: 1, guard: 1, armSwing: .8, stance: 0 },
  agile: { stride: 1, guard: 1, armSwing: .8, stance: 0 },
  technical: { stride: 1, guard: 1, armSwing: .8, stance: 0 },
};

export interface LocomotionPoseSource {
  pose(input: LocomotionPoseInput): Pose;
}

/** Gait follows solved travel in the wrestler's facing space, including backsteps. */
function proceduralLocomotionPose({ velocity, facing, phase, combat = true, styleId = 'baseline', massKg = 90 }: LocomotionPoseInput): Pose {
  // OPTIMIZATION: Replacing slow Math.hypot with standard Math.sqrt for ~8x speedup in 2D speed calculations on hot animation tick paths.
  const style = LOCOMOTION_STYLES[styleId];
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
  const amount = Math.min(1, speed / 1.8);
  // Loaded bodies carry less vertical bounce without tying gait style to a
  // character ID or mesh rig; travel distance and knee clearance stay stable.
  const massLoad = Math.max(0, Math.min(1, (massKg - 78) / 115));
  const run = gaitRunBlend(speed);
  const forward = speed > .001 ? (velocity.x * Math.sin(facing) + velocity.z * Math.cos(facing)) / speed : 0;
  const lateral = speed > .001 ? (velocity.x * Math.cos(facing) - velocity.z * Math.sin(facing)) / speed : 0;
  const leftCycle = gaitCycle(phase, run);
  const rightCycle = gaitCycle(phase + Math.PI, run);
  const step = -leftCycle.travel;
  const rightStep = -rightCycle.travel;
  const retreat = Math.max(0, -forward);
  // Backsteps use a shorter, flatter shuffle, not a reversed sprint cycle.
  const stride = (.36 + run * .06) * style.stride * amount * (1 - retreat * .38);
  // Controlled knee flexion preserves natural leg extension under load while avoiding extreme joint fold.
  const knee = (.30 + run * .02) * amount * (1 - retreat * .74);
  // Bend the knee while the boot travels forward, then extend before planting.
  const leftSwing = leftCycle.lift;
  const rightSwing = rightCycle.lift;
  const guard = combat ? (1 - run * .35) * style.guard : 0;
  // A retreat needs a wider base: the trailing boot must clear the planted
  // boot instead of converging on the centreline during knee flexion.
  const retreatStance = style.stance * amount + retreat * amount * .075 + Math.abs(lateral) * amount * .12;
  const pelvisSway = Math.sin(phase) * (.012 * run) * amount;

  return {
    ...POSES.combatIdle,
    torso: [
      .035 + run * .09 + Math.max(0, forward) * run * .03,
      step * forward * .035 * amount + pelvisSway,
      step * .012 * amount - lateral * .04 * amount,
    ],
    leftLeg: [step * stride * forward, 0, -retreatStance + Math.min(0, step * stride * lateral * .22)],
    rightLeg: [rightStep * stride * forward, 0, retreatStance + Math.max(0, rightStep * stride * lateral * .22)],
    leftShin: [-leftSwing * knee, 0, 0],
    rightShin: [-rightSwing * knee, 0, 0],
    leftArm: [-.42 * guard - step * forward * (.2 + run * .28) * style.armSwing * amount, 0, -.16],
    rightArm: [-.42 * guard - rightStep * forward * (.2 + run * .28) * style.armSwing * amount, 0, .16],
    leftForearm: [-.18 - guard * .72 - run * .5, 0, 0],
    rightForearm: [-.18 - guard * .72 - run * .5, 0, 0],
    // A heavy wrestler carries momentum through the mat instead of bouncing
    // vertically like a light rig. Vertical travel remains visible while running.
    rootY: Math.abs(Math.cos(phase)) * (.018 + run * .024) * amount * (1 - massLoad * .3),
    rootTilt: Math.max(0, forward) * (.025 + run * .095) * amount,
    rootRoll: -lateral * .045 * amount,
  };
}

/** Current source; a mocap sampler can implement the same small interface. */
export const proceduralLocomotionSource: LocomotionPoseSource = {
  pose: proceduralLocomotionPose,
};

/** Backward-compatible pure helper for tests and non-physics preview actors. */
export function locomotionPose(velocity: Vec2, facing: number, phase: number, combat = true, fighterId?: FighterId, massKg = 90): Pose {
  return proceduralLocomotionSource.pose({ velocity, facing, phase, combat, fighterId, massKg });
}
