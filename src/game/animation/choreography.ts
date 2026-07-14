import { POSES } from './poses';
import type { Pose } from './poses';
import type { AttackPhase, FighterId, MoveDefinition } from '../types/game';

type Role = 'actor' | 'victim';
type PosePatch = Partial<Pose>;
interface PoseKeyframe { at: number; pose: Pose }

const pose = (patch: PosePatch): Pose => ({ ...POSES.combatIdle, ...patch });
const tuple = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const mixPose = (a: Pose, b: Pose, amount: number): Pose => {
  const t = Math.max(0, Math.min(1, amount));
  return {
    torso: tuple(a.torso, b.torso, t),
    leftArm: tuple(a.leftArm, b.leftArm, t), rightArm: tuple(a.rightArm, b.rightArm, t),
    leftForearm: tuple(a.leftForearm, b.leftForearm, t), rightForearm: tuple(a.rightForearm, b.rightForearm, t),
    leftLeg: tuple(a.leftLeg, b.leftLeg, t), rightLeg: tuple(a.rightLeg, b.rightLeg, t),
    leftShin: tuple(a.leftShin, b.leftShin, t), rightShin: tuple(a.rightShin, b.rightShin, t),
    rootX: a.rootX + (b.rootX - a.rootX) * t,
    rootY: a.rootY + (b.rootY - a.rootY) * t,
    rootZ: a.rootZ + (b.rootZ - a.rootZ) * t,
    rootTilt: a.rootTilt + (b.rootTilt - a.rootTilt) * t,
    rootYaw: a.rootYaw + (b.rootYaw - a.rootYaw) * t,
    rootRoll: a.rootRoll + (b.rootRoll - a.rootRoll) * t,
  };
};

const sample = (frames: readonly PoseKeyframe[], progress: number): Pose => {
  const p = Math.max(0, Math.min(1, progress));
  for (let index = 1; index < frames.length; index += 1) {
    const next = frames[index]; const previous = frames[index - 1];
    if (next && previous && p <= next.at) return mixPose(previous.pose, next.pose, (p - previous.at) / Math.max(.001, next.at - previous.at));
  }
  return frames[frames.length - 1]?.pose ?? POSES.combatIdle;
};

export const cinematicProgress = (move: MoveDefinition, phase: AttackPhase, elapsed: number): number => {
  if (phase === 'anticipation') return Math.min(.62, elapsed / Math.max(.001, move.anticipationDuration) * .62);
  if (phase === 'active') return .62 + Math.min(.18, (elapsed - move.anticipationDuration) / Math.max(.001, move.activeDuration) * .18);
  if (phase === 'recovery') return .8 + Math.min(.2, (elapsed - move.anticipationDuration - move.activeDuration) / Math.max(.001, move.recoveryDuration) * .2);
  return 1;
};

const lockActor = pose({
  torso: [.2, 0, 0], leftArm: [-.92, 0, -.38], rightArm: [-.92, 0, .38],
  leftForearm: [-1.05, 0, -.32], rightForearm: [-1.05, 0, .32], rootTilt: .12,
});
const lockVictim = pose({
  torso: [.12, 0, 0], leftArm: [-.72, 0, -.48], rightArm: [-.72, 0, .48],
  leftForearm: [-1.2, 0, -.2], rightForearm: [-1.2, 0, .2], rootTilt: -.08,
});
const matVictim = pose({
  torso: [-.35, 0, .12], leftArm: [.55, 0, -.55], rightArm: [.8, 0, .55],
  leftForearm: [-.35, 0, 0], rightForearm: [-.5, 0, 0], leftLeg: [-.55, 0, -.12], rightLeg: [.42, 0, .12],
  leftShin: [-.52, 0, 0], rightShin: [-.8, 0, 0], rootY: -.62, rootTilt: -1.5,
});

