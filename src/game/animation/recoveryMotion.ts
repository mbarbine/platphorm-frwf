import type { RecoveryOrientation } from "../types/game";
import { mixPose } from "./choreography";
import { POSES } from "./poses";
import type { Pose } from "./poses";

export const RECOVERY_DURATION = 1.2;

const DOWNED: Readonly<Record<RecoveryOrientation, Pose>> = {
  back: { ...POSES.downed },
  front: { ...POSES.downed, rootTilt: 1.5, rootYaw: Math.PI, leftArm: [-.35, 0, -.62], rightArm: [-.35, 0, .62], leftForearm: [-1.15, 0, 0], rightForearm: [-1.15, 0, 0] },
  left: { ...POSES.downed, rootTilt: -.42, rootRoll: -1.32, leftArm: [-.25, 0, -.7], rightArm: [-1.05, 0, .48], leftLeg: [-.4, 0, -.24], rightLeg: [.3, 0, .18] },
  right: { ...POSES.downed, rootTilt: -.42, rootRoll: 1.32, leftArm: [-1.05, 0, -.48], rightArm: [-.25, 0, .7], leftLeg: [.3, 0, -.18], rightLeg: [-.4, 0, .24] },
};

/** Ground arm post phase: posting on hand/elbow to push upper body off canvas. */
const POST: Readonly<Record<RecoveryOrientation, Pose>> = {
  back: { ...POSES.downed, torso: [.32, 0, 0], rootTilt: -.35, leftArm: [-1.22, 0, -.55], rightArm: [-1.05, 0, .48], leftForearm: [-1.35, 0, 0], rightForearm: [-1.1, 0, 0], leftLeg: [-.48, 0, -.15], rightLeg: [.28, 0, .15] },
  front: { ...POSES.downed, torso: [.55, 0, 0], rootTilt: .85, rootYaw: Math.PI * .12, leftArm: [-1.35, 0, -.48], rightArm: [-1.28, 0, .52], leftForearm: [-1.25, 0, 0], rightForearm: [-1.2, 0, 0] },
  left: { ...POSES.downed, torso: [.28, 0, -.12], rootRoll: -.85, rootYaw: -.15, leftArm: [-.78, 0, -.78], rightArm: [-1.25, 0, .42], leftForearm: [-1.4, 0, 0] },
  right: { ...POSES.downed, torso: [.28, 0, .12], rootRoll: .85, rootYaw: .15, leftArm: [-1.25, 0, -.42], rightArm: [-.78, 0, .78], rightForearm: [-1.4, 0, 0] },
};

/** Knee gather phase: bringing boots under the core to prepare the rise. */
const KNEEL: Readonly<Record<RecoveryOrientation, Pose>> = {
  back: { ...POSES.recovery, rootTilt: -.55, rootRoll: -.08 },
  front: { ...POSES.recovery, torso: [.48, 0, 0], rootTilt: .58, rootYaw: Math.PI * .15, leftArm: [-1.18, 0, -.42], rightArm: [-1.05, 0, .45] },
  left: { ...POSES.recovery, rootRoll: -.46, rootYaw: -.2, leftArm: [-.52, 0, -.72], rightArm: [-1.08, 0, .38] },
  right: { ...POSES.recovery, rootRoll: .46, rootYaw: .2, leftArm: [-1.08, 0, -.38], rightArm: [-.52, 0, .72] },
};

export const recoveryPose = (orientation: RecoveryOrientation, state: 'downed' | 'recovering', elapsed: number, staminaRatio = 1): Pose => {
  if (state === 'downed') return DOWNED[orientation];
  const progress = Math.max(0, Math.min(1, elapsed / RECOVERY_DURATION));
  if (progress >= 1) return POSES.combatIdle;

  // Fatigue weighting adds realistic weary torso lean during exhausted get-up struggle
  const fatigue = Math.max(0, (0.5 - staminaRatio) * 0.38);

  let pose: Pose;
  if (progress < .32) {
    pose = mixPose(DOWNED[orientation], POST[orientation], progress / .32);
  } else if (progress < .68) {
    pose = mixPose(POST[orientation], KNEEL[orientation], (progress - .32) / .36);
  } else {
    pose = mixPose(KNEEL[orientation], POSES.combatIdle, (progress - .68) / .32);
  }

  if (fatigue > 0.01 && progress < 0.85) {
    const fatigueFactor = Math.sin(progress * Math.PI) * fatigue;
    return {
      ...pose,
      torso: [pose.torso[0] + fatigueFactor * 0.25, pose.torso[1], pose.torso[2]],
      rootTilt: pose.rootTilt + fatigueFactor * 0.15,
    };
  }

  return pose;
};
