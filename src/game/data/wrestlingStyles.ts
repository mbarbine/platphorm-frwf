import type { FighterId } from '../types/game';
import { FIGHTER_STRIKE_CHAINS } from '@frwf/game-protocol';

export interface WrestlingStyle {
  stride: number; guard: number; armSwing: number; stance: number;
  signatureBase: string; commitment: number; turn: number;
  chain: readonly string[];
}
/** Authored gameplay choices; not measurements or claims about the real performers. */
export const WRESTLING_STYLES: Record<FighterId, WrestlingStyle> = {
  atlas: { stride: 1.08, guard: .9, armSwing: .72, stance: .055, signatureBase: 'tiger_driver', commitment: 1.18, turn: .05, chain: FIGHTER_STRIKE_CHAINS.atlas },
  vex: { stride: .9, guard: 1.12, armSwing: 1.18, stance: .018, signatureBase: 'cutter', commitment: .88, turn: .4, chain: FIGHTER_STRIKE_CHAINS.vex },
  nova: { stride: .96, guard: 1.08, armSwing: .82, stance: .035, signatureBase: 'falcon_arrow', commitment: 1.04, turn: -.18, chain: FIGHTER_STRIKE_CHAINS.nova },
  brick: { stride: .98, guard: .86, armSwing: .95, stance: .06, signatureBase: 'death_valley_driver', commitment: 1.1, turn: .16, chain: FIGHTER_STRIKE_CHAINS.brick },
  chad: { stride: 1, guard: .88, armSwing: 1.04, stance: .048, signatureBase: 'skyhook', commitment: 1.12, turn: -.12, chain: FIGHTER_STRIKE_CHAINS.chad },
  dale: { stride: 1.06, guard: .93, armSwing: .78, stance: .052, signatureBase: 'exploder_suplex', commitment: 1.24, turn: .08, chain: FIGHTER_STRIKE_CHAINS.dale },
  thomas: { stride: 1.12, guard: .98, armSwing: .86, stance: .046, signatureBase: 'spinebuster', commitment: 1.16, turn: 0, chain: FIGHTER_STRIKE_CHAINS.thomas },
  sonny: { stride: .88, guard: 1.16, armSwing: 1.12, stance: .02, signatureBase: 'olympic_slam', commitment: .84, turn: -.38, chain: FIGHTER_STRIKE_CHAINS.sonny },
  wrecking_ball: { stride: .82, guard: .8, armSwing: .6, stance: .085, signatureBase: 'mountain_drop', commitment: 1.32, turn: .02, chain: FIGHTER_STRIKE_CHAINS.wrecking_ball },
  steve: { stride: .94, guard: 1.2, armSwing: .76, stance: .029, signatureBase: 'piledriver', commitment: 1.02, turn: -.08, chain: FIGHTER_STRIKE_CHAINS.steve },
  john: { stride: 1.04, guard: .87, armSwing: 1.08, stance: .057, signatureBase: 'powerbomb', commitment: 1.08, turn: -.22, chain: FIGHTER_STRIKE_CHAINS.john },
  justin: { stride: .95, guard: 1.06, armSwing: .88, stance: .033, signatureBase: 'michi_driver', commitment: 1.13, turn: .24, chain: FIGHTER_STRIKE_CHAINS.justin },
  mondo: { stride: .92, guard: .82, armSwing: 1.15, stance: .071, signatureBase: 'brainbuster', commitment: 1.2, turn: -.3, chain: FIGHTER_STRIKE_CHAINS.mondo },
  gil: { stride: .86, guard: 1.14, armSwing: .94, stance: .024, signatureBase: 'german_suplex', commitment: .9, turn: .32, chain: FIGHTER_STRIKE_CHAINS.gil },
  josh: { stride: .97, guard: 1.1, armSwing: .92, stance: .038, signatureBase: 'running_powerslam', commitment: .98, turn: -.14, chain: FIGHTER_STRIKE_CHAINS.josh },
  chelsea: { stride: 0.91, guard: 1.02, armSwing: 0.81, stance: 0.026, signatureBase: 'chokeslam', commitment: 0.95, turn: -0.27, chain: FIGHTER_STRIKE_CHAINS.chelsea },
  britt: { stride: 1.03, guard: 1.06, armSwing: 0.8700000000000001, stance: 0.031, signatureBase: 'full_nelson_slam', commitment: 1.02, turn: -0.1, chain: FIGHTER_STRIKE_CHAINS.britt },
  beer_bandit_bill: { stride: 0.93, guard: 1.1, armSwing: 0.93, stance: 0.036, signatureBase: 'jackhammer', commitment: 1.0899999999999999, turn: 0.07, chain: FIGHTER_STRIKE_CHAINS.beer_bandit_bill },
  beer_bandit_ted: { stride: 1.07, guard: 1.1400000000000001, armSwing: 0.99, stance: 0.040999999999999995, signatureBase: 'tombstone', commitment: 1.16, turn: 0.24, chain: FIGHTER_STRIKE_CHAINS.beer_bandit_ted },
};
export const signatureMoveId = (id: FighterId) => `signature_${id}`;