const SLAM_ACTOR: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.combatIdle },
  { at: .1, pose: pose({ ...lockActor, leftArm: [-1.14, 0, -.42], rightArm: [-1.14, 0, .42], rootZ: .08 }) },
  { at: .21, pose: lockActor },
  { at: .34, pose: pose({ ...lockActor, torso: [.34, .18, -.08], leftArm: [-.82, -.22, -.5], rightArm: [-.98, .18, .48], leftForearm: [-1.28, 0, -.18], rightForearm: [-1.18, 0, .16], leftLeg: [.16, 0, -.14], rightLeg: [-.22, 0, .14], rootZ: -.1, rootYaw: .16, rootRoll: -.08 }) },
  { at: .47, pose: pose({ torso: [.58, 0, 0], leftArm: [-.56, 0, -.52], rightArm: [-.56, 0, .52], leftForearm: [-1.38, 0, 0], rightForearm: [-1.38, 0, 0], leftLeg: [.7, 0, 0], rightLeg: [.68, 0, 0], leftShin: [-1.12, 0, 0], rightShin: [-1.08, 0, 0], rootY: -.32, rootTilt: .38 }) },
  { at: .6, pose: pose({ torso: [-.14, 0, 0], leftArm: [-1.5, -.16, -.35], rightArm: [-1.5, .16, .35], leftForearm: [-1.08, 0, 0], rightForearm: [-1.08, 0, 0], leftLeg: [.14, 0, 0], rightLeg: [.12, 0, 0], rootY: .18, rootTilt: -.14 }) },
  { at: .69, pose: pose({ torso: [-.28, 0, 0], leftArm: [-1.72, -.12, -.3], rightArm: [-1.72, .12, .3], leftForearm: [-.86, 0, 0], rightForearm: [-.86, 0, 0], leftLeg: [-.12, 0, 0], rightLeg: [-.08, 0, 0], rootY: .24, rootTilt: -.2 }) },
  { at: .79, pose: pose({ torso: [.88, 0, 0], leftArm: [-.16, 0, -.78], rightArm: [-.16, 0, .78], leftForearm: [-.42, 0, 0], rightForearm: [-.42, 0, 0], leftLeg: [.62, 0, 0], rightLeg: [.58, 0, 0], leftShin: [-1.16, 0, 0], rightShin: [-1.1, 0, 0], rootY: -.34, rootTilt: .7 }) },
  { at: .86, pose: pose({ torso: [.72, 0, 0], leftArm: [-.38, 0, -.68], rightArm: [-.38, 0, .68], leftLeg: [.58, 0, 0], rightLeg: [.42, 0, 0], leftShin: [-1.12, 0, 0], rightShin: [-.86, 0, 0], rootY: -.3, rootTilt: .58 }) },
  { at: .93, pose: pose({ ...POSES.recovery, torso: [.34, 0, 0], leftArm: [-.45, 0, -.54], rightArm: [-.32, 0, .52], rootY: -.14, rootTilt: .3 }) },
  { at: 1, pose: POSES.combatIdle },
];
const SLAM_VICTIM: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.combatIdle },
  { at: .1, pose: pose({ ...lockVictim, leftArm: [-.9, 0, -.52], rightArm: [-.9, 0, .52], rootZ: -.04 }) },
  { at: .21, pose: lockVictim },
  { at: .34, pose: pose({ ...lockVictim, torso: [-.18, -.16, .08], leftArm: [-1.18, .22, -.5], rightArm: [-1.28, -.18, .5], leftForearm: [-1.32, 0, 0], rightForearm: [-1.3, 0, 0], leftLeg: [-.24, 0, -.12], rightLeg: [.28, 0, .12], leftShin: [-.38, 0, 0], rightShin: [-.62, 0, 0], rootZ: .12, rootYaw: -.14, rootRoll: .08 }) },
  { at: .47, pose: pose({ ...lockVictim, torso: [.18, 0, 0], rootY: .32, rootZ: -.18, rootTilt: -.34, leftLeg: [-.5, 0, 0], rightLeg: [.42, 0, 0], leftShin: [-.64, 0, 0], rightShin: [-.42, 0, 0] }) },
  { at: .6, pose: pose({ torso: [-.2, 0, 0], leftArm: [.42, 0, -.58], rightArm: [.42, 0, .58], leftForearm: [-.5, 0, 0], rightForearm: [-.5, 0, 0], leftLeg: [-.68, 0, 0], rightLeg: [.5, 0, 0], rootY: 1.05, rootZ: -.34, rootTilt: -1.05 }) },
  { at: .69, pose: pose({ torso: [-.28, 0, 0], leftArm: [.78, 0, -.6], rightArm: [.78, 0, .6], leftForearm: [-.18, 0, 0], rightForearm: [-.18, 0, 0], leftLeg: [-.78, 0, 0], rightLeg: [.52, 0, 0], leftShin: [-.56, 0, 0], rightShin: [-.78, 0, 0], rootY: 1.5, rootZ: -.44, rootTilt: -1.46 }) },
  { at: .79, pose: pose({ ...matVictim, rootY: -.48, rootTilt: -1.38 }) },
  { at: .86, pose: pose({ ...matVictim, leftArm: [.92, 0, -.62], rightArm: [.92, 0, .62], leftLeg: [-.72, 0, -.14], rightLeg: [.62, 0, .14], rootY: -.58, rootTilt: -1.54 }) },
  { at: .93, pose: matVictim },
  { at: 1, pose: POSES.downed },
];

const SUPLEX_ACTOR: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.combatIdle }, { at: .16, pose: lockActor },
  { at: .42, pose: pose({ ...lockActor, leftArm: [-1.35, -.28, -.28], rightArm: [-1.35, .28, .28], leftForearm: [-1.25, 0, 0], rightForearm: [-1.25, 0, 0], leftLeg: [.45, 0, 0], rightLeg: [.45, 0, 0], leftShin: [-.9, 0, 0], rightShin: [-.9, 0, 0], rootY: -.24, rootTilt: .3 }) },
  { at: .63, pose: pose({ torso: [-.48, 0, 0], leftArm: [-1.9, 0, -.3], rightArm: [-1.9, 0, .3], leftForearm: [-.65, 0, 0], rightForearm: [-.65, 0, 0], rootY: .3, rootTilt: -.5 }) },
  { at: .79, pose: pose({ torso: [-.9, 0, 0], leftArm: [-.35, 0, -.5], rightArm: [-.35, 0, .5], leftLeg: [-.45, 0, 0], rightLeg: [-.45, 0, 0], leftShin: [-1.2, 0, 0], rightShin: [-1.2, 0, 0], rootY: -.88, rootTilt: -1.15 }) },
  { at: 1, pose: POSES.recovery },
];
const SUPLEX_VICTIM: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.stagger }, { at: .16, pose: lockVictim },
  { at: .42, pose: pose({ ...lockVictim, rootY: .42, rootZ: -.25, rootTilt: -.35 }) },
  { at: .63, pose: pose({ torso: [-.2, 0, 0], leftArm: [.55, 0, -.6], rightArm: [.55, 0, .6], leftLeg: [-.35, 0, 0], rightLeg: [.6, 0, 0], leftShin: [-.7, 0, 0], rightShin: [-.4, 0, 0], rootY: 1.58, rootZ: -.55, rootTilt: 2.7 }) },
  { at: .79, pose: pose({ ...matVictim, rootYaw: Math.PI, rootTilt: 1.48 }) }, { at: 1, pose: POSES.downed },
];

