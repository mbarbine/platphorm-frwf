import type { FighterId } from '../types/game';

export type AttireStyle = 'conqueror' | 'striker' | 'technician' | 'brawler' | 'roughneck';
export type HairStyle = 'crownFade' | 'voltHawk' | 'fangMask' | 'bandana' | 'mullet';

export interface FighterVisualProfile {
  attire: AttireStyle;
  hair: HairStyle;
  chestScale: number;
  waistScale: number;
  shoulderScale: number;
  armScale: number;
  thighScale: number;
  calfScale: number;
  bootScale: number;
  headScale: readonly [number, number, number];
  stanceWidth: number;
  motionTempo: number;
  stepWeight: number;
  guardHeight: number;
  fatigueDroop: number;
  skinRoughness: number;
  gearMetalness: number;
  hairColor: string;
  browColor: string;
  eyeColor: string;
  soleColor: string;
}

export const FIGHTER_VISUALS: Readonly<Record<FighterId, FighterVisualProfile>> = {
  atlas: {
    attire: 'conqueror', hair: 'crownFade', chestScale: 1.22, waistScale: 1.08, shoulderScale: 1.22, armScale: 1.18, thighScale: 1.2, calfScale: 1.14, bootScale: 1.18,
    headScale: [1.06, 1.02, 1], stanceWidth: 1.16, motionTempo: .82, stepWeight: 1.2, guardHeight: .94, fatigueDroop: .5, skinRoughness: .58, gearMetalness: .46,
    hairColor: '#20151c', browColor: '#28151a', eyeColor: '#ffd36b', soleColor: '#e0a52e',
  },
  vex: {
    attire: 'striker', hair: 'voltHawk', chestScale: .92, waistScale: .84, shoulderScale: .94, armScale: .92, thighScale: .88, calfScale: .86, bootScale: .92,
    headScale: [.96, 1.04, .94], stanceWidth: .9, motionTempo: 1.26, stepWeight: .72, guardHeight: 1.08, fatigueDroop: .34, skinRoughness: .44, gearMetalness: .34,
    hairColor: '#102a37', browColor: '#152733', eyeColor: '#baffff', soleColor: '#d7ff38',
  },
  nova: {
    attire: 'technician', hair: 'fangMask', chestScale: 1, waistScale: .9, shoulderScale: 1, armScale: .98, thighScale: .96, calfScale: .94, bootScale: .96,
    headScale: [.98, 1.02, .96], stanceWidth: .94, motionTempo: 1.02, stepWeight: .88, guardHeight: 1.02, fatigueDroop: .28, skinRoughness: .48, gearMetalness: .26,
    hairColor: '#281b45', browColor: '#301d4c', eyeColor: '#ffb4e3', soleColor: '#b77bff',
  },
  brick: {
    attire: 'brawler', hair: 'bandana', chestScale: 1.1, waistScale: 1.02, shoulderScale: 1.1, armScale: 1.12, thighScale: 1.05, calfScale: 1.08, bootScale: 1.06,
    headScale: [1.04, .98, 1.02], stanceWidth: 1.06, motionTempo: .96, stepWeight: 1.04, guardHeight: .96, fatigueDroop: .44, skinRoughness: .62, gearMetalness: .38,
    hairColor: '#16151d', browColor: '#17131a', eyeColor: '#7ee2ff', soleColor: '#41b8ff',
  },
  chad: {
    attire: 'roughneck', hair: 'mullet', chestScale: 1.13, waistScale: 1.07, shoulderScale: 1.14, armScale: 1.16, thighScale: 1.08, calfScale: 1.08, bootScale: 1.14,
    headScale: [1.05, 1.01, 1.03], stanceWidth: 1.09, motionTempo: .9, stepWeight: 1.1, guardHeight: .9, fatigueDroop: .78, skinRoughness: .66, gearMetalness: .22,
    hairColor: '#352018', browColor: '#3c241a', eyeColor: '#f6c26b', soleColor: '#d38b37',
  },
};

export const fighterVisual = (id: FighterId): FighterVisualProfile => FIGHTER_VISUALS[id];
