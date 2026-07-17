import type { FighterRuntime } from '../types/game';
import { clamp } from '../utils/math';

const DECK_BOUND_STATES = new Set<FighterRuntime['state']>([
  'airborne',
  'downed',
  'recovering',
  'pinned',
  'defeated',
]);

/**
 * The authored fall/recovery pose already places the wrestler on the deck.
 * Applying the standing-balance pelvis compression a second time makes the
 * visual shell sink through the mat even after Rapier has corrected its body.
 */
export const visiblePelvisDrop = (fighter: FighterRuntime | null | undefined): number => {
  if (!fighter || DECK_BOUND_STATES.has(fighter.state)) return 0;
  return clamp(Number.isFinite(fighter.body.pelvisDrop) ? fighter.body.pelvisDrop : 0, 0, .22);
};

