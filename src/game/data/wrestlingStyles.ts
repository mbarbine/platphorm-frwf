import type { FighterId } from '../types/game';

export interface WrestlingStyle {
  stride: number; guard: number; armSwing: number; stance: number;
  signatureBase: string; commitment: number; turn: number;
  chain: readonly string[];
}
/** Authored gameplay choices; not measurements or claims about the real performers. */
export const WRESTLING_STYLES: Record<FighterId, WrestlingStyle> = {
  atlas: { stride: 1.08, guard: .9, armSwing: .72, stance: .055, signatureBase: 'powerbomb', commitment: 1.18, turn: .05, chain: ['jab', 'high_punch', 'uppercut'] },
  vex: { stride: .9, guard: 1.12, armSwing: 1.18, stance: .018, signatureBase: 'side_toss', commitment: .88, turn: .4, chain: ['jab', 'combo', 'high_punch'] },
  nova: { stride: .96, guard: 1.08, armSwing: .82, stance: .035, signatureBase: 'suplex', commitment: 1.04, turn: -.18, chain: ['jab', 'uppercut', 'combo'] },
  brick: { stride: .98, guard: .86, armSwing: .95, stance: .06, signatureBase: 'slam', commitment: 1.1, turn: .16, chain: ['jab', 'headbutt', 'high_punch'] },
  chad: { stride: 1, guard: .88, armSwing: 1.04, stance: .048, signatureBase: 'skyhook', commitment: 1.12, turn: -.12, chain: ['jab', 'high_punch', 'headbutt'] },
  dale: { stride: 1.06, guard: .93, armSwing: .78, stance: .052, signatureBase: 'clutch', commitment: 1.24, turn: .08, chain: ['jab', 'uppercut', 'headbutt'] },
  thomas: { stride: 1.12, guard: .98, armSwing: .86, stance: .046, signatureBase: 'spinebuster', commitment: 1.16, turn: 0, chain: ['jab', 'high_punch', 'uppercut'] },
  sonny: { stride: .88, guard: 1.16, armSwing: 1.12, stance: .02, signatureBase: 'arm_drag', commitment: .84, turn: -.38, chain: ['jab', 'combo', 'uppercut'] },
  wrecking_ball: { stride: .82, guard: .8, armSwing: .6, stance: .085, signatureBase: 'mountain_drop', commitment: 1.32, turn: .02, chain: ['jab', 'headbutt', 'uppercut'] },
  steve: { stride: .94, guard: 1.2, armSwing: .76, stance: .029, signatureBase: 'piledriver', commitment: 1.02, turn: -.08, chain: ['jab', 'combo', 'uppercut'] },
  john: { stride: 1.04, guard: .87, armSwing: 1.08, stance: .057, signatureBase: 'powerbomb', commitment: 1.08, turn: -.22, chain: ['jab', 'high_punch', 'headbutt'] },
  justin: { stride: .95, guard: 1.06, armSwing: .88, stance: .033, signatureBase: 'suplex', commitment: 1.13, turn: .24, chain: ['jab', 'uppercut', 'high_punch'] },
  mondo: { stride: .92, guard: .82, armSwing: 1.15, stance: .071, signatureBase: 'side_toss', commitment: 1.2, turn: -.3, chain: ['jab', 'headbutt', 'combo'] },
  gil: { stride: .86, guard: 1.14, armSwing: .94, stance: .024, signatureBase: 'takedown', commitment: .9, turn: .32, chain: ['jab', 'high_punch', 'combo'] },
  josh: { stride: .97, guard: 1.1, armSwing: .92, stance: .038, signatureBase: 'spinebuster', commitment: .98, turn: -.14, chain: ['jab', 'combo', 'high_punch'] },
  chelsea: { stride: 0.91, guard: 1.02, armSwing: 0.81, stance: 0.026, signatureBase: 'arm_drag', commitment: 0.95, turn: -0.27, chain: ['jab', 'combo', 'uppercut'] },
  britt: { stride: 1.03, guard: 1.06, armSwing: 0.8700000000000001, stance: 0.031, signatureBase: 'side_toss', commitment: 1.02, turn: -0.1, chain: ['jab', 'high_punch', 'uppercut'] },
  beer_bandit_bill: { stride: 0.93, guard: 1.1, armSwing: 0.93, stance: 0.036, signatureBase: 'takedown', commitment: 1.0899999999999999, turn: 0.07, chain: ['jab', 'combo', 'uppercut'] },
  beer_bandit_ted: { stride: 1.07, guard: 1.1400000000000001, armSwing: 0.99, stance: 0.040999999999999995, signatureBase: 'piledriver', commitment: 1.16, turn: 0.24, chain: ['jab', 'high_punch', 'uppercut'] },
};
export const signatureMoveId = (id: FighterId) => `signature_${id}`;
