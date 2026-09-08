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
