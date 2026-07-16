import type { MoveDefinition } from '../types/game';

const active = ['idle', 'locomotion'] as const;
const allStanding = ['idle', 'locomotion', 'staggered'] as const;

export const MOVES: Readonly<Record<string, MoveDefinition>> = {
  jab: { id: 'jab', displayName: 'Circuit Jab', category: 'quick', requiredActorStates: active, minimumRange: 0, maximumRange: 1.35, staminaCost: 5, momentumGain: 7, damage: 5, anticipationDuration: .14, activeDuration: .30, recoveryDuration: .2, knockback: .55, knockdownStrength: 0, counterWindow: null, hypeValue: 3, animationKey: 'jab' },
  combo: { id: 'combo', displayName: 'Neon One-Two', category: 'quick', requiredActorStates: active, minimumRange: 0, maximumRange: 1.42, staminaCost: 8, momentumGain: 9, damage: 7, anticipationDuration: .11, activeDuration: .19, recoveryDuration: .26, knockback: .7, knockdownStrength: .08, counterWindow: null, hypeValue: 4, animationKey: 'jab' },
  high_punch: { id: 'high_punch', displayName: 'Skyline Cross', category: 'quick', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: .1, maximumRange: 1.75, staminaCost: 7, momentumGain: 9, damage: 7, anticipationDuration: .14, activeDuration: .14, recoveryDuration: .22, knockback: .75, knockdownStrength: .1, counterWindow: null, hypeValue: 5, animationKey: 'jab' },
  heavy: { id: 'heavy', displayName: 'Fault Hook', category: 'heavy', requiredActorStates: active, minimumRange: 0, maximumRange: 1.88, staminaCost: 17, momentumGain: 13, damage: 13, anticipationDuration: .26, activeDuration: .16, recoveryDuration: .38, knockback: 1.45, knockdownStrength: .42, counterWindow: [.1, .22], hypeValue: 8, animationKey: 'heavyStrike' },
  uppercut: { id: 'uppercut', displayName: 'Voltage Uppercut', category: 'heavy', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: .15, maximumRange: 1.65, staminaCost: 15, momentumGain: 15, damage: 15, anticipationDuration: .22, activeDuration: .18, recoveryDuration: .38, knockback: 1.35, knockdownStrength: .55, counterWindow: [.08, .18], hypeValue: 11, animationKey: 'heavyStrike' },
  low_kick: { id: 'low_kick', displayName: 'Circuit Low Kick', category: 'heavy', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: .25, maximumRange: 2.05, staminaCost: 8, momentumGain: 10, damage: 8, anticipationDuration: .18, activeDuration: .18, recoveryDuration: .26, knockback: .55, knockdownStrength: .24, counterWindow: null, hypeValue: 6, animationKey: 'kick' },
  high_kick: { id: 'high_kick', displayName: 'Halo High Kick', category: 'heavy', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: .35, maximumRange: 2.35, staminaCost: 16, momentumGain: 16, damage: 16, anticipationDuration: .26, activeDuration: .19, recoveryDuration: .42, knockback: 1.5, knockdownStrength: .68, counterWindow: [.09, .22], hypeValue: 13, animationKey: 'kick' },
  roundhouse: { id: 'roundhouse', displayName: 'Arc Roundhouse', category: 'heavy', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: .45, maximumRange: 2.55, staminaCost: 19, momentumGain: 18, damage: 18, anticipationDuration: .30, activeDuration: .20, recoveryDuration: .48, knockback: 1.85, knockdownStrength: .78, counterWindow: [.12, .26], hypeValue: 16, animationKey: 'kick' },
  front_kick: { id: 'front_kick', displayName: 'Piston Boot', category: 'heavy', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: .25, maximumRange: 2.18, staminaCost: 14, momentumGain: 14, damage: 14, anticipationDuration: .22, activeDuration: .20, recoveryDuration: .36, knockback: 1.7, knockdownStrength: .58, counterWindow: [.08, .18], hypeValue: 11, animationKey: 'kick' },
  ground: { id: 'ground', displayName: 'Mat Quake', category: 'ground', requiredActorStates: active, requiredTargetStates: ['downed'], minimumRange: 0, maximumRange: 2.4, staminaCost: 10, momentumGain: 8, damage: 8, anticipationDuration: .22, activeDuration: .12, recoveryDuration: .28, knockback: .2, knockdownStrength: .1, counterWindow: null, hypeValue: 5, animationKey: 'kick' },
  piledriver: { id: 'piledriver', displayName: 'Voltage Piledriver', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.22, staminaCost: 26, momentumGain: 26, damage: 28, anticipationDuration: 1.52, activeDuration: .26, recoveryDuration: .82, knockback: .38, knockdownStrength: 1, counterWindow: [.44, 1.18], hypeValue: 28, animationKey: 'slam' },
  slam: { id: 'slam', displayName: 'Voltage Slam', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.28, staminaCost: 19, momentumGain: 17, damage: 16, anticipationDuration: 1.08, activeDuration: .28, recoveryDuration: .54, knockback: 1.1, knockdownStrength: 1, counterWindow: [.24, .82], hypeValue: 11, animationKey: 'slam' },
  suplex: { id: 'suplex', displayName: 'Arc Suplex', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.55, staminaCost: 22, momentumGain: 19, damage: 18, anticipationDuration: 1.12, activeDuration: .22, recoveryDuration: .78, knockback: 1.8, knockdownStrength: 1, counterWindow: [.3, .86], hypeValue: 14, animationKey: 'throw' },
  takedown: { id: 'takedown', displayName: 'Circuit Trip', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.6, staminaCost: 13, momentumGain: 14, damage: 11, anticipationDuration: .78, activeDuration: .18, recoveryDuration: .52, knockback: .7, knockdownStrength: .9, counterWindow: [.2, .6], hypeValue: 8, animationKey: 'grappleEntry' },
  whip: { id: 'whip', displayName: 'Livewire Whip', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.65, staminaCost: 15, momentumGain: 13, damage: 5, anticipationDuration: .82, activeDuration: .16, recoveryDuration: .46, knockback: 4.6, knockdownStrength: .15, counterWindow: [.22, .63], hypeValue: 10, animationKey: 'throw' },
  arm_drag: { id: 'arm_drag', displayName: 'Prism Arm Drag', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.6, staminaCost: 11, momentumGain: 12, damage: 9, anticipationDuration: .74, activeDuration: .18, recoveryDuration: .48, knockback: 1.2, knockdownStrength: .82, counterWindow: [.18, .56], hypeValue: 8, animationKey: 'throw' },
  skyhook: { id: 'skyhook', displayName: 'Skyhook Suplex', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.55, staminaCost: 24, momentumGain: 21, damage: 20, anticipationDuration: 1.24, activeDuration: .24, recoveryDuration: .82, knockback: 2, knockdownStrength: 1, counterWindow: [.34, .94], hypeValue: 16, animationKey: 'lift' },
  powerbomb: { id: 'powerbomb', displayName: 'Dome Powerbomb', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.5, staminaCost: 27, momentumGain: 24, damage: 23, anticipationDuration: 1.38, activeDuration: .24, recoveryDuration: .9, knockback: .9, knockdownStrength: 1, counterWindow: [.38, 1.04], hypeValue: 20, animationKey: 'slam' },
  clutch: { id: 'clutch', displayName: 'Claw Choke', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.55, staminaCost: 14, momentumGain: 15, damage: 12, anticipationDuration: 1.15, activeDuration: .24, recoveryDuration: .58, knockback: .5, knockdownStrength: .75, counterWindow: [.3, .88], hypeValue: 13, animationKey: 'grappleEntry' },
  spinebuster: { id: 'spinebuster', displayName: 'Gridline Spinebuster', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.55, staminaCost: 21, momentumGain: 19, damage: 18, anticipationDuration: 1.08, activeDuration: .22, recoveryDuration: .76, knockback: 1, knockdownStrength: 1, counterWindow: [.28, .82], hypeValue: 15, animationKey: 'slam' },
  side_toss: { id: 'side_toss', displayName: 'Sidewinder Toss', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.6, staminaCost: 16, momentumGain: 16, damage: 14, anticipationDuration: .86, activeDuration: .19, recoveryDuration: .58, knockback: 2.25, knockdownStrength: .92, counterWindow: [.22, .66], hypeValue: 12, animationKey: 'throw' },
  mountain_drop: { id: 'mountain_drop', displayName: 'Mountain Drop', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.5, staminaCost: 25, momentumGain: 22, damage: 21, anticipationDuration: 1.3, activeDuration: .24, recoveryDuration: .86, knockback: 1.35, knockdownStrength: 1, counterWindow: [.35, .98], hypeValue: 18, animationKey: 'lift' },
  corner_smash: { id: 'corner_smash', displayName: 'Turnbuckle Rail Shot', category: 'grapple', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: 0, maximumRange: 1.6, staminaCost: 18, momentumGain: 20, damage: 18, anticipationDuration: 1.05, activeDuration: .2, recoveryDuration: .72, knockback: 1.3, knockdownStrength: .9, counterWindow: [.26, .78], hypeValue: 19, animationKey: 'throw' },
  rebound: { id: 'rebound', displayName: 'Left-Line Stiff-Arm', category: 'heavy', requiredActorStates: active, minimumRange: 0, maximumRange: 2.15, staminaCost: 8, momentumGain: 15, damage: 15, anticipationDuration: .08, activeDuration: .16, recoveryDuration: .42, knockback: 1.9, knockdownStrength: .65, counterWindow: [.02, .12], hypeValue: 13, animationKey: 'kick' },
  stiff_arm: { id: 'stiff_arm', displayName: 'Railway Stiff-Arm', category: 'heavy', requiredActorStates: active, minimumRange: 0, maximumRange: 2.3, staminaCost: 13, momentumGain: 17, damage: 17, anticipationDuration: .08, activeDuration: .18, recoveryDuration: .44, knockback: 2.1, knockdownStrength: .72, counterWindow: [.02, .07], hypeValue: 15, animationKey: 'jab' },
  spear: { id: 'spear', displayName: 'Circuit Breaker Spear', category: 'heavy', requiredActorStates: active, requiredTargetStates: allStanding, minimumRange: .35, maximumRange: 2.35, staminaCost: 18, momentumGain: 20, damage: 19, anticipationDuration: .2, activeDuration: .2, recoveryDuration: .62, knockback: 2.35, knockdownStrength: .9, counterWindow: [.06, .17], hypeValue: 19, animationKey: 'run' },
  aerial: { id: 'aerial', displayName: 'Domefall Dive', category: 'aerial', requiredActorStates: [...active, 'climbing'], requiredTargetStates: ['idle', 'locomotion', 'blocking', 'staggered', 'downed'], minimumRange: .7, maximumRange: 7.5, staminaCost: 24, momentumGain: 21, damage: 21, anticipationDuration: .44, activeDuration: .56, recoveryDuration: .78, knockback: 1.55, knockdownStrength: 1, counterWindow: [.16, .38], hypeValue: 24, animationKey: 'aerial' },
  aerial_elbow: { id: 'aerial_elbow', displayName: 'Neon Drop Elbow', category: 'aerial', requiredActorStates: ['climbing'], requiredTargetStates: ['idle', 'locomotion', 'blocking', 'staggered', 'downed'], minimumRange: .7, maximumRange: 7.5, staminaCost: 19, momentumGain: 19, damage: 19, anticipationDuration: .48, activeDuration: .26, recoveryDuration: .72, knockback: 1.35, knockdownStrength: .92, counterWindow: [.17, .38], hypeValue: 21, animationKey: 'aerial' },
  aerial_kick: { id: 'aerial_kick', displayName: 'Top-Rope Missile Kick', category: 'aerial', requiredActorStates: ['climbing'], requiredTargetStates: ['idle', 'locomotion', 'blocking', 'staggered', 'downed'], minimumRange: .8, maximumRange: 7.5, staminaCost: 22, momentumGain: 22, damage: 22, anticipationDuration: .55, activeDuration: .27, recoveryDuration: .8, knockback: 1.8, knockdownStrength: 1, counterWindow: [.19, .43], hypeValue: 25, animationKey: 'aerial' },
  prop: { id: 'prop', displayName: 'Hardware Check', category: 'prop', requiredActorStates: active, minimumRange: 0, maximumRange: 2.2, staminaCost: 9, momentumGain: 14, damage: 15, anticipationDuration: .32, activeDuration: .15, recoveryDuration: .42, knockback: 1.5, knockdownStrength: .55, counterWindow: [.13, .28], hypeValue: 15, animationKey: 'heavyStrike' },
  prop_throw: { id: 'prop_throw', displayName: 'Air Mail', category: 'prop', requiredActorStates: active, minimumRange: 2.1, maximumRange: 10, staminaCost: 8, momentumGain: 17, damage: 14, anticipationDuration: .08, activeDuration: .92, recoveryDuration: .22, knockback: 1.7, knockdownStrength: .62, counterWindow: [.02, .07], hypeValue: 18, animationKey: 'heavyStrike' },
  finisher: { id: 'finisher', displayName: 'Signature Finisher', category: 'finisher', requiredActorStates: active, requiredTargetStates: ['staggered', 'downed'], minimumRange: 0, maximumRange: 2.1, staminaCost: 12, momentumGain: 0, damage: 32, anticipationDuration: .78, activeDuration: .22, recoveryDuration: .85, knockback: 2.2, knockdownStrength: 1, counterWindow: [.28, .58], hypeValue: 38, animationKey: 'finisher' },
  counter: { id: 'counter', displayName: 'Flash Reversal', category: 'utility', requiredActorStates: allStanding, minimumRange: 0, maximumRange: 2.1, staminaCost: 10, momentumGain: 18, damage: 9, anticipationDuration: .04, activeDuration: .16, recoveryDuration: .28, knockback: 1.1, knockdownStrength: .28, counterWindow: null, hypeValue: 18, animationKey: 'counter' },
  kick_up: { id: 'kick_up', displayName: 'Livewire Kick-Up', category: 'utility', requiredActorStates: ['downed'], minimumRange: 0, maximumRange: 99, staminaCost: 12, momentumGain: 2, damage: 0, anticipationDuration: .18, activeDuration: .2, recoveryDuration: .34, knockback: 0, knockdownStrength: 0, counterWindow: null, hypeValue: 3, animationKey: 'recovery' },
  taunt: { id: 'taunt', displayName: 'Signature Taunt', category: 'utility', requiredActorStates: [...active, 'climbing'], minimumRange: 0, maximumRange: 99, staminaCost: 0, momentumGain: 13, damage: 0, anticipationDuration: .2, activeDuration: .45, recoveryDuration: .35, knockback: 0, knockdownStrength: 0, counterWindow: null, hypeValue: 7, animationKey: 'taunt' },
};

