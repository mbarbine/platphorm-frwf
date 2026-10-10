import type { FighterId } from './types.js';

/** Deterministic, character-specific neutral strike strings shared by local and online combat. */
export const FIGHTER_STRIKE_CHAINS: Readonly<Record<FighterId, readonly string[]>> = {
  atlas: ['jab', 'right_hook', 'high_kick', 'superkick'],
  vex: ['jab', 'left_hook', 'spinning_heel_kick', 'enzuigiri'],
  nova: ['jab', 'combo', 'overhead_kick', 'dropkick'],
  brick: ['jab', 'right_hook', 'low_kick', 'axe_kick'],
  chad: ['jab', 'left_hook', 'front_kick', 'bicycle_kick'],
  dale: ['jab', 'right_hook', 'calf_kick', 'question_mark_kick'],
  thomas: ['jab', 'left_hook', 'side_kick', 'spin_side_kick'],
  sonny: ['jab', 'combo', 'hook_kick', 'roundhouse'],
  wrecking_ball: ['jab', 'right_hook', 'sweep_kick', 'jumping_knee'],
  steve: ['jab', 'left_hook', 'high_kick', 'superkick'],
  john: ['jab', 'combo', 'front_kick', 'bicycle_kick'],
  justin: ['jab', 'right_hook', 'overhead_kick', 'dropkick'],
  mondo: ['jab', 'left_hook', 'spinning_heel_kick', 'enzuigiri'],
  gil: ['jab', 'combo', 'side_kick', 'spin_side_kick'],
  josh: ['jab', 'right_hook', 'low_kick', 'axe_kick'],
  chelsea: ['jab', 'left_hook', 'hook_kick', 'roundhouse'],
  britt: ['jab', 'combo', 'calf_kick', 'question_mark_kick'],
  beer_bandit_bill: ['jab', 'right_hook', 'sweep_kick', 'jumping_knee'],
  beer_bandit_ted: ['jab', 'left_hook', 'high_kick', 'superkick'],
};
