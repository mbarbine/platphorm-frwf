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
  leftShin: [-.52, 0, 0], rightShin: [-.8, 0, 0], rootY: -1.08, rootTilt: -1.5,
});

const SLAM_ACTOR: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.combatIdle }, { at: .14, pose: lockActor },
  { at: .36, pose: pose({ torso: [.5, 0, 0], leftArm: [-.55, 0, -.52], rightArm: [-.55, 0, .52], leftForearm: [-1.35, 0, 0], rightForearm: [-1.35, 0, 0], leftLeg: [.62, 0, 0], rightLeg: [.62, 0, 0], leftShin: [-1.05, 0, 0], rightShin: [-1.05, 0, 0], rootY: -.28, rootTilt: .3 }) },
  { at: .61, pose: pose({ torso: [-.12, 0, 0], leftArm: [-1.45, -.15, -.35], rightArm: [-1.45, .15, .35], leftForearm: [-1.1, 0, 0], rightForearm: [-1.1, 0, 0], rootY: .2, rootTilt: -.12 }) },
  { at: .77, pose: pose({ torso: [.82, 0, 0], leftArm: [-.18, 0, -.75], rightArm: [-.18, 0, .75], leftLeg: [.55, 0, 0], leftShin: [-1.12, 0, 0], rootY: -.3, rootTilt: .62 }) },
  { at: 1, pose: POSES.combatIdle },
];
const SLAM_VICTIM: readonly PoseKeyframe[] = [
  { at: 0, pose: POSES.stagger }, { at: .14, pose: lockVictim },
  { at: .36, pose: pose({ ...lockVictim, rootY: .55, rootTilt: -.45, rootZ: -.12, leftLeg: [-.45, 0, 0], rightLeg: [.35, 0, 0] }) },
  { at: .61, pose: pose({ torso: [-.25, 0, 0], leftArm: [.72, 0, -.55], rightArm: [.72, 0, .55], leftForearm: [-.25, 0, 0], rightForearm: [-.25, 0, 0], leftLeg: [-.72, 0, 0], rightLeg: [.45, 0, 0], rootY: 1.48, rootZ: -.42, rootTilt: -1.42 }) },
  { at: .77, pose: matVictim }, { at: 1, pose: POSES.downed },
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
  return sample(role === 'actor' ? pair[0] : pair[1], cinematicProgress(move, phase, elapsed));
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
  if (moveId === 'heavy' || moveId === 'prop') return [
    { at: 0, pose: POSES.combatIdle },
    { at: .5, pose: pose({ torso: [-.08, .6, -.2], rightArm: [.42, -.4, .95], rightForearm: [-1.28, 0, 0], leftArm: [-.72, 0, -.38], leftForearm: [-1.05, 0, 0], rightLeg: [-.25, 0, 0], rootYaw: .58, rootRoll: -.12 }) },
    { at: .72, pose: pose({ torso: [.18, -.62, .12], rightArm: [-1.28, -.28, .72], rightForearm: [-.18, 0, 0], leftArm: [-.58, 0, -.5], leftForearm: [-1.02, 0, 0], rootZ: .2, rootYaw: -.58, rootRoll: .16, rootTilt: .2 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'stiff_arm' || moveId === 'rebound') return [
    { at: 0, pose: POSES.run },
    { at: .5, pose: pose({ ...POSES.run, rightArm: [-.72, 0, .45], rightForearm: [-1.25, 0, 0], leftArm: [.45, 0, -.35], rootTilt: .22 }) },
    { at: .76, pose: pose({ ...POSES.run, rightArm: [-1.48, 0, .08], rightForearm: [-.04, 0, 0], leftArm: [-.42, 0, -.45], rootZ: .28, rootTilt: .3 }) },
    { at: 1, pose: POSES.combatIdle },
  ];
  if (moveId === 'ground') return [
    { at: 0, pose: POSES.combatIdle }, { at: .5, pose: pose({ torso: [.42, 0, 0], rightLeg: [.72, 0, 0], rightShin: [-1.22, 0, 0], rootTilt: .32 }) },
    { at: .72, pose: pose({ torso: [.68, 0, 0], rightLeg: [-1.18, 0, 0], rightShin: [.18, 0, 0], rootY: -.15, rootTilt: .48 }) }, { at: 1, pose: POSES.combatIdle },
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