const POWERBOMB_ACTOR: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.combatIdle }, { at: .13, pose: lockActor },
  { at: .36, pose: pose({ ...lockActor, torso: [.72, 0, 0], leftArm: [-.45, 0, -.5], rightArm: [-.45, 0, .5], leftForearm: [-1.42, 0, 0], rightForearm: [-1.42, 0, 0], leftLeg: [.72, 0, 0], rightLeg: [.72, 0, 0], leftShin: [-1.25, 0, 0], rightShin: [-1.25, 0, 0], rootY: -.38, rootTilt: .45 }) },
  { at: .61, pose: pose({ torso: [-.18, 0, 0], leftArm: [-1.95, 0, -.38], rightArm: [-1.95, 0, .38], leftForearm: [-.75, 0, 0], rightForearm: [-.75, 0, 0], rootY: .18, rootTilt: -.12 }) },
  { at: .79, pose: pose({ torso: [.95, 0, 0], leftArm: [-.1, 0, -.82], rightArm: [-.1, 0, .82], leftLeg: [.65, 0, 0], rightLeg: [.65, 0, 0], leftShin: [-1.3, 0, 0], rightShin: [-1.3, 0, 0], rootY: -.55, rootTilt: .72 }) },
  { at: 1, pose: POSES.combatIdle },
];
const POWERBOMB_VICTIM: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.stagger }, { at: .13, pose: lockVictim },
  { at: .36, pose: pose({ ...lockVictim, rootY: .68, rootZ: -.32, rootTilt: 1.05, leftLeg: [-1.15, 0, 0], rightLeg: [-1.15, 0, 0], leftShin: [-1.05, 0, 0], rightShin: [-1.05, 0, 0] }) },
  { at: .61, pose: pose({ torso: [-.2, 0, 0], leftArm: [.45, 0, -.65], rightArm: [.45, 0, .65], leftLeg: [-1.25, 0, 0], rightLeg: [-1.25, 0, 0], leftShin: [-.8, 0, 0], rightShin: [-.8, 0, 0], rootY: 1.82, rootZ: -.2, rootTilt: 2.86 }) },
  { at: .79, pose: pose({ ...matVictim, rootTilt: -1.62, rootZ: .25 }) }, { at: 1, pose: POSES.downed },
];

const CHOKE_ACTOR: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.combatIdle }, { at: .18, pose: lockActor },
  { at: .48, pose: pose({ torso: [-.1, 0, -.12], leftArm: [-.55, 0, -.5], rightArm: [-1.45, 0, .22], leftForearm: [-1.1, 0, 0], rightForearm: [-.35, 0, 0], rightLeg: [-.35, 0, 0], rootZ: -.08, rootTilt: -.05 }) },
  { at: .64, pose: pose({ torso: [.08, 0, -.16], leftArm: [-.45, 0, -.55], rightArm: [-1.72, 0, .18], rightForearm: [-.2, 0, 0], rootY: .08, rootZ: -.12 }) },
  { at: .8, pose: pose({ torso: [.62, 0, 0], rightArm: [-.35, 0, .72], rightForearm: [-.55, 0, 0], rootY: -.28, rootTilt: .48 }) },
  { at: 1, pose: POSES.combatIdle },
];
const CHOKE_VICTIM: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.stagger }, { at: .18, pose: lockVictim },
  { at: .48, pose: pose({ torso: [-.28, 0, 0], leftArm: [-1.25, 0, -.5], rightArm: [-1.25, 0, .5], leftForearm: [-1.3, 0, 0], rightForearm: [-1.3, 0, 0], leftLeg: [.25, 0, 0], rightLeg: [-.2, 0, 0], rootY: .18, rootTilt: -.18 }) },
  { at: .64, pose: pose({ torso: [-.55, 0, 0], leftArm: [-1.4, 0, -.5], rightArm: [-1.4, 0, .5], leftForearm: [-1.25, 0, 0], rightForearm: [-1.25, 0, 0], rootY: .42, rootTilt: -.32 }) },
  { at: .8, pose: matVictim }, { at: 1, pose: POSES.downed },
];

