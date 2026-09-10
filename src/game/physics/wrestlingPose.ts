import { POSES, type Pose } from '../animation/poses';

/** Limb support relative to the falling pelvis; gravity still owns the fall. */
export const BREAKFALL_POSE: Pose = {
  ...POSES.combatIdle, torso: [.04, 0, 0],
  leftArm: [-.12, 0, -.7], rightArm: [-.12, 0, .7],
  leftForearm: [-.28, 0, 0], rightForearm: [-.28, 0, 0],
  leftLeg: [.06, 0, -.08], rightLeg: [.12, 0, .08],
  leftShin: [-.24, 0, 0], rightShin: [-.3, 0, 0],
  rootTilt: 0, rootRoll: 0, rootYaw: 0,
};

export const COVERED_POSE: Pose = { ...BREAKFALL_POSE, rootTilt: -Math.PI / 2 };
export const COVER_POSE: Pose = {
  ...BREAKFALL_POSE, rootTilt: 1.25,
  leftArm: [-.8, 0, -.48], rightArm: [-.9, 0, .48],
  leftForearm: [-.5, 0, 0], rightForearm: [-.5, 0, 0],
  leftLeg: [-.45, 0, -.18], rightLeg: [-.25, 0, .22],
  leftShin: [-.9, 0, 0], rightShin: [-.7, 0, 0],
};

/** Authored flexion is negative; Rapier knee hinges permit positive flexion. */
export const kneeFlexion = (authored: number): number => Math.max(0, Math.min(2.45, -authored));

export interface CoverEvidence {
  torsoContact: boolean;
  separation: number;
  chestClearance: number;
  shoulderHeight: number;
  defenderUpY: number;
  defenderFrontY: number;
  attackerUpY: number;
}

export function hasPhysicalCover(e: CoverEvidence): boolean {
  return e.torsoContact && [e.separation, e.chestClearance, e.shoulderHeight, e.defenderUpY, e.defenderFrontY, e.attackerUpY].every(Number.isFinite) && e.separation < .48
    && e.chestClearance > .15 && e.chestClearance < .52
    && e.shoulderHeight < .46 && Math.abs(e.defenderUpY) < .48
    && e.defenderFrontY > .65 && Math.abs(e.attackerUpY) < .55;
}


/** A local recoil preserves the feet and spine instead of starting a ragdoll. */
export function standingRecoilPose(moveId: string | undefined, elapsed: number): Pose {
  const strength = Math.max(0, 1 - elapsed / .48);
  const kick = ['front_kick', 'low_kick'].includes(moveId ?? '');
  const uppercut = moveId === 'uppercut';
  return {
    ...POSES.combatIdle,
    torso: [(kick ? .34 : uppercut ? -.32 : -.24) * strength, -.12 * strength, .05 * strength],
    rootTilt: (kick ? .035 : -.025) * strength,
    leftArm: [-.48 - strength * .16, 0, -.28 - strength * .1],
    rightArm: [-.55 + strength * .15, 0, .32 + strength * .12],
  };
}
