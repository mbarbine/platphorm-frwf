// ──────────────────────────────────────────────────────────────────────────────
// Shared game types — no React, Three.js, Rapier, or DOM dependencies.
// Both the browser bundle and the Node.js game server import from here.
// ──────────────────────────────────────────────────────────────────────────────

export type FighterId = 'atlas' | 'vex' | 'nova' | 'brick' | 'chad';
export type Ruleset = 'standard' | 'chaos';
export type Difficulty = 'normal' | 'hard';
export type PlayerRole = 'player1' | 'player2' | 'spectator';

export type FighterState =
  | 'idle' | 'locomotion' | 'jumping' | 'attacking' | 'grappling' | 'grabbed' | 'airborne'
  | 'blocking' | 'climbing' | 'staggered' | 'downed' | 'recovering' | 'pinning' | 'pinned'
  | 'victorious' | 'defeated';

export type AttackPhase = 'anticipation' | 'active' | 'recovery' | null;
export type MoveCategory = 'quick' | 'heavy' | 'grapple' | 'ground' | 'aerial' | 'prop' | 'finisher' | 'utility';
export type GameCommand = 'quick' | 'heavy' | 'grapple' | 'block' | 'dodge' | 'jump' | 'interact' | 'context' | 'taunt';
export type RoomPhase = 'lobby' | 'selection' | 'countdown' | 'active' | 'result';
export type MatchEndMethod = 'PINFALL' | 'KNOCKOUT' | 'TIMEOUT';

export interface Vec2 { x: number; z: number }

/** Compact fighter snapshot sent from server to clients at each state patch. */
export interface FighterSnapshot {
  sessionId: string;
  fighterId: FighterId;
  health: number;
  stamina: number;
  momentum: number;
  posX: number;
  posZ: number;
  facing: number;
  velocityX: number;
  velocityZ: number;
  combatState: FighterState;
  moveId: string;
  attackPhase: AttackPhase;
  pinCount: number;
  finisherPrimed: boolean;
}

/** Compact match snapshot broadcast by the server. */
export interface MatchSnapshot {
  type: 'snapshot';
  seq: number;
  elapsed: number;
  hype: number;
  announcement: string | null;
  fighters: readonly FighterSnapshot[];
}

/** Minimal physical contact record — no Rapier types. */
export interface PhysicalContact {
  id: number;
  time: number;
  sourceFighter: 'player' | 'opponent' | null;
  sourceSegment: string | null;
  targetFighter: 'player' | 'opponent' | null;
  targetSegment: string | null;
  targetRegion: string | null;
  totalForce: number;
  maximumForce: number;
  forceDirection: readonly [number, number, number];
  point?: readonly [number, number, number];
  relativeSpeed: number;
  attackInstanceId: number | null;
  moveId: string | null;
  sourceObjectId: string | null;
  targetSurface: string | null;
  isLanding: boolean;
}