const TOSS_ACTOR: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.combatIdle }, { at: .18, pose: lockActor },
  { at: .48, pose: pose({ torso: [.42, .48, -.15], leftArm: [-.6, -.6, -.62], rightArm: [-.92, -.35, .58], leftForearm: [-1.05, 0, 0], rightForearm: [-.75, 0, 0], leftLeg: [.45, 0, 0], leftShin: [-.85, 0, 0], rootYaw: -.35, rootTilt: .3 }) },
  { at: .76, pose: pose({ torso: [.24, -.72, .12], leftArm: [-.35, .65, -.72], rightArm: [-.35, .65, .72], leftForearm: [-.25, 0, 0], rightForearm: [-.25, 0, 0], rootYaw: .55, rootRoll: -.25 }) },
  { at: 1, pose: POSES.combatIdle },
];
const TOSS_VICTIM: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.stagger }, { at: .18, pose: lockVictim },
  { at: .48, pose: pose({ ...lockVictim, rootY: .45, rootX: -.35, rootRoll: -.62, leftLeg: [-.55, 0, 0], rightLeg: [.48, 0, 0] }) },
  { at: .76, pose: pose({ ...matVictim, rootX: 1.05, rootY: -.72, rootRoll: -1.2 }) }, { at: 1, pose: POSES.downed },
];

const WHIP_ACTOR: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.combatIdle }, { at: .16, pose: lockActor },
  { at: .48, pose: pose({ torso: [.18, .55, 0], leftArm: [-.7, -.58, -.58], rightArm: [-.7, -.35, .58], leftForearm: [-1.22, 0, 0], rightForearm: [-1.22, 0, 0], leftLeg: [.35, 0, 0], rootYaw: .5, rootZ: -.12 }) },
  { at: .76, pose: pose({ torso: [.15, -.65, 0], leftArm: [-.45, .65, -.65], rightArm: [-.45, .4, .65], leftForearm: [-.35, 0, 0], rightForearm: [-.35, 0, 0], rightLeg: [-.3, 0, 0], rootYaw: -.55, rootZ: .2 }) },
  { at: 1, pose: POSES.combatIdle },
];
const WHIP_VICTIM: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.stagger }, { at: .16, pose: lockVictim },
  { at: .48, pose: pose({ ...lockVictim, torso: [.3, 0, 0], leftArm: [-1.3, 0, -.5], leftForearm: [-.55, 0, 0], rootX: -.28, rootYaw: -.4, rootTilt: .22 }) },
  { at: .76, pose: pose({ ...POSES.run, torso: [.28, 0, 0], leftArm: [.25, 0, -.35], rightArm: [-.65, 0, .42], leftForearm: [-1, 0, 0], rightForearm: [-1.1, 0, 0], rootZ: .7, rootYaw: .32, rootTilt: .18 }) },
  { at: 1, pose: POSES.stagger },
];

const CLAW_FINISHER_VICTIM: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.stagger }, { at: .18, pose: lockVictim },
  { at: .48, pose: pose({ torso: [-.3, 0, 0], leftArm: [-1.3, 0, -.5], rightArm: [-1.3, 0, .5], leftForearm: [-1.35, 0, 0], rightForearm: [-1.35, 0, 0], leftLeg: [.2, 0, 0], rightLeg: [-.2, 0, 0], rootY: .2, rootTilt: -.2 }) },
  { at: .63, pose: pose({ torso: [-.48, 0, 0], leftArm: [-1.42, 0, -.55], rightArm: [-1.42, 0, .55], leftForearm: [-1.2, 0, 0], rightForearm: [-1.2, 0, 0], leftLeg: [-.6, 0, 0], rightLeg: [.45, 0, 0], rootY: 1.05, rootZ: -.24, rootTilt: -.52 }) },
  { at: .8, pose: pose({ ...matVictim, rootZ: .22, rootTilt: -1.62 }) }, { at: 1, pose: POSES.downed },
];

const SPINE_ACTOR: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.combatIdle }, { at: .14, pose: lockActor },
  { at: .42, pose: pose({ ...lockActor, torso: [.5, 0, 0], leftArm: [-.5, -.2, -.55], rightArm: [-.5, .2, .55], leftForearm: [-1.3, 0, 0], rightForearm: [-1.3, 0, 0], leftLeg: [.55, 0, 0], rightLeg: [.55, 0, 0], leftShin: [-1, 0, 0], rightShin: [-1, 0, 0], rootY: -.3 }) },
  { at: .62, pose: pose({ torso: [-.18, 0, 0], leftArm: [-1.4, -.25, -.35], rightArm: [-1.4, .25, .35], leftForearm: [-.8, 0, 0], rightForearm: [-.8, 0, 0], rootY: .28 }) },
  { at: .79, pose: pose({ torso: [.88, 0, 0], leftArm: [-.15, 0, -.72], rightArm: [-.15, 0, .72], leftLeg: [.65, 0, 0], rightLeg: [.65, 0, 0], leftShin: [-1.25, 0, 0], rightShin: [-1.25, 0, 0], rootY: -.5, rootTilt: .68 }) },
  { at: 1, pose: POSES.recovery },
];
const SPINE_VICTIM: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.stagger }, { at: .14, pose: lockVictim },
  { at: .42, pose: pose({ ...lockVictim, rootY: .58, rootTilt: -.45 }) },
  { at: .62, pose: pose({ torso: [-.15, 0, 0], leftArm: [.6, 0, -.55], rightArm: [.6, 0, .55], leftLeg: [-.62, 0, 0], rightLeg: [.5, 0, 0], rootY: 1.35, rootZ: -.38, rootTilt: -1.35 }) },
  { at: .79, pose: matVictim }, { at: 1, pose: POSES.downed },
];

