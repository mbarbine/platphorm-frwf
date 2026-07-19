import type { RecoveryOrientation } from '../types/game';
import { mixPose } from './choreography';
import { POSES } from './poses';
import type { Pose } from './poses';

const DOWNED: Readonly<Record<RecoveryOrientation, Pose>> = {
  back: { ...POSES.downed },
  front: { ...POSES.downed, rootTilt: 1.5, rootYaw: Math.PI, leftArm: [-.35, 0, -.62], rightArm: [-.35, 0, .62], leftForearm: [-1.15, 0, 0], rightForearm: [-1.15, 0, 0] },
  left: { ...POSES.downed, rootTilt: -.42, rootRoll: -1.32, leftArm: [-.25, 0, -.7], rightArm: [-1.05, 0, .48], leftLeg: [-.4, 0, -.24], rightLeg: [.3, 0, .18] },
  right: { ...POSES.downed, rootTilt: -.42, rootRoll: 1.32, leftArm: [-1.05, 0, -.48], rightArm: [-.25, 0, .7], leftLeg: [.3, 0, -.18], rightLeg: [-.4, 0, .24] },
};

const KNEEL: Readonly<Record<RecoveryOrientation, Pose>> = {
  back: { ...POSES.recovery, rootTilt: -.55, rootRoll: -.08 },
  front: { ...POSES.recovery, torso: [.48, 0, 0], rootTilt: .58, rootYaw: Math.PI * .15, leftArm: [-1.18, 0, -.42], rightArm: [-1.05, 0, .45] },
  left: { ...POSES.recovery, rootRoll: -.46, rootYaw: -.2, leftArm: [-.52, 0, -.72], rightArm: [-1.08, 0, .38] },
  right: { ...POSES.recovery, rootRoll: .46, rootYaw: .2, leftArm: [-1.08, 0, -.38], rightArm: [-.52, 0, .72] },
};

export const recoveryPose = (orientation: RecoveryOrientation, state: 'downed' | 'recovering', elapsed: number): Pose => {
  if (state === 'downed') return DOWNED[orientation];
  const progress = Math.max(0, Math.min(1, elapsed / .7));
  if (progress >= 1) return POSES.combatIdle;
  if (progress < .48) return mixPose(DOWNED[orientation], KNEEL[orientation], progress / .48);
  return mixPose(KNEEL[orientation], POSES.combatIdle, (progress - .48) / .52);
};
