export type FighterId = 'atlas' | 'vex' | 'nova' | 'brick' | 'chad';
export type FighterSlot = 'player' | 'opponent' | 'rival1' | 'rival2' | 'rival3';
export type AiFighterSlot = Exclude<FighterSlot, 'player'>;
export const FIGHTER_SLOTS: readonly FighterSlot[] = ['player', 'opponent', 'rival1', 'rival2', 'rival3'];
export const AI_FIGHTER_SLOTS: readonly AiFighterSlot[] = ['opponent', 'rival1', 'rival2', 'rival3'];
export type FighterState =
  | 'idle' | 'locomotion' | 'jumping' | 'attacking' | 'grappling' | 'grabbed' | 'airborne'
  | 'blocking' | 'climbing' | 'staggered' | 'downed' | 'recovering' | 'pinning' | 'pinned' | 'victorious' | 'defeated';
export type AttackPhase = 'anticipation' | 'active' | 'recovery' | null;
export type MoveCategory = 'quick' | 'heavy' | 'grapple' | 'ground' | 'aerial' | 'prop' | 'finisher' | 'utility';
export type AnimationKey =
  | 'idle' | 'combatIdle' | 'walk' | 'run' | 'jab' | 'heavyStrike' | 'kick' | 'grappleEntry'
  | 'lift' | 'slam' | 'throw' | 'stagger' | 'knockdown' | 'downed' | 'recovery' | 'dodge'
  | 'counter' | 'block' | 'climb' | 'aerial' | 'taunt' | 'pin' | 'kickout' | 'victory' | 'defeat' | 'finisher';
export type Ruleset = 'standard' | 'chaos';
export type MatchMode = 'battle_royale' | 'singles';
export type Difficulty = 'normal' | 'hard';
export type Tendencies = 'aggressive' | 'technical' | 'opportunistic';
export type ControlDevice = 'keyboard' | 'gamepad' | 'touch';
export type GameCommand = 'quick' | 'heavy' | 'grapple' | 'block' | 'dodge' | 'jump' | 'interact' | 'context' | 'taunt';
export type BodyRegion = 'head' | 'chest' | 'ribs' | 'pelvis' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
export type CollisionOutcome = 'absorbed' | 'stagger' | 'spin' | 'trip' | 'fall' | 'launch';
export type GrapplePosition = 'collarTie' | 'overhook' | 'underhook' | 'headlock' | 'waistLock' | 'rearWaistLock' | 'frontFacelock' | 'armControl';
export type RecoveryOrientation = 'back' | 'front' | 'left' | 'right';
export const FALL_REASONS = {
  StrikeImpulse: 'strike_impulse',
  Throw: 'throw',
  SupportCollision: 'support_collision',
  Fatigue: 'fatigue',
  MissedAerial: 'missed_aerial',
  DodgeFailure: 'dodge_failure',
  RopeOrObject: 'rope_or_object',
  KnockdownMove: 'knockdown_move',
  Knockout: 'knockout',
  PhysicsLab: 'physics_lab',
  Unknown: 'unknown',
} as const;
export type FallReason = typeof FALL_REASONS[keyof typeof FALL_REASONS];

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
  personality: { cowardly: number; showman: number; technical: number; aggressive: number; reckless: number; dirty: number; athletic: number; powerhouse: number };
  palette: { primary: string; secondary: string; skin: string; emissive: string };
  proportions: { height: number; width: number; headwear: 'crown' | 'mohawk' | 'mask' | 'bandana' | 'mullet' };
  physics: FighterPhysicsProfile;
  stats: { power: number; speed: number; stamina: number; technique: number; charisma: number };
}

export interface FighterPhysicsProfile {
  massKg: number;
  standingHeightM: number;
  shoulderWidthM: number;
  hipWidthM: number;
  armLength: number;
  legLength: number;
  torsoLength: number;
  centerOfMassBias: number;
  reachM: number;
  muscleStrength: number;
  gripStrength: number;
  balanceRecovery: number;
  jointStiffness: number;
}

export interface FootPlantRuntime {
  planted: boolean;
  phase: number;
  lift: number;
  offset: Vec2;
}

export interface BodyDynamicsRuntime {
  mass: number;
  inertia: number;
  balance: number;
  muscle: number;
  leanForward: number;
  leanSide: number;
  twist: number;
  headSnap: number;
  pelvisDrop: number;
  leanVelocity: number;
  sideVelocity: number;
  twistVelocity: number;
  headVelocity: number;
  verticalOffset: number;
  verticalVelocity: number;
  gaitPhase: number;
  stride: number;
  leftFoot: FootPlantRuntime;
  rightFoot: FootPlantRuntime;
  stumble: number;
  impactEnergy: number;
  lastImpactRegion: BodyRegion | null;
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
  attackInstanceId: number;
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
  climbStage: 0 | 1 | 2 | 3;
  recoveryOrientation: RecoveryOrientation;
  fallReason: FallReason | null;
  lastFallReason: FallReason | null;
  fallSequence: number;
  body: BodyDynamicsRuntime;
}

