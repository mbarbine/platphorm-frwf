import type { Vec2 } from '../types/game';

export type GrappleButton = 'quick' | 'heavy' | 'grapple';
export type CombatDirection = 'neutral' | 'up' | 'down' | 'left' | 'right';
export type StrikeButton = 'quick' | 'heavy';

// One shared collar-and-elbow entry range keeps rules, AI, and every control
// surface honest. Rapier still has to pull the hands onto real body anchors
// before the grapple can progress beyond reach/acquire.
export const GRAPPLE_ACQUISITION_RANGE = 1.65;

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
  up: { quick: 'high_punch', heavy: 'uppercut' },
  down: { quick: 'low_kick', heavy: 'front_kick' },
  left: { quick: 'combo', heavy: 'roundhouse' },
  right: { quick: 'high_punch', heavy: 'high_kick' },
};

export const selectDirectionalGrapple = (direction: Vec2, button: GrappleButton): string => GRAPPLE_GRID[combatDirection(direction)][button];

export const selectDirectionalStrike = (direction: Vec2, button: StrikeButton, comboStep = 0): string => {
  const directionId = combatDirection(direction);
  if (directionId === 'neutral' && button === 'quick') {
    // Directionless J remains an arm-strike chain. K owns the visible kick promise.
    return comboStep % 2 === 0 ? 'jab' : 'combo';
  }
  return STRIKE_GRID[directionId][button];
};