const UNKNOWN_MOVE_ID = 'jab';
const unknownMoveIds = new Set<string>();
const isDev = (import.meta as ImportMeta & { env?: { DEV: boolean } }).env?.DEV === true;
const safeGetMove = (id: string): MoveDefinition => {
  const move = MOVES[id];
  if (move) return move;
  if (!unknownMoveIds.has(id)) {
    unknownMoveIds.add(id);
    if (isDev) console.warn(`[moves] Unknown move id: ${id}. Falling back to ${UNKNOWN_MOVE_ID}.`);
  }
  return MOVES[UNKNOWN_MOVE_ID] ?? {
    id: UNKNOWN_MOVE_ID,
    displayName: 'Circuit Jab',
    category: 'quick',
    requiredActorStates: ['idle', 'locomotion'],
    minimumRange: 0,
    maximumRange: 1.35,
    staminaCost: 5,
    momentumGain: 7,
    damage: 5,
    anticipationDuration: 0.14,
    activeDuration: 0.30,
    recoveryDuration: 0.2,
    knockback: 0.55,
    knockdownStrength: 0,
    counterWindow: null,
    hypeValue: 3,
    animationKey: 'jab',
  };
};

export const getMove = (id: string): MoveDefinition => {
  return safeGetMove(id);
};

export const getSafeMove = (id: string | null | undefined): MoveDefinition | null => {
  if (id === null || id === undefined || id === '') return null;
  return MOVES[id] ?? null;
};

export const sanitizeMoveId = (id: string | null | undefined): string | null => {
  if (typeof id !== 'string') return null;
  return MOVES[id] ? id : null;
};