export interface PropRuntime {
  id: string;
  kind: 'chair' | 'sign' | 'trash' | 'bell' | 'table';
  position: Vec2;
  durability: number;
  stress: number;
  failureStage: 'intact' | 'stressed' | 'cracked' | 'failed';
  heldBy: FighterSlot | null;
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
  winner: FighterSlot;
  method: 'PINFALL' | 'KNOCKOUT';
  duration: number;
  hype: number;
  grade: 'D' | 'C' | 'B' | 'A' | 'S';
  playerStats: MatchStats;
  highlights: MatchHighlights;
}

export interface ImpactEvent {
  id: number;
  position: Vec2;
  kind: 'light' | 'heavy' | 'blocked' | 'counter' | 'grapple' | 'weapon' | 'finisher' | 'table' | 'nearfall' | 'ko' | 'rope';
  intensity: number;
  region?: BodyRegion;
  force?: number;
  torque?: number;
  outcome?: CollisionOutcome;
  moveId?: string;
  sourceFighter?: FighterSlot;
  targetFighter?: FighterSlot;
}

export interface GrappleRuntime {
  attacker: FighterSlot;
  defender: FighterSlot;
  position: GrapplePosition;
  leverage: number;
  tension: number;
  rotation: number;
  lift: number;
  struggle: number;
  age: number;
  gripCount: number;
  phase: 'reach' | 'acquire' | 'clinch' | 'load' | 'lift' | 'release' | 'impact' | 'failed';
}

export interface ReplayFighterFrame {
  definitionId: FighterId;
  position: Vec2;
  velocity: Vec2;
  facing: number;
  state: FighterState;
  stateElapsed: number;
  moveId: string | null;
  attackPhase: AttackPhase;
  phaseElapsed: number;
  health: number;
  stamina: number;
  staminaCap: number;
  momentum: number;
  climbStage: 0 | 1 | 2 | 3;
  recoveryOrientation: RecoveryOrientation;
  body: {
    verticalOffset: number;
    leanForward: number;
    leanSide: number;
    twist: number;
    headSnap: number;
    pelvisDrop: number;
    muscle: number;
    gaitPhase: number;
    stride: number;
    leftFoot: FootPlantRuntime;
    rightFoot: FootPlantRuntime;
  };
}

export interface ReplayFrame {
  time: number;
  player: ReplayFighterFrame;
  opponent: ReplayFighterFrame;
}

export interface HighlightMoment {
  impactId: number;
  time: number;
  label: string;
  score: number;
  kind: 'strike' | 'slam' | 'reversal' | 'weapon' | 'rope' | 'table' | 'aerial';
}

export interface MatchHighlights {
  bestSpot: HighlightMoment | null;
  bestSlam: HighlightMoment | null;
  mostBrutalImpact: HighlightMoment | null;
  mostUnexpectedReversal: HighlightMoment | null;
}

export interface ChaosEvent {
  type: 'PROP DROP' | 'CROWD SURGE' | 'OVERDRIVE ROPES' | 'SPOTLIGHT SHOWDOWN';
  remaining: number;
}

export interface AiControllerRuntime {
  thinkTimer: number;
  intent: GameCommand | null;
  movement: Vec2;
  running: boolean;
  blockTimer: number;
}

export interface MatchElimination {
  fighter: FighterSlot;
  by: FighterSlot;
  method: 'PINFALL' | 'KNOCKOUT';
  time: number;
}

export interface FallEvent {
  sequence: number;
  fighter: FighterSlot;
  reason: FallReason;
  time: number;
  state: Extract<FighterState, 'airborne' | 'downed'>;
}

export interface MatchModel {
  toyTestMode: boolean;
  labMode: boolean;
  matchMode: MatchMode;
  ruleset: Ruleset;
  difficulty: Difficulty;
  elapsed: number;
  paused: boolean;
  physicsAuthority: boolean;
  resolved: boolean;
  player: FighterRuntime;
  opponent: FighterRuntime;
  rival1: FighterRuntime;
  rival2: FighterRuntime;
  rival3: FighterRuntime;
  targets: Record<FighterSlot, FighterSlot>;
  playerTargetLock: number;
  eliminations: MatchElimination[];
  falls: FallEvent[];
  fallSequence: number;
  unstableWithoutCauseSeconds: number;
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
  fighterStats: Record<FighterSlot, MatchStats>;
  aiThinkTimer: number;
  aiIntent: GameCommand | null;
  aiMovement: Vec2;
  aiRunning: boolean;
  aiBlockTimer: number;
  aiControllers: Record<AiFighterSlot, AiControllerRuntime>;
  grapple: GrappleRuntime | null;
  replayFrames: ReplayFrame[];
  replaySampleTimer: number;
  highlights: HighlightMoment[];
  runtimeId: number;
  seed: number;
}
