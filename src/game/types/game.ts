export type FighterId = 'atlas' | 'vex' | 'nova' | 'brick' | 'chad';
export type FighterState =
  | 'idle' | 'locomotion' | 'attacking' | 'grappling' | 'grabbed' | 'airborne'
  | 'blocking' | 'staggered' | 'downed' | 'recovering' | 'pinning' | 'pinned' | 'victorious' | 'defeated';
export type AttackPhase = 'anticipation' | 'active' | 'recovery' | null;
export type MoveCategory = 'quick' | 'heavy' | 'grapple' | 'ground' | 'aerial' | 'prop' | 'finisher' | 'utility';
export type AnimationKey =
  | 'idle' | 'combatIdle' | 'walk' | 'run' | 'jab' | 'heavyStrike' | 'kick' | 'grappleEntry'
  | 'lift' | 'slam' | 'throw' | 'stagger' | 'knockdown' | 'downed' | 'recovery' | 'dodge'
  | 'counter' | 'block' | 'taunt' | 'pin' | 'kickout' | 'victory' | 'defeat' | 'finisher';
export type Ruleset = 'standard' | 'chaos';
export type Difficulty = 'normal' | 'hard';
export type Tendencies = 'aggressive' | 'technical' | 'opportunistic';
export type ControlDevice = 'keyboard' | 'gamepad';
export type GameCommand = 'quick' | 'heavy' | 'grapple' | 'block' | 'dodge' | 'interact' | 'context' | 'taunt';

export interface Vec2 { x: number; z: number }

export interface FighterDefinition {
  id: FighterId;
  name: string;
  nickname: string;
  archetype: string;
  bio: string;
  signature: string;
  taunt: string;
  tendency: Tendencies;
  palette: { primary: string; secondary: string; skin: string; emissive: string };
  proportions: { height: number; width: number; headwear: 'crown' | 'mohawk' | 'mask' | 'bandana' | 'mullet' };
  stats: { power: number; speed: number; stamina: number; technique: number; charisma: number };
}

export interface MoveDefinition {
  id: string;
  displayName: string;
  category: MoveCategory;
  requiredActorStates: readonly FighterState[];
  requiredTargetStates?: readonly FighterState[];
  minimumRange: number;
  maximumRange: number;
  staminaCost: number;
  momentumGain: number;
  damage: number;
  anticipationDuration: number;
  activeDuration: number;
  recoveryDuration: number;
  knockback: number;
  knockdownStrength: number;
  counterWindow: readonly [number, number] | null;
  hypeValue: number;
  animationKey: AnimationKey;
  multiHit?: boolean;
}

export interface FighterRuntime {
  definitionId: FighterId;
  position: Vec2;
  velocity: Vec2;
  facing: number;
  health: number;
  stamina: number;
  staminaCap: number;
  beersDrunk: number;
  momentum: number;
  state: FighterState;
  moveId: string | null;
  attackPhase: AttackPhase;
  phaseElapsed: number;
  stateElapsed: number;
  hitTargets: string[];
  downTimer: number;
  counterWindow: number;
  invulnerability: number;
  pinCount: number;
  pinEscape: number;
  heldPropId: string | null;
  comboStep: number;
  recentMoves: string[];
  lastActionAt: number;
  ropeRebound: number;
  finisherPrimed: boolean;
}

export interface PropRuntime {
  id: string;
  kind: 'chair' | 'sign' | 'table';
  position: Vec2;
  durability: number;
  heldBy: 'player' | 'opponent' | null;
  broken: boolean;
}

export interface MatchStats {
  damageDealt: number;
  counters: number;
  grapples: number;
  finishers: number;
  nearFalls: number;
  propImpacts: number;
}

export interface MatchResult {
  winner: 'player' | 'opponent';
  method: 'PINFALL' | 'KNOCKOUT';
  duration: number;
  hype: number;
  grade: 'D' | 'C' | 'B' | 'A' | 'S';
  playerStats: MatchStats;
}

export interface ImpactEvent {
  id: number;
  position: Vec2;
  kind: 'light' | 'heavy' | 'blocked' | 'counter' | 'grapple' | 'weapon' | 'finisher' | 'table' | 'nearfall' | 'ko' | 'rope';
  intensity: number;
}

export interface ChaosEvent {
  type: 'PROP DROP' | 'CROWD SURGE' | 'OVERDRIVE ROPES' | 'SPOTLIGHT SHOWDOWN';
  remaining: number;
}

export interface MatchModel {
  ruleset: Ruleset;
  difficulty: Difficulty;
  elapsed: number;
  paused: boolean;
  resolved: boolean;
  player: FighterRuntime;
  opponent: FighterRuntime;
  hype: number;
  props: PropRuntime[];
  chaosEvent: ChaosEvent | null;
  nextChaosAt: number;
  lastImpact: ImpactEvent | null;
  impactSequence: number;
  announcement: string | null;
  announcementTimer: number;
  hitStop: number;
  slowMotion: number;
  result: MatchResult | null;
  playerStats: MatchStats;
  opponentStats: MatchStats;
  aiThinkTimer: number;
  aiIntent: GameCommand | null;
  aiBlockTimer: number;
  seed: number;
}
