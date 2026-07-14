import type { FighterDefinition } from '../types/game';

export type BodySegmentId =
  | 'pelvis' | 'abdomen' | 'chest' | 'head'
  | 'leftUpperArm' | 'rightUpperArm' | 'leftForearm' | 'rightForearm' | 'leftHand' | 'rightHand'
  | 'leftThigh' | 'rightThigh' | 'leftShin' | 'rightShin' | 'leftFoot' | 'rightFoot';

export type SegmentSide = 'center' | 'left' | 'right';
export type ColliderRole = 'body' | 'strike' | 'grip' | 'support';

export interface BodySegmentSchema {
  id: BodySegmentId;
  side: SegmentSide;
  bodyRegion: 'head' | 'chest' | 'ribs' | 'pelvis' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
  colliderRole: ColliderRole;
  massKg: number;
  halfLength: number;
  radius: number;
  damageMultiplier: number;
  attackEligible: boolean;
  gripAnchorEligible: boolean;
  localPosition: readonly [number, number, number];
}

const SEGMENT_RATIOS: Readonly<Record<BodySegmentId, number>> = {
  pelvis: .15, abdomen: .1, chest: .18, head: .08,
  leftUpperArm: .03, rightUpperArm: .03, leftForearm: .02, rightForearm: .02, leftHand: .01, rightHand: .01,
  leftThigh: .1, rightThigh: .1, leftShin: .05, rightShin: .05, leftFoot: .035, rightFoot: .035,
};

const segment = (definition: FighterDefinition, id: BodySegmentId, side: SegmentSide, y: number, x: number, halfLength: number, radius: number): BodySegmentSchema => {
  const arm = id.includes('Arm') || id.includes('Forearm') || id.includes('Hand');
  const leg = id.includes('Thigh') || id.includes('Shin') || id.includes('Foot');
  const left = side === 'left';
  const bodyRegion = id === 'head' ? 'head' : id === 'chest' ? 'chest' : id === 'abdomen' ? 'ribs' : id === 'pelvis' ? 'pelvis'
    : arm ? left ? 'leftArm' : 'rightArm' : left ? 'leftLeg' : 'rightLeg';
  const strike = id.includes('Hand') || id.includes('Forearm') || id.includes('Foot');
  const support = id.includes('Foot');
  return {
    id, side, bodyRegion, colliderRole: support ? 'support' : strike ? 'strike' : 'body',
    massKg: definition.physics.massKg * SEGMENT_RATIOS[id], halfLength, radius,
    damageMultiplier: id === 'head' ? 1.35 : id === 'abdomen' ? 1.08 : leg ? .82 : arm ? .72 : 1,
    attackEligible: strike,
    gripAnchorEligible: arm || ['head', 'chest', 'abdomen', 'pelvis'].includes(id),
    localPosition: [x, y, 0],
  };
};

/** Stable human proportions in meters. All segment masses stay within a safe connected ratio. */
export const buildBodySchema = (definition: FighterDefinition): readonly BodySegmentSchema[] => {
  const p = definition.physics;
  const heightScale = p.standingHeightM / 1.88;
  const shoulder = p.shoulderWidthM * .54;
  const hip = p.hipWidthM * .42;
  const arm = p.armLength;
  const leg = p.legLength;
  return [
    segment(definition, 'pelvis', 'center', 1.12 * heightScale, 0, .18 * p.torsoLength, .22),
    segment(definition, 'abdomen', 'center', 1.43 * heightScale, 0, .18 * p.torsoLength, .21),
    segment(definition, 'chest', 'center', 1.72 * heightScale, 0, .21 * p.torsoLength, .27),
    segment(definition, 'head', 'center', 2.08 * heightScale, 0, .15, .18),
    segment(definition, 'leftUpperArm', 'left', 1.48 * heightScale, -shoulder, .19 * arm, .105),
    segment(definition, 'rightUpperArm', 'right', 1.48 * heightScale, shoulder, .19 * arm, .105),
    segment(definition, 'leftForearm', 'left', 1.08 * heightScale, -shoulder, .18 * arm, .11),
    segment(definition, 'rightForearm', 'right', 1.08 * heightScale, shoulder, .18 * arm, .11),
    segment(definition, 'leftHand', 'left', .78 * heightScale, -shoulder, .09, .1),
    segment(definition, 'rightHand', 'right', .78 * heightScale, shoulder, .09, .1),
    segment(definition, 'leftThigh', 'left', .83 * heightScale, -hip, .23 * leg, .13),
    segment(definition, 'rightThigh', 'right', .83 * heightScale, hip, .23 * leg, .13),
    segment(definition, 'leftShin', 'left', .4 * heightScale, -hip, .21 * leg, .105),
    segment(definition, 'rightShin', 'right', .4 * heightScale, hip, .21 * leg, .105),
    segment(definition, 'leftFoot', 'left', .1, -hip, .14, .105),
    segment(definition, 'rightFoot', 'right', .1, hip, .14, .105),
  ];
};

export const segmentSchema = (definition: FighterDefinition, id: BodySegmentId): BodySegmentSchema => {
  const found = buildBodySchema(definition).find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing body segment ${id}`);
  return found;
};
