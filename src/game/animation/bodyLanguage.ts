import type { FighterRuntime } from '../types/game';
import { clamp } from '../utils/math';
import { mixPose } from './choreography';
import type { Pose } from './poses';

export interface BodyLanguageWeights {
  hurt: number;
  exhausted: number;
  dominant: number;
}

export const bodyLanguageWeights = (fighter: FighterRuntime): BodyLanguageWeights => {
  const healthRatio = fighter.health / 100;
  const staminaRatio = fighter.stamina / Math.max(1, fighter.staminaCap);
  const hurt = clamp((.58 - healthRatio) / .48, 0, 1);
  const exhausted = clamp((.42 - staminaRatio) / .36, 0, 1);
  const distress = Math.max(hurt, exhausted * .9);
  const dominant = clamp((fighter.momentum - 58) / 42, 0, 1) * (1 - distress);
  return { hurt, exhausted, dominant };
};

export const applyBodyLanguage = (base: Pose, fighter: FighterRuntime): Pose => {
  const weights = bodyLanguageWeights(fighter);
  const dominant: Pose = {
    ...base,
    torso: [base.torso[0] - .14, base.torso[1], base.torso[2]],
    leftArm: [-.68, -.08, -.38], rightArm: [-.72, .08, .38],
    leftForearm: [-.88, 0, -.12], rightForearm: [-.92, 0, .12],
    rootTilt: base.rootTilt - .08, rootY: base.rootY + .035,
  };
  const hurt: Pose = {
    ...base,
    torso: [base.torso[0] + .34, base.torso[1] - .08, base.torso[2] + .11],
    leftArm: [-1.02, -.18, -.42], rightArm: [-.42, .08, .34],
    leftForearm: [-1.34, 0, -.18], rightForearm: [-.72, 0, .12],
    leftLeg: [base.leftLeg[0] + .24, base.leftLeg[1], base.leftLeg[2]],
    rightLeg: [base.rightLeg[0] + .12, base.rightLeg[1], base.rightLeg[2]],
    leftShin: [base.leftShin[0] - .48, base.leftShin[1], base.leftShin[2]],
    rootTilt: base.rootTilt + .2, rootRoll: base.rootRoll + .08, rootY: base.rootY - .06,
  };
  const exhausted: Pose = {
    ...base,
    torso: [base.torso[0] + .52, base.torso[1], base.torso[2]],
    leftArm: [-.28, -.12, -.5], rightArm: [-.28, .12, .5],
    leftForearm: [-1.5, 0, -.08], rightForearm: [-1.5, 0, .08],
    leftLeg: [base.leftLeg[0] + .42, base.leftLeg[1], base.leftLeg[2]],
    rightLeg: [base.rightLeg[0] + .42, base.rightLeg[1], base.rightLeg[2]],
    leftShin: [base.leftShin[0] - .84, base.leftShin[1], base.leftShin[2]],
    rightShin: [base.rightShin[0] - .84, base.rightShin[1], base.rightShin[2]],
    rootTilt: base.rootTilt + .32, rootY: base.rootY - .12,
  };
  const confident = mixPose(base, dominant, weights.dominant);
  const injured = mixPose(confident, hurt, weights.hurt);
  return mixPose(injured, exhausted, weights.exhausted);
};
