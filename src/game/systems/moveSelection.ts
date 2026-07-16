import type { Vec2 } from '../types/game';

export type GrappleButton = 'quick' | 'heavy' | 'grapple';
export type CombatDirection = 'neutral' | 'up' | 'down' | 'left' | 'right';
export type StrikeButton = 'quick' | 'heavy';

// One shared collar-and-elbow entry range keeps rules, AI, and every control
// surface honest. Rapier still has to pull the hands onto real body anchors
// before the grapple can progress beyond reach/acquire.
// BLOCKBUSTER: Increased range from 1.65 to 2.15 for much more forgiving lockups.
export const GRAPPLE_ACQUISITION_RANGE = 2.15;

export const combatDirection = (direction: Vec2): CombatDirection => {
  if (Math.hypot(direction.x, direction.z) < .35) return 'neutral';
  if (Math.abs(direction.x) > Math.abs(direction.z)) return direction.x < 0 ? 'left' : 'right';
  return direction.z < 0 ? 'up' : 'down';
};

const GRAPPLE_GRID: Readonly<Record<CombatDirection, Readonly<Record<GrappleButton, string>>>> = {
  neutral: { quick: 'takedown', heavy: 'slam', grapple: 'piledriver' },
  up: { quick: 'arm_drag', heavy: 'skyhook', grapple: 'powerbomb' },
  down: { quick: 'takedown', heavy: 'spinebuster', grapple: 'mountain_drop' },
  left: { quick: 'clutch', heavy: 'spinebuster', grapple: 'whip' },
  right: { quick: 'side_toss', heavy: 'slam', grapple: 'suplex' },
};

const STRIKE_GRID: Readonly<Record<CombatDirection, Readonly<Record<StrikeButton, string>>>> = {
  neutral: { quick: 'jab', heavy: 'front_kick' },
  up: { quick: 'uppercut', heavy: 'high_kick' },
  down: { quick: 'jab', heavy: 'low_kick' },
  left: { quick: 'combo', heavy: 'roundhouse' },
  right: { quick: 'high_punch', heavy: 'high_kick' },
};

export const selectDirectionalGrapple = (direction: Vec2, button: GrappleButton): string => GRAPPLE_GRID[combatDirection(direction)][button];

/** A directionless first L establishes the learner-friendly default slam. A
 * second L during the secured clinch still selects the preserved piledriver. */
export const selectGrappleEntryMove = (direction: Vec2): string => combatDirection(direction) === 'neutral'
  ? 'slam'
  : selectDirectionalGrapple(direction, 'grapple');

export const selectDirectionalStrike = (direction: Vec2, button: StrikeButton, comboStep = 0): string => {
  const directionId = combatDirection(direction);
  if (button === 'quick') {
    // J / quick is strictly arm punches.
    if (directionId === 'neutral') {
      return comboStep % 2 === 0 ? 'jab' : 'combo';
    }
    // ensure quick button only maps to arm-fist actions (jab, combo, high_punch, uppercut)
    const raw = STRIKE_GRID[directionId].quick;
    if (raw === 'jab' || raw === 'combo' || raw === 'high_punch' || raw === 'uppercut') {
      return raw;
    }
    return 'jab';
  } else {
    // K / heavy is strictly leg kicks or stiff-arms.
    if (directionId === 'neutral') {
      return 'front_kick';
    }
    // ensure heavy button only maps to leg kicks or stiff-arms (front_kick, low_kick, high_kick, roundhouse)
    const raw = STRIKE_GRID[directionId].heavy;
    if (raw === 'front_kick' || raw === 'low_kick' || raw === 'high_kick' || raw === 'roundhouse') {
      return raw;
    }
    return 'front_kick';
  }
};
