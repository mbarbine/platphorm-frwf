import type { BodySegmentId } from './bodySchema';
import type { FighterRuntime } from '../types/game';
import { clamp } from '../utils/math';

export type MotorChain = 'core' | 'head' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'hands' | 'feet';
export type MotorProfileId =
  | 'neutral' | 'combat' | 'walking' | 'running' | 'braking' | 'jumpLoad' | 'airborne' | 'landing'
  | 'blocking' | 'quickStrike' | 'heavyStrike' | 'kick' | 'grappleReach' | 'clinch' | 'lift' | 'throw'
  | 'localReaction' | 'stagger' | 'protectedFall' | 'downed' | 'getUp' | 'knockout' | 'victory';

export interface MotorChainTuning { stiffness: number; damping: number; maximumTorque: number; strength: number }
export interface MotorProfile {
  id: MotorProfileId;
  rootMode: 'planted' | 'balanced' | 'physical';
  chains: Readonly<Record<MotorChain, MotorChainTuning>>;
}

const chain = (stiffness: number, damping: number, maximumTorque: number, strength = 1): MotorChainTuning => ({ stiffness, damping, maximumTorque, strength });
const profile = (id: MotorProfileId, rootMode: MotorProfile['rootMode'], multiplier: number, overrides: Partial<Record<MotorChain, Partial<MotorChainTuning>>> = {}): MotorProfile => {
  const base: Record<MotorChain, MotorChainTuning> = {
    core: chain(255, 44, 275), head: chain(120, 20, 88),
    leftArm: chain(132, 24, 126), rightArm: chain(132, 24, 126),
    leftLeg: chain(170, 31, 168), rightLeg: chain(170, 31, 168),
    hands: chain(68, 12, 44), feet: chain(92, 18, 74),
  };
  for (const name of Object.keys(base) as MotorChain[]) {
    const current = base[name]; const override = overrides[name];
    base[name] = {
      stiffness: (override?.stiffness ?? current.stiffness) * multiplier,
      damping: (override?.damping ?? current.damping) * multiplier,
      maximumTorque: (override?.maximumTorque ?? current.maximumTorque) * multiplier,
      strength: override?.strength ?? current.strength,
    };
  }
  return { id, rootMode, chains: base };
};

export const MOTOR_PROFILES: Readonly<Record<MotorProfileId, MotorProfile>> = {
  neutral: profile('neutral', 'planted', .82),
  combat: profile('combat', 'planted', 1),
  walking: profile('walking', 'balanced', .92, { feet: { strength: 1.12 }, core: { strength: .94 } }),
  running: profile('running', 'balanced', 1.05, { feet: { strength: 1.18 }, core: { strength: 1.08 } }),
  braking: profile('braking', 'balanced', 1.08, { feet: { strength: 1.24 }, core: { strength: 1.12 } }),
  jumpLoad: profile('jumpLoad', 'balanced', 1.08, { leftLeg: { strength: 1.2 }, rightLeg: { strength: 1.2 } }),
  airborne: profile('airborne', 'physical', .42, { core: { strength: .62 }, head: { strength: .7 }, feet: { strength: .38 } }),
  landing: profile('landing', 'balanced', .72, { leftLeg: { strength: 1.18 }, rightLeg: { strength: 1.18 }, core: { strength: .78 } }),
  blocking: profile('blocking', 'planted', 1.12, { leftArm: { strength: 1.22 }, rightArm: { strength: 1.22 }, core: { strength: 1.08 } }),
  quickStrike: profile('quickStrike', 'balanced', 1, { rightArm: { strength: 1.2 }, leftArm: { strength: .86 }, core: { strength: .92 } }),
  heavyStrike: profile('heavyStrike', 'balanced', 1.08, { rightArm: { strength: 1.25 }, core: { strength: 1.12 }, leftLeg: { strength: 1.08 }, rightLeg: { strength: 1.08 } }),
  kick: profile('kick', 'balanced', 1.02, { rightLeg: { strength: 1.22 }, leftLeg: { strength: 1.28 }, core: { strength: 1.08 } }),
  grappleReach: profile('grappleReach', 'balanced', .9, { leftArm: { strength: 1.12 }, rightArm: { strength: 1.12 }, hands: { strength: 1.18 } }),
  clinch: profile('clinch', 'balanced', 1.05, { hands: { strength: 1.32 }, core: { strength: 1.16 }, feet: { strength: 1.12 } }),
  lift: profile('lift', 'balanced', 1.14, { core: { strength: 1.26 }, leftLeg: { strength: 1.25 }, rightLeg: { strength: 1.25 }, hands: { strength: 1.32 } }),
  throw: profile('throw', 'balanced', .88, { hands: { strength: .82 }, core: { strength: 1.1 } }),
  localReaction: profile('localReaction', 'balanced', .7),
  stagger: profile('stagger', 'physical', .5, { feet: { strength: .74 }, core: { strength: .52 } }),
  protectedFall: profile('protectedFall', 'physical', .22, { head: { strength: .72 }, core: { strength: .3 }, hands: { strength: .42 } }),
  downed: profile('downed', 'physical', .12, { head: { strength: .55 } }),
  getUp: profile('getUp', 'physical', .62, { core: { strength: 1.16 }, hands: { strength: 1.12 }, feet: { strength: 1.12 } }),
  knockout: profile('knockout', 'physical', .035, { head: { strength: .2 } }),
  victory: profile('victory', 'planted', .82),
};

