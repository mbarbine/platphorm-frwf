import type { AnimationKey } from '../types/game';

export interface Pose {
  torso: [number, number, number];
  leftArm: [number, number, number];
  rightArm: [number, number, number];
  leftLeg: [number, number, number];
  rightLeg: [number, number, number];
  rootY: number;
  rootTilt: number;
}

const base: Pose = { torso: [0, 0, 0], leftArm: [0, 0, -.2], rightArm: [0, 0, .2], leftLeg: [0, 0, 0], rightLeg: [0, 0, 0], rootY: 0, rootTilt: 0 };

export const POSES: Readonly<Record<AnimationKey, Pose>> = {
  idle: base,
  combatIdle: { ...base, leftArm: [-.48, 0, -.28], rightArm: [-.55, 0, .32], leftLeg: [.08, 0, 0], rightLeg: [-.08, 0, 0] },
  walk: { ...base, leftArm: [.28, 0, -.2], rightArm: [-.28, 0, .2], leftLeg: [-.28, 0, 0], rightLeg: [.28, 0, 0], rootY: .04 },
  run: { ...base, torso: [.18, 0, 0], leftArm: [.62, 0, -.3], rightArm: [-.62, 0, .3], leftLeg: [-.55, 0, 0], rightLeg: [.5, 0, 0], rootTilt: .12 },
  jab: { ...base, torso: [0, -.15, 0], rightArm: [-1.32, 0, .08], leftArm: [-.62, 0, -.35], rootTilt: .07 },
  heavyStrike: { ...base, torso: [.1, -.48, -.22], rightArm: [-1.1, -.55, .85], leftArm: [-.3, 0, -.45], rootTilt: .18 },
  kick: { ...base, torso: [-.12, 0, .12], leftArm: [-.55, 0, -.4], rightArm: [-.5, 0, .4], rightLeg: [-1.15, 0, .1], rootY: .1, rootTilt: -.08 },
  grappleEntry: { ...base, leftArm: [-1.05, 0, -.35], rightArm: [-1.05, 0, .35], torso: [.2, 0, 0], rootTilt: .13 },
  lift: { ...base, leftArm: [-2.3, 0, -.2], rightArm: [-2.3, 0, .2], rootY: .25 },
  slam: { ...base, torso: [.65, 0, 0], leftArm: [-.3, 0, -.7], rightArm: [-.3, 0, .7], rootTilt: .38 },
  throw: { ...base, torso: [.3, .5, 0], leftArm: [-.65, -.55, -.6], rightArm: [-.65, -.55, .6], rootTilt: .22 },
  stagger: { ...base, torso: [-.35, 0, 0], leftArm: [.7, 0, -.4], rightArm: [.45, 0, .4], rootTilt: -.2 },
  knockdown: { ...base, torso: [-.7, 0, 0], leftArm: [.8, 0, -.3], rightArm: [.8, 0, .3], rootY: -.6, rootTilt: -1 },
  downed: { ...base, rootY: -1.18, rootTilt: -1.5, leftArm: [.7, 0, -.45], rightArm: [-.25, 0, .45] },
  recovery: { ...base, rootY: -.55, rootTilt: -.7, leftArm: [-.9, 0, -.35] },
  dodge: { ...base, torso: [.35, 0, .35], leftArm: [-.3, 0, -.5], rightArm: [-.3, 0, .5], rootTilt: .25 },
  counter: { ...base, torso: [0, .2, 0], leftArm: [-.75, 0, -.6], rightArm: [-1.15, .2, .25], rightLeg: [-.55, 0, 0] },
  block: { ...base, torso: [.14, 0, 0], leftArm: [-1.42, -.12, -.48], rightArm: [-1.42, .12, .48], leftLeg: [.12, 0, 0], rightLeg: [-.12, 0, 0], rootTilt: .08 },
  climb: { ...base, torso: [.18, 0, 0], leftArm: [-1.2, 0, -.5], rightArm: [-1.2, 0, .5], leftLeg: [-.72, 0, 0], rightLeg: [-.72, 0, 0], rootY: 1.02, rootTilt: .16 },
  aerial: { ...base, torso: [-.38, 0, 0], leftArm: [-2.35, 0, -.45], rightArm: [-2.35, 0, .45], leftLeg: [-.8, 0, 0], rightLeg: [-.55, 0, 0], rootY: 1.55, rootTilt: -.38 },
  taunt: { ...base, leftArm: [-2.65, 0, -.5], rightArm: [-2.65, 0, .5], rootY: .12 },
  pin: { ...base, torso: [1.05, 0, 0], leftArm: [-.65, 0, -.3], rootY: -.6, rootTilt: .65 },
  kickout: { ...base, leftArm: [-2.1, 0, -.6], rightArm: [-2.1, 0, .6], rootY: -.8, rootTilt: -1.2 },
  victory: { ...base, leftArm: [-2.75, 0, -.25], rightArm: [-2.75, 0, .25], rootY: .12 },
  defeat: { ...base, rootY: -1.15, rootTilt: -1.52, leftArm: [.4, 0, -.3], rightArm: [-.5, 0, .3] },
  finisher: { ...base, torso: [.4, .25, 0], leftArm: [-1.8, -.25, -.5], rightArm: [-1.8, .25, .5], rootY: .35, rootTilt: .25 },
};
