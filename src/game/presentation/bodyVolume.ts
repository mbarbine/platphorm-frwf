import type { FighterId } from '../types/game';
import { fighterVisual } from './fighterVisuals';

/** Shared by mesh fitting and contact capsules. Lengths and joint anchors stay fixed. */
export function bodyVolume(fighter: FighterId, bone: string): readonly [number, number] {
  const profile = fighterVisual(fighter);
  const bounded = (scale: number) => Math.min(1.4, Math.max(1.12, scale));
  if (bone === 'chest') return [bounded(1.08 + profile.chestScale * .17), bounded(1.08 + profile.chestScale * .08)];
  if (bone === 'abdomen') return [bounded(1.02 + profile.waistScale * .15), bounded(1.06 + profile.waistScale * .08)];
  if (bone === 'pelvis') return [bounded(1.04 + profile.waistScale * .14), bounded(1.1 + profile.waistScale * .08)];
  if (bone.includes('UpperArm')) return [bounded(1.1 + profile.armScale * .22), bounded(1.1 + profile.armScale * .18)];
  if (bone.includes('Forearm')) return [1.2, 1.18];
  if (bone.includes('Thigh')) return [bounded(1.06 + profile.thighScale * .19), bounded(1.08 + profile.thighScale * .1)];
  if (bone.includes('Shin')) return [1.12, 1.12];
  return [1, 1];
}