export const motorChainForSegment = (segment: BodySegmentId): MotorChain => {
  if (segment === 'pelvis' || segment === 'abdomen' || segment === 'chest') return 'core';
  if (segment === 'head') return 'head';
  if (segment.includes('Hand')) return 'hands';
  if (segment.includes('Foot')) return 'feet';
  if (segment.startsWith('left') && (segment.includes('Arm') || segment.includes('Forearm'))) return 'leftArm';
  if (segment.startsWith('right') && (segment.includes('Arm') || segment.includes('Forearm'))) return 'rightArm';
  return segment.startsWith('left') ? 'leftLeg' : 'rightLeg';
};

export const selectMotorProfile = (fighter: FighterRuntime): MotorProfile => {
  if (fighter.state === 'defeated') return MOTOR_PROFILES.knockout;
  if (fighter.state === 'downed') return MOTOR_PROFILES.downed;
  if (fighter.state === 'recovering') return MOTOR_PROFILES.getUp;
  if (fighter.state === 'airborne') return MOTOR_PROFILES.protectedFall;
  if (fighter.state === 'staggered' || fighter.state === 'grabbed') return MOTOR_PROFILES.stagger;
  if (fighter.state === 'blocking') return MOTOR_PROFILES.blocking;
  if (fighter.state === 'jumping') return MOTOR_PROFILES.airborne;
  if (fighter.state === 'victorious') return MOTOR_PROFILES.victory;
  if (fighter.state === 'locomotion') return Math.hypot(fighter.velocity.x, fighter.velocity.z) > 3.75 ? MOTOR_PROFILES.running : MOTOR_PROFILES.walking;
  if (fighter.moveId) {
    if (fighter.attackPhase === 'recovery') return MOTOR_PROFILES.neutral;
    if (['slam', 'suplex', 'powerbomb', 'spinebuster', 'mountain_drop', 'skyhook', 'finisher'].includes(fighter.moveId)) return fighter.attackPhase === 'active' ? MOTOR_PROFILES.throw : MOTOR_PROFILES.lift;
    if (['whip', 'arm_drag', 'takedown', 'clutch', 'side_toss', 'corner_smash'].includes(fighter.moveId)) return MOTOR_PROFILES.clinch;
    if (fighter.moveId.includes('kick') || fighter.moveId === 'roundhouse' || fighter.moveId === 'aerial') return MOTOR_PROFILES.kick;
    if (fighter.moveId === 'heavy' || fighter.moveId === 'uppercut' || fighter.moveId === 'stiff_arm' || fighter.moveId === 'rebound') return MOTOR_PROFILES.heavyStrike;
    if (fighter.state === 'grappling') return MOTOR_PROFILES.grappleReach;
    return MOTOR_PROFILES.quickStrike;
  }
  return MOTOR_PROFILES.combat;
};

export const motorStrengthFor = (fighter: FighterRuntime, profile: MotorProfile, segment: BodySegmentId): number => {
  const staminaRatio = clamp(fighter.stamina / Math.max(1, fighter.staminaCap), 0, 1);
  const fatigueMultiplier = .36 + Math.pow(staminaRatio, .72) * .64;
  const muscleMultiplier = .42 + fighter.body.muscle * .58;
  return clamp(profile.chains[motorChainForSegment(segment)].strength * fatigueMultiplier * muscleMultiplier, 0, 1.35);
};