const GRAPPLE_STYLES: Readonly<Record<string, readonly [readonly PoseKeyframe[], readonly PoseKeyframe[]]>> = {
  slam: [SLAM_ACTOR, SLAM_VICTIM], mountain_drop: [SLAM_ACTOR, SLAM_VICTIM],
  suplex: [SUPLEX_ACTOR, SUPLEX_VICTIM], skyhook: [SUPLEX_ACTOR, SUPLEX_VICTIM],
  powerbomb: [POWERBOMB_ACTOR, POWERBOMB_VICTIM],
  clutch: [CHOKE_ACTOR, CHOKE_VICTIM],
  takedown: [TOSS_ACTOR, TOSS_VICTIM], arm_drag: [TOSS_ACTOR, TOSS_VICTIM], side_toss: [TOSS_ACTOR, TOSS_VICTIM], whip: [WHIP_ACTOR, WHIP_VICTIM],
  spinebuster: [SPINE_ACTOR, SPINE_VICTIM],
  corner_smash: [WHIP_ACTOR, WHIP_VICTIM],
};

const stagedGrappleVariant = (source: Pose, moveId: string, role: Role, progress: number, actorId: FighterId): Pose => {
  let result = source;
  const peak = Math.max(0, 1 - Math.abs(progress - .66) / .18);
  if (moveId === 'takedown') result = { ...result, rootY: result.rootY - peak * (role === 'actor' ? .14 : .28), rootTilt: result.rootTilt + peak * (role === 'actor' ? .18 : -.2) };
  else if (moveId === 'arm_drag') result = { ...result, rootX: result.rootX + peak * (role === 'actor' ? -.18 : .48), rootYaw: result.rootYaw + peak * (role === 'actor' ? .44 : -.7), rootRoll: result.rootRoll + peak * -.22 };
  else if (moveId === 'side_toss') result = { ...result, rootX: result.rootX + peak * (role === 'actor' ? .16 : .72), rootYaw: result.rootYaw + peak * (role === 'actor' ? -.5 : .82), rootRoll: result.rootRoll + peak * (role === 'actor' ? .16 : -.48) };
  else if (moveId === 'skyhook') result = { ...result, rootY: result.rootY + peak * (role === 'victim' ? .28 : .08), rootRoll: result.rootRoll + peak * (role === 'actor' ? -.18 : .24) };
  else if (moveId === 'mountain_drop') result = { ...result, rootY: result.rootY + peak * (role === 'victim' ? .34 : .1), rootTilt: result.rootTilt + peak * (role === 'actor' ? -.12 : -.18) };
  else if (moveId === 'corner_smash') result = { ...result, rootZ: result.rootZ + peak * (role === 'actor' ? .35 : 1.05), rootTilt: result.rootTilt + peak * (role === 'victim' ? -.42 : .16) };

  if (moveId !== 'slam') return result;
  if (actorId === 'atlas') return { ...result, rootY: result.rootY + peak * (role === 'victim' ? .3 : .06), rootTilt: result.rootTilt + peak * (role === 'actor' ? -.08 : -.16) };
  if (actorId === 'vex') return { ...result, rootYaw: result.rootYaw + peak * (role === 'actor' ? .34 : -.42), rootRoll: result.rootRoll + peak * (role === 'actor' ? -.12 : .22) };
  if (actorId === 'nova') return { ...result, rootYaw: result.rootYaw + peak * (role === 'actor' ? -.18 : .24), rootZ: result.rootZ + peak * (role === 'actor' ? -.08 : -.16) };
  if (actorId === 'chad') return { ...result, rootY: result.rootY + peak * (role === 'victim' ? .22 : .1), rootTilt: result.rootTilt + peak * (role === 'actor' ? .14 : -.12), rootRoll: result.rootRoll + peak * .13 };
  return { ...result, rootZ: result.rootZ + peak * (role === 'actor' ? .1 : -.08), rootTilt: result.rootTilt + peak * (role === 'actor' ? .08 : -.05) };
};

const finisherStyle = (fighterId: FighterId): readonly [readonly PoseKeyframe[], readonly PoseKeyframe[]] => {
  if (fighterId === 'chad') return [CHOKE_ACTOR, CLAW_FINISHER_VICTIM];
  if (fighterId === 'atlas') return [POWERBOMB_ACTOR, POWERBOMB_VICTIM];
  if (fighterId === 'nova') return [SUPLEX_ACTOR, SUPLEX_VICTIM];
  if (fighterId === 'vex') return [TOSS_ACTOR, TOSS_VICTIM];
  return [SPINE_ACTOR, SPINE_VICTIM];
};

