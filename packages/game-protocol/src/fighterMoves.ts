import type { FighterId } from './types.js';

/** Deterministic, character-specific neutral strike strings shared by local and online combat. */
export const FIGHTER_STRIKE_CHAINS: Readonly<Record<FighterId, readonly string[]>> = {
  atlas: ['jab', 'high_kick', 'superkick'],
  vex: ['jab', 'spinning_heel_kick', 'enzuigiri'],
  nova: ['jab', 'overhead_kick', 'dropkick'],
  brick: ['jab', 'low_kick', 'axe_kick'],
  chad: ['jab', 'front_kick', 'bicycle_kick'],
  dale: ['jab', 'calf_kick', 'question_mark_kick'],
  thomas: ['jab', 'side_kick', 'spin_side_kick'],
  sonny: ['jab', 'hook_kick', 'roundhouse'],
  wrecking_ball: ['jab', 'sweep_kick', 'jumping_knee'],
  steve: ['jab', 'high_kick', 'superkick'],
  john: ['jab', 'front_kick', 'bicycle_kick'],
  justin: ['jab', 'overhead_kick', 'dropkick'],
  mondo: ['jab', 'spinning_heel_kick', 'enzuigiri'],
  gil: ['jab', 'side_kick', 'spin_side_kick'],
  josh: ['jab', 'low_kick', 'axe_kick'],
  chelsea: ['jab', 'hook_kick', 'roundhouse'],
  britt: ['jab', 'calf_kick', 'question_mark_kick'],
  beer_bandit_bill: ['jab', 'sweep_kick', 'jumping_knee'],
  beer_bandit_ted: ['jab', 'high_kick', 'superkick'],
};
