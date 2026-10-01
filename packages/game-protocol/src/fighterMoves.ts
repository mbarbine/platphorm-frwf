import type { FighterId } from './types.js';

/** Deterministic, character-specific neutral strike strings shared by local and online combat. */
export const FIGHTER_STRIKE_CHAINS: Readonly<Record<FighterId, readonly string[]>> = {
  atlas: ['jab', 'right_hook', 'left_hook', 'uppercut'], vex: ['jab', 'combo', 'high_punch'], nova: ['jab', 'uppercut', 'combo'],
  brick: ['jab', 'headbutt', 'high_punch'], chad: ['jab', 'high_punch', 'headbutt'], dale: ['jab', 'uppercut', 'headbutt'],
  thomas: ['jab', 'high_punch', 'uppercut'], sonny: ['jab', 'combo', 'uppercut'], wrecking_ball: ['jab', 'headbutt', 'uppercut'],
  steve: ['jab', 'combo', 'uppercut'], john: ['jab', 'high_punch', 'headbutt'], justin: ['jab', 'uppercut', 'high_punch'],
  mondo: ['jab', 'headbutt', 'combo'], gil: ['jab', 'high_punch', 'combo'], josh: ['jab', 'combo', 'high_punch'],
  chelsea: ['jab', 'combo', 'uppercut'], britt: ['jab', 'high_punch', 'uppercut'], beer_bandit_bill: ['jab', 'combo', 'uppercut'],
  beer_bandit_ted: ['jab', 'high_punch', 'uppercut'],
};
