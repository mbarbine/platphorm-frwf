export type FighterId = 'atlas' | 'vex' | 'nova' | 'brick' | 'chad';
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
export type Difficulty = 'normal' | 'hard';
export type Tendencies = 'aggressive' | 'technical' | 'opportunistic';
export type ControlDevice = 'keyboard' | 'gamepad' | 'touch';
export type GameCommand = 'quick' | 'heavy' | 'grapple' | 'block' | 'dodge' | 'jump' | 'interact' | 'context' | 'taunt';
export type BodyRegion = 'head' | 'chest' | 'ribs' | 'pelvis' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
export type CollisionOutcome = 'absorbed' | 'stagger' | 'spin' | 'trip' | 'fall' | 'launch';
export type GrapplePosition = 'collarTie' | 'overhook' | 'underhook' | 'headlock' | 'waistLock' | 'rearWaistLock' | 'frontFacelock' | 'armControl';

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
  body: BodyDynamicsRuntime;
}

export interface PropRuntime {
  id: string;
  kind: 'chair' | 'sign' | 'table';
  position: Vec2;
  durability: number;
  stress: number;
  failureStage: 'intact' | 'stressed' | 'cracked' | 'failed';
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
}

export interface GrappleRuntime {
  attacker: 'player' | 'opponent';
  defender: 'player' | 'opponent';
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
  position: Vec2;
  facing: number;
  verticalOffset: number;
  leanForward: number;
  leanSide: number;
  state: FighterState;
  moveId: string | null;
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

export interface MatchModel {
  toyTestMode: boolean;
  labMode: boolean;
  ruleset: Ruleset;
  difficulty: Difficulty;
  elapsed: number;
  paused: boolean;
  physicsAuthority: boolean;
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
  aiMovement: Vec2;
  aiRunning: boolean;
  aiBlockTimer: number;
  grapple: GrappleRuntime | null;
  replayFrames: ReplayFrame[];
  replaySampleTimer: number;
  highlights: HighlightMoment[];
  runtimeId: number;
  seed: number;
}