export const getPairedPose = (move: MoveDefinition, role: Role, phase: AttackPhase, elapsed: number, actorId: FighterId): Pose | null => {
  const pair = move.category === 'finisher' ? finisherStyle(actorId) : GRAPPLE_STYLES[move.id];
  if (!pair) return null;
  const progress = cinematicProgress(move, phase, elapsed);
  return stagedGrappleVariant(sample(role === 'actor' ? pair[0] : pair[1], progress), move.id, role, progress, actorId);
};

const strikeFrames = (moveId: string): readonly PoseKeyframe[] => {
  if (moveId === 'jab') return [
    { at: 0, pose: POSES.combatIdle },
    { at: .46, pose: pose({ torso: [-.08, .2, 0], rightArm: [.18, 0, .7], rightForearm: [-1.18, 0, 0], leftArm: [-.72, 0, -.35], leftForearm: [-1.08, 0, 0], rootYaw: .18 }) },
    { at: .68, pose: pose({ torso: [.08, -.18, 0], rightArm: [-1.52, 0, .08], rightForearm: [-.08, 0, 0], leftArm: [-.72, 0, -.42], leftForearm: [-1.05, 0, 0], rootZ: .14, rootYaw: -.12, rootTilt: .1 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'combo') return [
    { at: 0, pose: POSES.combatIdle },
    { at: .36, pose: pose({ torso: [-.05, .28, 0], leftArm: [.12, 0, -.7], leftForearm: [-1.18, 0, 0], rightArm: [-.7, 0, .42], rightForearm: [-1.05, 0, 0], rootYaw: .2 }) },
    { at: .58, pose: pose({ torso: [.08, -.18, 0], leftArm: [-1.48, 0, -.08], leftForearm: [-.1, 0, 0], rightArm: [-.65, 0, .42], rootYaw: -.18, rootZ: .1 }) },
    { at: .76, pose: pose({ torso: [.12, .22, 0], leftArm: [-.6, 0, -.38], rightArm: [-1.5, 0, .08], rightForearm: [-.08, 0, 0], rootYaw: .16, rootZ: .16 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'high_punch') return [
    { at: 0, pose: POSES.combatIdle },
    { at: .44, pose: pose({ torso: [-.14, .32, -.08], rightArm: [.02, -.18, .78], rightForearm: [-1.34, 0, 0], leftArm: [-.86, 0, -.42], leftForearm: [-1.14, 0, 0], rightLeg: [-.12, 0, 0], rootYaw: .26, rootY: -.04 }) },
    { at: .7, pose: pose({ torso: [-.12, -.28, .04], rightArm: [-1.66, -.12, .05], rightForearm: [-.04, 0, 0], leftArm: [-.76, 0, -.48], leftForearm: [-1.06, 0, 0], leftLeg: [.12, 0, 0], rootZ: .18, rootYaw: -.2, rootTilt: .14 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'heavy' || moveId === 'prop') return [
    { at: 0, pose: POSES.combatIdle },
    { at: .5, pose: pose({ torso: [-.08, .6, -.2], rightArm: [.42, -.4, .95], rightForearm: [-1.28, 0, 0], leftArm: [-.72, 0, -.38], leftForearm: [-1.05, 0, 0], rightLeg: [-.25, 0, 0], rootYaw: .58, rootRoll: -.12 }) },
    { at: .72, pose: pose({ torso: [.18, -.62, .12], rightArm: [-1.28, -.28, .72], rightForearm: [-.18, 0, 0], leftArm: [-.58, 0, -.5], leftForearm: [-1.02, 0, 0], rootZ: .2, rootYaw: -.58, rootRoll: .16, rootTilt: .2 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'uppercut') return [
    { at: 0, pose: POSES.combatIdle },
    { at: .46, pose: pose({ torso: [.42, .48, -.18], rightArm: [.5, -.2, .52], rightForearm: [-1.55, 0, 0], leftArm: [-.78, 0, -.42], leftForearm: [-1.18, 0, 0], leftLeg: [.38, 0, 0], rightLeg: [.48, 0, 0], leftShin: [-.82, 0, 0], rightShin: [-.92, 0, 0], rootY: -.3, rootYaw: .34, rootTilt: .32 }) },
    { at: .72, pose: pose({ torso: [-.38, -.3, .1], rightArm: [-2.15, 0, .18], rightForearm: [-.24, 0, 0], leftArm: [-.66, 0, -.5], leftForearm: [-1.05, 0, 0], leftLeg: [-.16, 0, 0], rightLeg: [-.24, 0, 0], rootY: .22, rootZ: .2, rootYaw: -.24, rootTilt: -.22 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'stiff_arm' || moveId === 'rebound') return [
    { at: 0, pose: POSES.run },
    { at: .5, pose: pose({ ...POSES.run, rightArm: [-.72, 0, .45], rightForearm: [-1.25, 0, 0], leftArm: [.45, 0, -.35], rootTilt: .22 }) },
    { at: .76, pose: pose({ ...POSES.run, rightArm: [-1.48, 0, .08], rightForearm: [-.04, 0, 0], leftArm: [-.42, 0, -.45], rootZ: .28, rootTilt: .3 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'front_kick') return [
    { at: 0, pose: POSES.combatIdle },
    { at: .48, pose: pose({ torso: [.2, 0, 0], rightLeg: [1.05, 0, 0], rightShin: [-1.72, 0, 0], leftLeg: [-.18, 0, 0], leftShin: [-.35, 0, 0], leftArm: [-.78, 0, -.48], rightArm: [-.7, 0, .48], rootY: .08, rootTilt: .16 }) },
    { at: .72, pose: pose({ torso: [-.12, 0, 0], rightLeg: [-1.38, 0, 0], rightShin: [.08, 0, 0], leftLeg: [.25, 0, 0], leftShin: [-.3, 0, 0], leftArm: [-.9, 0, -.55], rightArm: [-.82, 0, .55], rootZ: .22, rootTilt: -.08 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'low_kick') return [
    { at: 0, pose: POSES.combatIdle },
    { at: .47, pose: pose({ torso: [.12, .24, 0], rightLeg: [.68, 0, -.2], rightShin: [-1.32, 0, 0], leftLeg: [-.24, 0, .12], leftShin: [-.46, 0, 0], leftArm: [-.72, 0, -.55], rightArm: [-.62, 0, .55], rootYaw: .28, rootTilt: .14 }) },
    { at: .7, pose: pose({ torso: [.2, -.34, .08], rightLeg: [-.86, 0, -.36], rightShin: [.08, 0, 0], leftLeg: [.22, 0, .1], leftShin: [-.36, 0, 0], leftArm: [-.92, 0, -.62], rightArm: [-.76, 0, .48], rootY: -.08, rootZ: .16, rootYaw: -.48, rootRoll: .14 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'high_kick') return [
    { at: 0, pose: POSES.combatIdle },
    { at: .48, pose: pose({ torso: [.28, .36, -.12], rightLeg: [1.24, 0, -.34], rightShin: [-1.58, 0, 0], leftLeg: [-.28, 0, .12], leftShin: [-.55, 0, 0], leftArm: [-.55, 0, -.72], rightArm: [-.48, 0, .7], rootYaw: .38, rootTilt: .22 }) },
    { at: .73, pose: pose({ torso: [-.22, -.4, .18], rightLeg: [-1.72, 0, -.3], rightShin: [.06, 0, 0], leftLeg: [.3, 0, .08], leftShin: [-.42, 0, 0], leftArm: [-1.02, 0, -.7], rightArm: [-.84, 0, .58], rootY: .12, rootZ: .2, rootYaw: -.48, rootRoll: .2, rootTilt: -.16 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'roundhouse') return [
    { at: 0, pose: POSES.combatIdle },
    { at: .46, pose: pose({ torso: [.22, .74, -.18], rightLeg: [.94, 0, -.5], rightShin: [-1.42, 0, 0], leftLeg: [-.3, 0, .22], leftShin: [-.58, 0, 0], leftArm: [-.42, 0, -.82], rightArm: [-.3, 0, .88], rootYaw: .82, rootTilt: .18, rootRoll: -.18 }) },
    { at: .7, pose: pose({ torso: [-.18, -1.05, .22], rightLeg: [-1.58, 0, -.75], rightShin: [-.05, 0, 0], leftLeg: [.4, 0, .18], leftShin: [-.48, 0, 0], leftArm: [-1.1, 0, -.68], rightArm: [-.95, 0, .75], rootY: .16, rootZ: .24, rootYaw: -1.08, rootRoll: .26, rootTilt: -.12 }) },
    { at: .84, pose: pose({ ...POSES.recovery, rootYaw: -.5, rootRoll: .16 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'spear') return [
    { at: 0, pose: POSES.run },
    { at: .5, pose: pose({ ...POSES.run, torso: [.42, 0, 0], leftArm: [-1.15, 0, -.42], rightArm: [-1.15, 0, .42], leftForearm: [-1.25, 0, 0], rightForearm: [-1.25, 0, 0], rootTilt: .52, rootY: -.18 }) },
    { at: .78, pose: pose({ ...POSES.run, torso: [.7, 0, 0], leftArm: [-1.48, 0, -.32], rightArm: [-1.48, 0, .32], leftForearm: [-.85, 0, 0], rightForearm: [-.85, 0, 0], rootZ: .36, rootTilt: .72, rootY: -.28 }) },
    { at: 1, pose: POSES.recovery },
  ];
  if (moveId === 'ground') return [
    { at: 0, pose: POSES.combatIdle }, { at: .5, pose: pose({ torso: [.42, 0, 0], rightLeg: [.72, 0, 0], rightShin: [-1.22, 0, 0], rootTilt: .32 }) },
    { at: .72, pose: pose({ torso: [.68, 0, 0], rightLeg: [-1.18, 0, 0], rightShin: [.18, 0, 0], rootY: -.15, rootTilt: .48 }) }, { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'aerial_elbow') return [
    { at: 0, pose: POSES.climb },
    { at: .45, pose: pose({ torso: [.35, 0, 0], rightArm: [-.72, 0, .82], rightForearm: [-1.72, 0, 0], leftArm: [-1.18, 0, -.42], leftForearm: [-.65, 0, 0], leftLeg: [.5, 0, 0], rightLeg: [-.4, 0, 0], rootTilt: .48, rootY: .38 }) },
    { at: .72, pose: pose({ torso: [.78, 0, 0], rightArm: [-1.08, 0, .38], rightForearm: [-1.48, 0, 0], leftArm: [-1.5, 0, -.28], leftForearm: [-.45, 0, 0], leftLeg: [.28, 0, 0], rightLeg: [.42, 0, 0], leftShin: [-.8, 0, 0], rightShin: [-.7, 0, 0], rootTilt: .92, rootZ: .42, rootY: .12 }) },
    { at: 1, pose: POSES.recovery },
  ];
  if (moveId === 'aerial_kick' || moveId === 'aerial') return [
    { at: 0, pose: POSES.climb },
    { at: .46, pose: pose({ torso: [.2, 0, 0], rightLeg: [1.1, 0, 0], rightShin: [-1.45, 0, 0], leftLeg: [.3, 0, 0], leftShin: [-1.1, 0, 0], leftArm: [-1.35, 0, -.62], rightArm: [-1.28, 0, .62], rootY: .42, rootTilt: .25 }) },
    { at: .72, pose: pose({ torso: [.48, 0, 0], rightLeg: [-1.46, 0, 0], rightShin: [.06, 0, 0], leftLeg: [-1.1, 0, 0], leftShin: [.1, 0, 0], leftArm: [-1.6, 0, -.38], rightArm: [-1.55, 0, .4], rootZ: .48, rootTilt: .62, rootY: .08 }) },
    { at: 1, pose: POSES.recovery },
  ];
  if (moveId === 'kick_up') return [
    { at: 0, pose: POSES.downed },
    { at: .34, pose: pose({ torso: [-.88, 0, 0], leftArm: [-1.45, 0, -.35], rightArm: [-1.45, 0, .35], leftForearm: [-.22, 0, 0], rightForearm: [-.22, 0, 0], leftLeg: [1.35, 0, 0], rightLeg: [1.35, 0, 0], leftShin: [-.42, 0, 0], rightShin: [-.42, 0, 0], rootY: .18, rootTilt: -1.08 }) },
    { at: .62, pose: pose({ torso: [.3, 0, 0], leftArm: [-.85, 0, -.72], rightArm: [-.85, 0, .72], leftLeg: [-1.18, 0, 0], rightLeg: [-1.18, 0, 0], leftShin: [.2, 0, 0], rightShin: [.2, 0, 0], rootY: .72, rootTilt: .2 }) },
    { at: .82, pose: POSES.recovery },
    { at: 1, pose: POSES.combatIdle },
  ];
  return [];
};

export const getStrikePose = (move: MoveDefinition, phase: AttackPhase, elapsed: number): Pose | null => {
  const frames = strikeFrames(move.id);
  return frames.length > 0 ? sample(frames, cinematicProgress(move, phase, elapsed)) : null;
};

const LIGHT_REACTION: readonly PoseKeyframe[] = [
  { at: .6, pose: POSES.combatIdle },
  { at: .72, pose: pose({ torso: [-.52, .18, .08], leftArm: [.48, 0, -.48], rightArm: [.62, 0, .5], leftForearm: [-.25, 0, 0], rightForearm: [-.35, 0, 0], leftLeg: [-.16, 0, 0], rightLeg: [.2, 0, 0], rootZ: -.12, rootTilt: -.28, rootYaw: .16 }) },
  { at: 1, pose: POSES.stagger },
];
const HEAVY_REACTION: readonly PoseKeyframe[] = [
  { at: .6, pose: POSES.combatIdle },
  { at: .73, pose: pose({ torso: [-.75, .25, -.28], leftArm: [.95, 0, -.55], rightArm: [.78, 0, .58], leftForearm: [-.12, 0, 0], rightForearm: [-.18, 0, 0], leftLeg: [-.52, 0, 0], rightLeg: [.42, 0, 0], leftShin: [-.7, 0, 0], rightShin: [-.4, 0, 0], rootY: .18, rootZ: -.28, rootTilt: -.52, rootYaw: -.28, rootRoll: .34 }) },
  { at: .87, pose: POSES.knockdown }, { at: 1, pose: POSES.stagger },
];
const STIFF_REACTION: readonly PoseKeyframe[] = [
  { at: .6, pose: POSES.combatIdle },
  { at: .72, pose: pose({ torso: [-.65, 0, 0], leftArm: [.9, 0, -.58], rightArm: [.9, 0, .58], leftForearm: [-.15, 0, 0], rightForearm: [-.15, 0, 0], leftLeg: [-.72, 0, 0], rightLeg: [.6, 0, 0], rootY: .62, rootZ: -.58, rootTilt: -.82 }) },
  { at: .88, pose: POSES.knockdown }, { at: 1, pose: POSES.downed },
];

export const getStrikeReactionPose = (move: MoveDefinition, phase: AttackPhase, elapsed: number): Pose | null => {
  if (phase !== 'active' && phase !== 'recovery') return null;
  const frames = move.id === 'stiff_arm' || move.id === 'rebound' || move.category === 'aerial' ? STIFF_REACTION
    : move.category === 'heavy' || move.category === 'prop' || move.id === 'ground' ? HEAVY_REACTION : LIGHT_REACTION;
  return sample(frames, cinematicProgress(move, phase, elapsed));
};
