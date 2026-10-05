import type { Vec2 } from '../types/game';
import { QUICK_STRIKE_CHAIN } from '@frwf/game-protocol';
import { WRESTLING_STYLES } from '../data/wrestlingStyles';
import type { FighterId } from '../types/game';

export type GrappleButton = 'quick' | 'heavy' | 'grapple';
export type CombatDirection = 'neutral' | 'up' | 'down' | 'left' | 'right';
export type StrikeButton = 'quick' | 'heavy';

// One shared collar-and-elbow entry range keeps rules, AI, and every control
// surface honest. Rapier still has to pull the hands onto real body anchors
// before the grapple can progress beyond reach/acquire.
// Decreased range from 2.15 to 1.65 to prevent visual teleportation and sliding.
export const GRAPPLE_ACQUISITION_RANGE = 1.65;

export const combatDirection = (direction: Vec2): CombatDirection => {
  // OPTIMIZATION: Replacing slow Math.hypot with a zero-allocation squared-magnitude comparison to avoid slow square-root extraction on a hot path.
  if ((direction.x * direction.x + direction.z * direction.z) < 0.1225) return 'neutral';
  if (Math.abs(direction.x) > Math.abs(direction.z)) return direction.x < 0 ? 'left' : 'right';
  return direction.z < 0 ? 'up' : 'down';
};

const GRAPPLE_GRID: Readonly<Record<CombatDirection, Readonly<Record<GrappleButton, string>>>> = {
  neutral: { quick: 'takedown', heavy: 'slam', grapple: 'piledriver' },
  up: { quick: 'arm_drag', heavy: 'skyhook', grapple: 'powerbomb' },
  down: { quick: 'full_nelson_slam', heavy: 'jackhammer', grapple: 'tombstone' },
  left: { quick: 'clutch', heavy: 'spinebuster', grapple: 'michi_driver' },
  right: { quick: 'side_toss', heavy: 'slam', grapple: 'suplex' },
};

const STRIKE_GRID: Readonly<Record<CombatDirection, Readonly<Record<StrikeButton, string>>>> = {
  neutral: { quick: 'jab', heavy: 'front_kick' },
  up: { quick: 'uppercut', heavy: 'high_kick' },
  down: { quick: 'headbutt', heavy: 'low_kick' },
  left: { quick: 'left_hook', heavy: 'roundhouse' },
  right: { quick: 'right_hook', heavy: 'high_kick' },
};

export const selectDirectionalGrapple = (direction: Vec2, button: GrappleButton): string => GRAPPLE_GRID[combatDirection(direction)][button];

/** A directionless first L establishes the learner-friendly default slam. A
 * second L during the secured clinch still selects the preserved piledriver. */
export const selectGrappleEntryMove = (direction: Vec2): string => {
  const directionId = combatDirection(direction);
  // The two moves players ask for most have one-step, visible workflows:
  // neutral L/B is the body slam; back/down + L/B is the piledriver. Other
  // directions retain the deeper grapple grid once those basics are learned.
  if (directionId === 'neutral') return 'slam';
  if (directionId === 'down') return 'piledriver';
  return selectDirectionalGrapple(direction, 'grapple');
};

export const selectDirectionalStrike = (direction: Vec2, button: StrikeButton, comboStep = 0, fighterId?: FighterId): string => {
  const directionId = combatDirection(direction);
  if (button === 'quick') {
    // J / quick is the close-strike family: fists in neutral/side/forward,
    // and a short-range headbutt while holding back/down.
    if (directionId === 'neutral') {
      const chain = fighterId ? WRESTLING_STYLES[fighterId].chain : QUICK_STRIKE_CHAIN;
      return chain[comboStep % chain.length] ?? 'jab';
    }
    // Keep this whitelist synchronized with the physical source colliders.
    const raw = STRIKE_GRID[directionId].quick;
    if (raw === 'jab' || raw === 'combo' || raw === 'left_hook' || raw === 'right_hook' || raw === 'high_punch' || raw === 'uppercut' || raw === 'headbutt') {
      return raw;
    }
    return 'jab';
  } else {
    // K / heavy is strictly leg kicks or stiff-arms.
    if (directionId === 'neutral') {
      return 'front_kick';
    }
    // ensure heavy button maps to leg kicks or stiff-arms (including new kicks)
    const raw = STRIKE_GRID[directionId].heavy;
    const validHeavyStrikes = new Set<string>([
      'front_kick', 'low_kick', 'high_kick', 'roundhouse', 'superkick', 'dropkick',
      'spinning_heel_kick', 'axe_kick', 'enzuigiri', 'bicycle_kick', 'side_kick',
      'calf_kick', 'overhead_kick', 'spin_side_kick', 'question_mark_kick',
      'hook_kick', 'sweep_kick', 'jumping_knee',
    ]);
    if (validHeavyStrikes.has(raw)) {
      return raw;
    }
    return 'front_kick';
  }
};
