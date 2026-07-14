import type { RapierRigidBody } from '@react-three/rapier';
import type { ImpulseJoint, JointData, World } from '@dimforge/rapier3d-compat';
import type { FrameInput } from '../systems/combat';
import type { BodyRegion, FighterRuntime, GameCommand, MatchModel, PropRuntime, Vec2 } from '../types/game';
import { clamp } from '../utils/math';
import type { BodySegmentId } from './bodySchema';
import { computeMotorTorque } from './motorController';
import { PhysicsReplayBuffer } from './replayBuffer';
import { getMove } from '../data/moves';
import { fighterById } from '../data/fighters';
import { getPairedPose, getStrikePose } from '../animation/choreography';
import { applyBodyLanguage } from '../animation/bodyLanguage';
import { POSES } from '../animation/poses';
import type { Pose } from '../animation/poses';
import { recoveryPose } from '../animation/recoveryMotion';
import type { QuaternionValue, Vector3Value } from './motorController';
import { apronTransitionTarget, isRingside, RING_HARD_LIMIT, solveRopeResponse } from './ringDynamics';
import { computeStrikeForce, strikeDriveProfile } from './strikeDynamics';
import { locomotionProfile } from './bodyDynamics';
import { VOLT_DOME } from '../data/arena';
import { BODYWORKS_FLAGS } from './bodyWorksFlags';
import { motorChainForSegment, motorStrengthFor, selectMotorProfile } from './motorProfiles';
import type { MotorProfile } from './motorProfiles';
import { inspectNumericalBody, jointSeparationFault } from './numericalHealth';
import type { NumericalFault } from './numericalHealth';
import { MotionTaskRunner } from './motionTaskRunner';

export type FighterKey = 'player' | 'opponent';

export interface BufferedPhysicsCommand {
  id: number;
  fighter: FighterKey;
  command: GameCommand;
  direction: Vec2;
  running: boolean;
  issuedAt: number;
  expiresAt: number;
}

export interface BodyWorksContact {
  id: number;
  time: number;
  sourceFighter: FighterKey | null;
  sourceSegment: BodySegmentId | null;
  targetFighter: FighterKey | null;
  targetSegment: BodySegmentId | null;
  targetRegion: BodyRegion | null;
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

export interface BodyWorksMetrics {
  fixedSteps: number;
  bodyCount: number;
  jointCount: number;
  gripCount: number;
  nearestGripDistance: number;
  maximumGripError: number;
  maximumGripLoad: number;
  lastGripBreakReason: string;
  worldJointCount: number;
  gripCreateCount: number;
  gripInvalidCount: number;
  propBodyCount: number;
  propGripCount: number;
  worldBodyCount: number;
  invalidRegisteredBodyCount: number;
  worldRemoveCount: number;
  contactCount: number;
  lastContactPair: string;
  emergencyResetCount: number;
  containmentCount: number;
  lastStepMs: number;
  averageStepMs: number;
  p95StepMs: number;
  maximumStepMs: number;
  replayEstimatedBytes: number;
  currentJointSeparation: number;
  maximumJointSeparation: number;
  motorSaturationCount: number;
  currentMotorSaturations: number;
  lastStrikeDistance: number;
  minimumStrikeDistance: number;
  minimumStrikePlanarDistance: number;
  minimumStrikeVerticalDistance: number;
  numericalFaultCount: number;
  lastNumericalFault: string;
  supportScore: number;
  taskCount: number;
  taskTimeoutCount: number;
  lastTaskPhase: string;
}

export interface FighterPhysicsSnapshot { pelvisY: number; headY: number; footY: number; upright: number; speed: number; supportFeet: number }
export interface SegmentTransformSnapshot { position: Vector3Value; rotation: QuaternionValue }
export interface PresentationAlignmentSnapshot { sampleCount: number; averageError: number; maximumError: number; maximumSegment: BodySegmentId | null }

interface FighterRigRegistration {
  bodies: Partial<Record<BodySegmentId, RapierRigidBody>>;
  restOffsets: Partial<Record<BodySegmentId, Vector3Value>>;
  restPelvisY: number;
  rootStabilized: boolean;
  skeletonStabilized: boolean;
  rotationSignature: string;
  rotationallyDynamic: Set<BodySegmentId>;
  supportContacts: Set<BodySegmentId>;
  jumpQueued: boolean;
  jumpCooldown: number;
  ropeContact: { axis: 'x' | 'z'; side: -1 | 1; peakCompression: number; entrySpeed: number } | null;
  cornerAnchor: (Vec2 & { stage: 1 | 2 | 3 }) | null;
  apronAnchor: { target: Vec2; inside: boolean; age: number } | null;
  jointFaultFrames: number;
  jointFaultReported: boolean;
  settlingFrames: number;
  lastSafeCenter: Vec2;
}

interface IntentState { move: Vec2; run: boolean; block: boolean }

interface PhysicalGrip {
  id: string;
  ownerTaskId: string;
  attacker: FighterKey;
  defender: FighterKey;
  hand: BodySegmentId;
  target: BodySegmentId;
  targetAnchorX: number;
  moveId: string;
  strength: number;
  createdAt: number;
}

interface GrappleEnvironmentTarget {
  attacker: FighterKey;
  defender: FighterKey;
  attackInstanceId: number;
  surface: 'table' | 'turnbuckle';
  position: Vec2;
}

interface RegisteredProp {
  body: RapierRigidBody;
  kind: Exclude<PropRuntime['kind'], 'table'>;
}

interface RegisteredLandingSurface {
  body: RapierRigidBody;
  kind: 'table' | 'turnbuckle';
}

interface PhysicalPropGrip {
  propId: string;
  owner: FighterKey;
  joint: ImpulseJoint;
}

interface PendingLanding { attacker: FighterKey; defender: FighterKey; attackInstanceId: number; moveId: string; releasedAt: number; expiresAt: number; targetSurface: 'table' | 'turnbuckle' | null; targetPosition: Vec2 | null }
interface ReleasedPropAttack { owner: FighterKey; attackInstanceId: number; moveId: 'prop_throw'; expiresAt: number }

const EMPTY_INTENT = (): IntentState => ({ move: { x: 0, z: 0 }, run: false, block: false });
const MAX_COMMANDS = 32;
const MAX_CONTACTS = 128;
const COMMAND_BUFFER_SECONDS = .16;
const JOINT_LINKS: readonly (readonly [BodySegmentId, BodySegmentId])[] = [
  ['pelvis', 'abdomen'], ['abdomen', 'chest'], ['chest', 'head'],
  ['chest', 'leftUpperArm'], ['chest', 'rightUpperArm'],
  ['leftUpperArm', 'leftForearm'], ['rightUpperArm', 'rightForearm'],
  ['leftForearm', 'leftHand'], ['rightForearm', 'rightHand'],
  ['pelvis', 'leftThigh'], ['pelvis', 'rightThigh'],
  ['leftThigh', 'leftShin'], ['rightThigh', 'rightShin'],
  ['leftShin', 'leftFoot'], ['rightShin', 'rightFoot'],
];
const SEGMENT_PARENT: Readonly<Partial<Record<BodySegmentId, BodySegmentId>>> = Object.fromEntries(JOINT_LINKS.map(([parent, child]) => [child, parent]));

const bodyAnchorWorld = (body: RapierRigidBody, localX: number): { x: number; y: number; z: number } => {
  const position = body.translation(); const rotation = body.rotation();
  const doubledX = localX * 2;
  return {
    x: position.x + localX * (1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z)),
    y: position.y + doubledX * (rotation.x * rotation.y + rotation.w * rotation.z),
    z: position.z + doubledX * (rotation.x * rotation.z - rotation.w * rotation.y),
  };
};

const GRIP_ANCHOR_RADIUS: Readonly<Partial<Record<BodySegmentId, number>>> = {
  pelvis: .22, abdomen: .21, chest: .27, head: .18,
  leftUpperArm: .105, rightUpperArm: .105, leftForearm: .11, rightForearm: .11,
};

/** The catch point lives on the contacted collider surface, not its centre. */
const bodySurfaceAnchorWorld = (body: RapierRigidBody, localX: number, hand: Vector3Value, segment: BodySegmentId): Vector3Value => {
  const anchor = bodyAnchorWorld(body, localX); const dx = hand.x - anchor.x; const dy = hand.y - anchor.y; const dz = hand.z - anchor.z;
  const distance = Math.max(.001, Math.hypot(dx, dy, dz)); const radius = GRIP_ANCHOR_RADIUS[segment] ?? .09;
  return { x: anchor.x + dx / distance * radius, y: anchor.y + dy / distance * radius, z: anchor.z + dz / distance * radius };
};

const rotatedLocalPoint = (body: RapierRigidBody, local: Vector3Value): Vector3Value => {
  const position = body.translation(); const rotation = body.rotation();
  const ix = rotation.w * local.x + rotation.y * local.z - rotation.z * local.y;
  const iy = rotation.w * local.y + rotation.z * local.x - rotation.x * local.z;
  const iz = rotation.w * local.z + rotation.x * local.y - rotation.y * local.x;
  const iw = -rotation.x * local.x - rotation.y * local.y - rotation.z * local.z;
  return {
    x: position.x + ix * rotation.w + iw * -rotation.x + iy * -rotation.z - iz * -rotation.y,
    y: position.y + iy * rotation.w + iw * -rotation.y + iz * -rotation.x - ix * -rotation.z,
    z: position.z + iz * rotation.w + iw * -rotation.z + ix * -rotation.y - iy * -rotation.x,
  };
};

/** Imperative simulation state. It is intentionally outside React and Zustand. */
export class BodyWorksRuntime {
  private jointData: typeof JointData | null = null;
  private readonly rigs = new Map<FighterKey, FighterRigRegistration>();
  private readonly intents: Record<FighterKey, IntentState> = { player: EMPTY_INTENT(), opponent: EMPTY_INTENT() };
  private readonly commands: BufferedPhysicsCommand[] = [];
  private readonly contacts: BodyWorksContact[] = [];
  private commandId = 0;
  private contactId = 0;
  private generation = 0;
  private world: World | null = null;
  private instrumentedWorld: World | null = null;
  private originalRemoveImpulseJoint: World['removeImpulseJoint'] | null = null;
  private readonly grips: PhysicalGrip[] = [];
  private readonly props = new Map<string, RegisteredProp>();
  private readonly landingSurfaces = new Map<string, RegisteredLandingSurface>();
  private readonly propGrips = new Map<string, PhysicalPropGrip>();
  private readonly releasedPropAttacks = new Map<string, ReleasedPropAttack>();
  private readonly tasks = new MotionTaskRunner();
  private readonly pendingLandings = new Map<FighterKey, PendingLanding>();
  private readonly landingDeflections = new Set<string>();
  private readonly presentationPoints: Record<FighterKey, Partial<Record<BodySegmentId, Vector3Value>>> = { player: {}, opponent: {} };
  private readonly labAdditionalMass: Record<FighterKey, number> = { player: 0, opponent: 0 };
  private grappleEnvironmentTarget: GrappleEnvironmentTarget | null = null;
  private replayAccumulator = 0;
  private stepStartedAt = -1;
  private currentFixedDt = 1 / 60;
  private lastStrikeMetricKey = '';
  private readonly stepSamples = new Float64Array(240);
  private stepSampleCursor = 0;
  private stepSampleCount = 0;
  private stepSampleTotal = 0;
  readonly replay = new PhysicsReplayBuffer(300);
  readonly metrics: BodyWorksMetrics = { fixedSteps: 0, bodyCount: 0, jointCount: 0, gripCount: 0, nearestGripDistance: 0, maximumGripError: 0, maximumGripLoad: 0, lastGripBreakReason: 'none', worldJointCount: 0, gripCreateCount: 0, gripInvalidCount: 0, propBodyCount: 0, propGripCount: 0, worldBodyCount: 0, invalidRegisteredBodyCount: 0, worldRemoveCount: 0, contactCount: 0, lastContactPair: 'none', emergencyResetCount: 0, containmentCount: 0, lastStepMs: 0, averageStepMs: 0, p95StepMs: 0, maximumStepMs: 0, replayEstimatedBytes: 0, currentJointSeparation: 0, maximumJointSeparation: 0, motorSaturationCount: 0, currentMotorSaturations: 0, lastStrikeDistance: 0, minimumStrikeDistance: 0, minimumStrikePlanarDistance: 0, minimumStrikeVerticalDistance: 0, numericalFaultCount: 0, lastNumericalFault: 'none', supportScore: 0, taskCount: 0, taskTimeoutCount: 0, lastTaskPhase: 'none' };

  registerFighter(fighter: FighterKey, bodies: Partial<Record<BodySegmentId, RapierRigidBody>>, jointCount: number): () => void {
    const pelvisPosition = bodies.pelvis?.translation() ?? { x: 0, y: 3.02, z: 0 };
    const restOffsets: Partial<Record<BodySegmentId, Vector3Value>> = {};
    for (const [segment, body] of Object.entries(bodies) as [BodySegmentId, RapierRigidBody][]) {
      const position = body.translation();
      restOffsets[segment] = { x: position.x - pelvisPosition.x, y: position.y - pelvisPosition.y, z: position.z - pelvisPosition.z };
    }
    this.rigs.set(fighter, { bodies, restOffsets, restPelvisY: pelvisPosition.y, rootStabilized: false, skeletonStabilized: false, rotationSignature: '', rotationallyDynamic: new Set<BodySegmentId>(), supportContacts: new Set<BodySegmentId>(), jumpQueued: false, jumpCooldown: 0, ropeContact: null, cornerAnchor: null, apronAnchor: null, jointFaultFrames: 0, jointFaultReported: false, settlingFrames: 0, lastSafeCenter: { x: pelvisPosition.x, z: pelvisPosition.z } });
    this.applyLabAdditionalMass(fighter);
    this.recount(jointCount);
    const registeredGeneration = this.generation;
    return () => {
      if (registeredGeneration === this.generation) this.rigs.delete(fighter);
      this.recount(0);
    };
  }

  /** Rapier's value export is injected by the lazy scene so menus do not load the WASM runtime. */
  setJointData(jointData: typeof JointData): void { this.jointData = jointData; }

  setLabAdditionalMass(fighter: FighterKey, kilograms: number): void {
    this.labAdditionalMass[fighter] = clamp(kilograms, 0, 120);
    this.applyLabAdditionalMass(fighter);
  }

  private applyLabAdditionalMass(fighter: FighterKey): void {
    const bodies = Object.values(this.rigs.get(fighter)?.bodies ?? {}).filter((body): body is RapierRigidBody => Boolean(body?.isValid()));
    const perBody = this.labAdditionalMass[fighter] / Math.max(1, bodies.length);
    for (const body of bodies) body.setAdditionalMass(perBody, true);
  }

  registerProp(id: string, kind: Exclude<PropRuntime['kind'], 'table'>, body: RapierRigidBody): () => void {
    this.props.set(id, { body, kind });
    this.metrics.propBodyCount = this.props.size;
    const registeredGeneration = this.generation;
    return () => {
      if (registeredGeneration !== this.generation) return;
      const grip = this.propGrips.get(id);
      if (grip && this.world) this.releasePropGrip(this.world, grip, null);
      this.props.delete(id);
      this.metrics.propBodyCount = this.props.size;
    };
  }

  registerLandingSurface(id: string, kind: RegisteredLandingSurface['kind'], body: RapierRigidBody): () => void {
    this.landingSurfaces.set(id, { body, kind });
    return () => { if (this.landingSurfaces.get(id)?.body === body) this.landingSurfaces.delete(id); };
  }

  private recount(fallbackJoints: number): void {
    let bodies = 0;
    for (const rig of this.rigs.values()) bodies += Object.keys(rig.bodies).length;
    this.metrics.bodyCount = bodies;
    this.metrics.jointCount = this.rigs.size > 0 ? Math.max(this.metrics.jointCount, fallbackJoints * this.rigs.size) : 0;
  }

  private rigPlanarCenter(rig: FighterRigRegistration): { x: number; z: number; velocityX: number; velocityZ: number; mass: number } {
    let mass = 0; let x = 0; let z = 0; let velocityX = 0; let velocityZ = 0;
    for (const body of Object.values(rig.bodies)) {
      if (!body?.isValid()) continue;
      const bodyMass = body.mass(); const position = body.translation(); const velocity = body.linvel();
      mass += bodyMass; x += position.x * bodyMass; z += position.z * bodyMass;
      velocityX += velocity.x * bodyMass; velocityZ += velocity.z * bodyMass;
    }
    const inverseMass = 1 / Math.max(.001, mass);
    return { x: x * inverseMass, z: z * inverseMass, velocityX: velocityX * inverseMass, velocityZ: velocityZ * inverseMass, mass };
  }

  private applyRigAcceleration(rig: FighterRigRegistration, acceleration: Vector3Value): void {
    for (const body of Object.values(rig.bodies)) {
      if (!body?.isValid()) continue;
      const mass = body.mass(); body.addForce({ x: acceleration.x * mass, y: acceleration.y * mass, z: acceleration.z * mass }, true);
    }
  }

  private applyRigVelocityDelta(rig: FighterRigRegistration, delta: Vector3Value): void {
    for (const body of Object.values(rig.bodies)) {
      if (!body?.isValid()) continue;
      const mass = body.mass(); body.applyImpulse({ x: delta.x * mass, y: delta.y * mass, z: delta.z * mass }, true);
    }
  }

  captureInput(fighter: FighterKey, input: FrameInput, now: number): void {
    const intent = this.intents[fighter];
    intent.move.x = input.move.x; intent.move.z = input.move.z; intent.run = input.run; intent.block = input.block;
    for (const command of input.commands) {
      this.commandId += 1;
      this.commands.push({ id: this.commandId, fighter, command, direction: { ...input.move }, running: input.run, issuedAt: now, expiresAt: now + COMMAND_BUFFER_SECONDS });
    }
    if (this.commands.length > MAX_COMMANDS) this.commands.splice(0, this.commands.length - MAX_COMMANDS);
  }

  resolveCommands(fighter: FighterKey, now: number, attempt: (command: BufferedPhysicsCommand) => boolean, expired?: (command: BufferedPhysicsCommand) => void): void {
    for (let index = 0; index < this.commands.length;) {
      const command = this.commands[index];
      if (!command) { index += 1; continue; }
      if (command.expiresAt < now) { this.commands.splice(index, 1); if (command.fighter === fighter) expired?.(command); continue; }
      if (command.fighter === fighter && attempt(command)) { this.commands.splice(index, 1); return; }
      index += 1;
    }
  }

  setAiIntent(move: Vec2, run: boolean, block: boolean): void {
    const intent = this.intents.opponent; intent.move.x = move.x; intent.move.z = move.z; intent.run = run; intent.block = block;
  }

  intentSnapshot(fighter: FighterKey): Readonly<IntentState> {
    const intent = this.intents[fighter];
    return { move: { ...intent.move }, run: intent.run, block: intent.block };
  }

  requestJump(fighter: FighterKey): void { const rig = this.rigs.get(fighter); if (rig) rig.jumpQueued = true; }

  requestCornerClimb(fighter: FighterKey, from: Vec2, stage: 1 | 2 | 3 = 1): void {
    const rig = this.rigs.get(fighter); if (!rig) return;
    rig.cornerAnchor = { x: (Math.sign(from.x) || 1) * 5.08, z: (Math.sign(from.z) || 1) * 3.58, stage };
    rig.ropeContact = null;
  }

  requestCornerDive(fighter: FighterKey, target: Vec2): void {
    const rig = this.rigs.get(fighter); const pelvis = rig?.bodies.pelvis; const chest = rig?.bodies.chest;
    if (!rig || !pelvis) return;
    rig.cornerAnchor = null; rig.supportContacts.clear();
    const position = pelvis.translation(); const dx = target.x - position.x; const dz = target.z - position.z; const distance = Math.max(.001, Math.hypot(dx, dz));
    const direction = { x: dx / distance, z: dz / distance }; const verticalLaunchSpeed = 5.4;
    const targetPelvisY = 2.92; const fallDistance = Math.max(0, position.y - targetPelvisY);
    const flightTime = (verticalLaunchSpeed + Math.sqrt(verticalLaunchSpeed * verticalLaunchSpeed + 36 * fallDistance)) / 18;
    const launchSpeed = clamp(distance / Math.max(.58, flightTime), 3.8, 7.2);
    // Launch the complete articulated mass with one shared velocity impulse.
    // Driving only the pelvis left the other fifteen bodies at rest, turning a
    // top-rope dive into a short joint stretch instead of committed flight.
    for (const body of Object.values(rig.bodies)) {
      if (!body?.isValid()) continue;
      const velocity = body.linvel(); const mass = body.mass();
      body.applyImpulse({ x: (direction.x * launchSpeed - velocity.x) * mass, y: (verticalLaunchSpeed - velocity.y) * mass, z: (direction.z * launchSpeed - velocity.z) * mass }, true);
    }
    chest?.applyTorqueImpulse({ x: -chest.mass() * .014, y: 0, z: direction.x * chest.mass() * .006 }, true);
  }

  requestApronTransition(fighter: FighterKey, from: Vec2): void {
    const rig = this.rigs.get(fighter); if (!rig) return;
    const transition = apronTransitionTarget(from);
    rig.apronAnchor = { ...transition, age: 0 };
    rig.ropeContact = null; rig.cornerAnchor = null;
  }

  prepareLabPositions(player: Vec2, opponent: Vec2): void {
    if (this.world) this.releaseAllGrips(this.world);
    // Every lab scenario is an isolated deterministic trial. Buffered input,
    // an opponent task from the prior trial, or a stale contact must never be
    // allowed to time out during the next scenario and falsify its evidence.
    this.tasks.clear(); this.commands.length = 0; this.pendingLandings.clear(); this.landingDeflections.clear(); this.grappleEnvironmentTarget = null; this.contacts.length = 0;
    this.metrics.contactCount = 0; this.metrics.lastContactPair = 'none';
    this.metrics.lastStrikeDistance = 0; this.metrics.minimumStrikeDistance = 0; this.metrics.minimumStrikePlanarDistance = 0; this.metrics.minimumStrikeVerticalDistance = 0;
    this.metrics.gripCreateCount = 0; this.metrics.maximumGripError = 0; this.metrics.maximumGripLoad = 0; this.metrics.lastGripBreakReason = 'none';
    this.metrics.taskCount = 0; this.metrics.taskTimeoutCount = 0; this.metrics.lastTaskPhase = 'none'; this.lastStrikeMetricKey = '';
    this.placeFighter('player', player); this.placeFighter('opponent', opponent);
  }

  private placeFighter(fighter: FighterKey, target: Vec2): void {
    const rig = this.rigs.get(fighter); const pelvis = rig?.bodies.pelvis; if (!rig || !pelvis) return;
    const placementPelvisY = rig.restPelvisY - (isRingside(target) ? 1.46 : 0);
    for (const [segment, body] of Object.entries(rig.bodies) as [BodySegmentId, RapierRigidBody][]) {
      if (!body?.isValid()) continue;
      const offset = rig.restOffsets[segment] ?? { x: 0, y: 0, z: 0 };
      // Placement invalidates the cached rotation-authority signature. Start
      // from an actually free body tree so the next controller pass can lock
      // planted chains or preserve a requested physical fall correctly.
      body.setEnabledRotations(true, true, true, true);
      body.setTranslation({ x: target.x + offset.x, y: placementPelvisY + offset.y, z: target.z + offset.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true); body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    }
    rig.rootStabilized = false; rig.skeletonStabilized = false; rig.rotationSignature = ''; rig.rotationallyDynamic.clear(); rig.supportContacts.clear(); rig.supportContacts.add('leftFoot'); rig.supportContacts.add('rightFoot'); rig.jumpQueued = false; rig.ropeContact = null; rig.cornerAnchor = null; rig.apronAnchor = null; rig.jointFaultFrames = 0; rig.jointFaultReported = false; rig.settlingFrames = 0; rig.lastSafeCenter = { ...target };
  }

  setFootContact(fighter: FighterKey, foot: BodySegmentId, touching: boolean): void {
    const rig = this.rigs.get(fighter); if (!rig) return;
    if (touching) rig.supportContacts.add(foot); else rig.supportContacts.delete(foot);
  }

  recordContact(contact: Omit<BodyWorksContact, 'id'>): void {
    const pending = contact.sourceFighter ? this.pendingLandings.get(contact.sourceFighter) : undefined;
    const torsoLanding = contact.sourceSegment === 'chest' || contact.sourceSegment === 'abdomen' || contact.sourceSegment === 'pelvis' || contact.sourceSegment === 'head';
    const validLandingSurface = contact.targetSurface === 'ring' || contact.targetSurface === 'floor' || contact.targetSurface === 'table'
      || contact.targetSurface === 'steps' || contact.targetSurface === 'barricade' || contact.targetSurface === 'barricade-flex' || contact.targetSurface === 'turnbuckle' || contact.targetSurface === 'entrance-ramp';
    const committedLanding = contact.maximumForce > 24 || contact.totalForce > 38 || contact.relativeSpeed > 1.05;
    const expectedSurface = !pending?.targetSurface || contact.targetSurface === pending.targetSurface;
    if (pending && expectedSurface && contact.targetFighter === null && !torsoLanding && validLandingSurface && committedLanding && contact.sourceSegment) {
      const deflectionKey = `${pending.attackInstanceId}:${contact.sourceSegment}`;
      if (!this.landingDeflections.has(deflectionKey)) {
        this.landingDeflections.add(deflectionKey);
        const rig = this.rigs.get(pending.defender); const limb = rig?.bodies[contact.sourceSegment];
        if (limb?.isValid()) limb.applyImpulse({ x: 0, y: limb.mass() * clamp(.85 + contact.relativeSpeed * .24, .85, 2.15), z: 0 }, true);
        // A real boot/forearm glance redirects that limb instead of converting
        // it into fake torso damage. The connected core keeps its committed
        // downward momentum and must still create its own solved manifold.
        for (const segment of ['chest', 'abdomen', 'pelvis', 'head'] as const) {
          const core = rig?.bodies[segment]; if (!core?.isValid()) continue;
          const downwardSpeed = segment === 'chest' ? 1.05 : segment === 'abdomen' ? .75 : .48;
          core.applyImpulse({ x: 0, y: -core.mass() * downwardSpeed, z: 0 }, true);
        }
      }
    }
    if (pending && expectedSurface && contact.targetFighter === null && torsoLanding && validLandingSurface && committedLanding) {
      contact = {
        ...contact,
        sourceFighter: pending.attacker,
        sourceSegment: 'chest',
        targetFighter: pending.defender,
        attackInstanceId: pending.attackInstanceId,
        moveId: pending.moveId,
        isLanding: true,
      };
      this.pendingLandings.delete(pending.defender);
    }
    this.contactId += 1;
    this.contacts.push({ id: this.contactId, ...contact });
    if (this.contacts.length > MAX_CONTACTS) this.contacts.splice(0, this.contacts.length - MAX_CONTACTS);
    this.metrics.contactCount += 1;
    this.metrics.lastContactPair = `${contact.sourceSegment ?? 'environment'}>${contact.targetSegment ?? contact.targetSurface ?? 'environment'}`;
  }

  consumeContacts(): readonly BodyWorksContact[] { const result = this.contacts.splice(0); return result; }

  isAwaitingLanding(fighter: FighterKey): boolean { return this.pendingLandings.has(fighter); }
  pendingLandingCount(): number { return this.pendingLandings.size; }

  propAttackSource(propId: string, now: number): ReleasedPropAttack | null {
    const source = this.releasedPropAttacks.get(propId);
    if (!source || source.expiresAt < now) { this.releasedPropAttacks.delete(propId); return null; }
    return source;
  }

  beforeFixedStep(dt: number, model: MatchModel, world?: World): void {
    this.stepStartedAt = performance.now();
    this.currentFixedDt = dt;
    this.metrics.currentMotorSaturations = 0;
    if (world) {
      this.world = world;
      if (import.meta.env.DEV && this.instrumentedWorld !== world) {
        this.instrumentedWorld = world; this.originalRemoveImpulseJoint = world.removeImpulseJoint.bind(world);
        world.removeImpulseJoint = (joint, wakeUp) => { this.metrics.worldRemoveCount += 1; this.originalRemoveImpulseJoint?.(joint, wakeUp); };
      }
    }
    if (this.world) {
      this.metrics.worldJointCount = this.world.impulseJoints.len(); this.metrics.worldBodyCount = this.world.bodies.len();
      let invalidRegisteredBodies = 0;
      for (const rig of this.rigs.values()) for (const body of Object.values(rig.bodies)) if (body && !body.isValid()) invalidRegisteredBodies += 1;
      this.metrics.invalidRegisteredBodyCount = invalidRegisteredBodies;
    }
    if (model.paused || model.resolved) { this.stepStartedAt = -1; return; }
    this.syncMotionTasks(dt, model);
    if (['idle', 'locomotion'].includes(model.opponent.state)) {
      const intent = this.intents.opponent;
      intent.move.x = model.aiMovement.x; intent.move.z = model.aiMovement.z; intent.run = model.aiRunning;
      intent.block = model.aiBlockTimer > 0;
    }
    for (const rig of this.rigs.values()) this.capRigVelocity(rig);
    this.applyFighterController('player', model.player, dt, model);
    this.applyFighterController('opponent', model.opponent, dt, model);
    this.applyCloseRangeSeparation(model);
    if (this.world && BODYWORKS_FLAGS.props) this.syncPhysicalProps(this.world, model);
    if (this.world && BODYWORKS_FLAGS.grapples) this.advancePhysicalGrapple(this.world, model, dt);
    this.applyPendingLandingFollowThrough(model);
    for (const [fighter, landing] of this.pendingLandings) if (landing.expiresAt < model.elapsed) this.pendingLandings.delete(fighter);
    for (const [propId, attack] of this.releasedPropAttacks) if (attack.expiresAt < model.elapsed) this.releasedPropAttacks.delete(propId);
    this.metrics.fixedSteps += 1;
  }

  private applyPendingLandingFollowThrough(model: MatchModel): void {
    for (const landing of this.pendingLandings.values()) {
      const age = model.elapsed - landing.releasedAt; if (age < 0 || age > (landing.targetPosition ? 3 : .9)) continue;
      const rig = this.rigs.get(landing.defender); if (!rig) continue;
      // A slam first clears the planted feet, then turns into one coherent
      // articulated fall.  Giving the whole rig a shared target velocity
      // preserves every joint while still requiring a real torso/mat contact
      // before damage can score.
      const rising = age < .16;
      const fallAge = Math.max(0, age - .16);
      const targetVerticalVelocity = rising ? 2.7 : -Math.min(9.2, 1.1 + fallAge * 16);
      if (landing.targetPosition) {
        const center = this.rigPlanarCenter(rig); const dx = landing.targetPosition.x - center.x; const dz = landing.targetPosition.z - center.z;
        const distance = Math.hypot(dx, dz); const desiredSpeed = distance > .12 ? clamp(distance / (rising ? .3 : .2), .18, 4.8) : 0;
        const desiredX = distance > .001 ? dx / distance * desiredSpeed : 0; const desiredZ = distance > .001 ? dz / distance * desiredSpeed : 0;
        // Guide the already-released body tree as one coherent centre of mass.
        // This is bounded air control, not placement: the table must still be
        // reached and struck by a simulated torso before damage can score.
        this.applyRigVelocityDelta(rig, {
          x: clamp(desiredX - center.velocityX, -.38, .38),
          y: 0,
          z: clamp(desiredZ - center.velocityZ, -.38, .38),
        });
      }
      for (const [segment, body] of Object.entries(rig.bodies) as [BodySegmentId, RapierRigidBody][]) {
        if (!body?.isValid()) continue;
        // Pull distal limbs behind the falling core so a table spot lands on a
        // shoulder/chest instead of letting boots touch first and lever the
        // torso back upright. Constraints still own the resulting tuck.
        const distalLimb = segment.includes('Hand') || segment.includes('Forearm') || segment.includes('Foot') || segment.includes('Shin');
        const proximalLimb = segment.includes('UpperArm') || segment.includes('Thigh');
        const limbTuck = !rising ? distalLimb ? 4.8 : proximalLimb ? 2.2 : 0 : 0;
        const deltaY = clamp(targetVerticalVelocity + limbTuck - body.linvel().y, -.72, .5);
        body.applyImpulse({ x: 0, y: body.mass() * deltaY, z: 0 }, true);
      }
    }
  }

  private syncMotionTasks(dt: number, model: MatchModel): void {
    for (const key of ['player', 'opponent'] as const) {
      const fighter = model[key];
      if (!fighter.moveId) {
        this.tasks.complete(key);
        continue;
      }
      const move = getMove(fighter.moveId);
      const task = this.tasks.request({
        actorId: key,
        targetId: key === 'player' ? 'opponent' : 'player',
        moveId: move.id,
        attackInstanceId: fighter.attackInstanceId,
        maximumDuration: move.anticipationDuration + move.activeDuration + move.recoveryDuration + 1.6
          // Grip acquisition has its own 2.25 s fail-fast. The outer task is a
          // wider bounded watchdog so a valid lift/landing is not cancelled by
          // a slow but progressing ringside or corner traversal.
          + (move.category === 'grapple' || move.category === 'finisher' ? 5.2 : 0),
        phaseId: fighter.attackPhase ?? fighter.state,
      });
      const phase = model.grapple?.attacker === key ? model.grapple.phase : fighter.attackPhase ?? fighter.state;
      this.tasks.setPhase(key, phase); this.metrics.lastTaskPhase = `${task.id}:${phase}`;
    }
    const update = this.tasks.update(dt); this.metrics.taskCount = this.tasks.size;
    if (update.timedOut.length === 0) return;
    this.metrics.taskTimeoutCount += update.timedOut.length;
    for (const task of update.timedOut) {
      const actor = model[task.actorId]; const target = task.targetId ? model[task.targetId] : null;
      actor.moveId = null; actor.attackPhase = null; actor.state = 'staggered'; actor.stateElapsed = 0;
      if (target?.state === 'grabbed') { target.state = 'idle'; target.stateElapsed = 0; }
      if (model.grapple?.attacker === task.actorId) model.grapple = null;
    }
    if (this.world) this.releaseAllGrips(this.world);
    model.announcement = 'PHYSICAL HOLD LOST — SCRAMBLE!'; model.announcementTimer = .9;
  }

  private recordStepDuration(duration: number): void {
    if (!Number.isFinite(duration) || duration < 0) return;
    if (this.stepSampleCount === this.stepSamples.length) this.stepSampleTotal -= this.stepSamples[this.stepSampleCursor] ?? 0;
    else this.stepSampleCount += 1;
    this.stepSamples[this.stepSampleCursor] = duration;
    this.stepSampleTotal += duration;
    this.stepSampleCursor = (this.stepSampleCursor + 1) % this.stepSamples.length;
    this.metrics.lastStepMs = duration;
    this.metrics.averageStepMs = this.stepSampleTotal / Math.max(1, this.stepSampleCount);
    this.metrics.maximumStepMs = Math.max(this.metrics.maximumStepMs, duration);
    if (this.metrics.fixedSteps % 30 === 0 || this.stepSampleCount < 30) {
      const sorted = Array.from(this.stepSamples.slice(0, this.stepSampleCount)).sort((a, b) => a - b);
      this.metrics.p95StepMs = sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] ?? 0;
    }
  }

  private applyFighterController(key: FighterKey, fighter: FighterRuntime, dt: number, model: MatchModel): void {
    const rig = this.rigs.get(key); if (!rig) return;
    rig.jumpCooldown = Math.max(0, rig.jumpCooldown - dt);
    const pelvis = rig.bodies.pelvis; if (!pelvis) return;
    const motorProfile = selectMotorProfile(fighter);
    // Grounded pelvis roll/pitch uses a bounded balance constraint. Airborne,
    // falling, downed, and recovering bodies retain full rotational authority.
    // No transition writes an upright rotation; the controller must earn it.
    const rootStabilized = motorProfile.rootMode !== 'physical';
    if (rootStabilized !== rig.rootStabilized) {
      pelvis.setEnabledRotations(!rootStabilized, true, !rootStabilized, true);
      if (rootStabilized) {
        const angular = pelvis.angvel(); pelvis.setAngvel({ x: 0, y: angular.y * .25, z: 0 }, true);
      }
      rig.rootStabilized = rootStabilized;
    }
    this.configureRotationalAuthority(rig, fighter, motorProfile);
    const intent = this.intents[key];
    const velocity = pelvis.linvel();
    const definition = fighterById(fighter.definitionId);
    const locomotion = locomotionProfile(definition);
    const grapplePhase = model.grapple?.attacker === key ? model.grapple.phase : null;
    const grappleHipLoad = grapplePhase === 'load' ? .24 : grapplePhase === 'clinch' ? .08 : grapplePhase === 'lift' ? .12 : 0;
    const ringPelvisY = 1.8 + 1.12 * (definition.physics.standingHeightM / 1.88) - fighter.body.pelvisDrop * .32 - grappleHipLoad;
    const onRingsideFloor = isRingside({ x: pelvis.translation().x, z: pelvis.translation().z });
    const targetPelvisY = ringPelvisY - (onRingsideFloor ? 1.5 : 0);
    const atSideApron = (Math.abs(fighter.position.x) > 5.02 && Math.abs(fighter.position.x) < 5.82 && Math.abs(fighter.position.z) < 2.9)
      || (Math.abs(fighter.position.z) > 3.52 && Math.abs(fighter.position.z) < 4.32 && Math.abs(fighter.position.x) < 4.25);
    if (key === 'opponent' && !rig.apronAnchor && model.aiIntent === 'context' && fighter.state === 'locomotion' && atSideApron) {
      const transition = apronTransitionTarget(fighter.position); rig.apronAnchor = { ...transition, age: 0 }; rig.ropeContact = null;
    }
    if (key === 'opponent' && !rig.apronAnchor && onRingsideFloor && !isRingside(model.player.position) && ['idle', 'locomotion'].includes(fighter.state)) {
      const transition = apronTransitionTarget(fighter.position);
      rig.apronAnchor = { ...transition, age: 0 };
    }
    if (rig.apronAnchor) {
      const anchor = rig.apronAnchor; anchor.age += dt;
      const position = pelvis.translation(); const targetY = anchor.inside ? ringPelvisY + .04 : ringPelvisY - 1.46;
      const transitionVelocity = pelvis.linvel(); const dx = anchor.target.x - position.x; const dz = anchor.target.z - position.z;
      const planarDistance = Math.hypot(dx, dz);
      this.applyRigAcceleration(rig, {
        x: clamp(dx * 34 - transitionVelocity.x * 7.5, -48, 48),
        y: clamp((targetY - position.y) * 31 - transitionVelocity.y * 7.2, -48, 54),
        z: clamp(dz * 34 - transitionVelocity.z * 7.5, -48, 48),
      });
      this.applyPoseDrive(rig, fighter, motorProfile, CENTER_ROPE_POSE);
      if ((planarDistance < .24 && Math.abs(targetY - position.y) < .4) || anchor.age > 2.35) rig.apronAnchor = null;
      return;
    }
    if (fighter.state === 'climbing' && !rig.cornerAnchor && fighter.climbStage > 0) this.requestCornerClimb(key, fighter.position, fighter.climbStage as 1 | 2 | 3);
    if (fighter.state === 'climbing' && rig.cornerAnchor) {
      const position = pelvis.translation(); const target = rig.cornerAnchor;
      target.stage = fighter.climbStage || 1;
      const targetY = target.stage === 1 ? 2.72 : target.stage === 2 ? 3.46 : 4.28;
      this.applyRigAcceleration(rig, {
        x: clamp((target.x - position.x) * 36 - velocity.x * 8, -46, 46),
        y: clamp((targetY - position.y) * 38 - velocity.y * 8.5, -52, 52),
        z: clamp((target.z - position.z) * 36 - velocity.z * 8, -46, 46),
      });
      this.applyPoseDrive(rig, fighter, motorProfile);
      return;
    }
    if (fighter.state !== 'climbing') rig.cornerAnchor = null;
    const groundedControl = ['idle', 'locomotion', 'blocking', 'attacking', 'grappling', 'recovering', 'victorious'].includes(fighter.state);
    if (groundedControl) {
      const recoveryBlend = fighter.state === 'recovering' ? clamp(fighter.stateElapsed / .7, 0, 1) : 1;
      const recoveryTargetY = targetPelvisY - (1 - recoveryBlend) * .62;
      const contactMultiplier = rig.supportContacts.size > 0 ? 1 : pelvis.translation().y < recoveryTargetY + .2 ? .72 : 0;
      const supportAcceleration = clamp(18 + (recoveryTargetY - pelvis.translation().y) * 30 - velocity.y * 10.5, 0, 38) * fighter.body.muscle * contactMultiplier * (.42 + recoveryBlend * .58);
      this.applyRigAcceleration(rig, { x: 0, y: supportAcceleration, z: 0 });
    }
    const movementControl = ['idle', 'locomotion'].includes(fighter.state) ? 1 : fighter.state === 'recovering' ? .08 : 0;
    let desiredSpeed = (intent.run ? locomotion.runSpeed : locomotion.walkSpeed) * (fighter.body.muscle < .3 ? .86 : 1) * movementControl;
    const inputLength = Math.min(1, Math.hypot(intent.move.x, intent.move.z)) * movementControl;
    const opponent = model[key === 'player' ? 'opponent' : 'player']; const targetX = opponent.position.x - fighter.position.x; const targetZ = opponent.position.z - fighter.position.z;
    const targetDistance = Math.hypot(targetX, targetZ);
    if (inputLength > .08 && targetDistance < 2.8) {
      const approachAlignment = (intent.move.x * targetX + intent.move.z * targetZ) / Math.max(.001, inputLength * targetDistance);
      if (approachAlignment > .5) desiredSpeed *= clamp((targetDistance - 1.12) / 1.42, .16, 1);
    }
    const reboundSpeed = Math.hypot(velocity.x, velocity.z); const followingRebound = fighter.ropeRebound > 0 && reboundSpeed > 1.2 && inputLength > .08;
    const desiredX = followingRebound ? velocity.x / reboundSpeed * Math.max(reboundSpeed, locomotion.runSpeed) : intent.move.x * desiredSpeed * inputLength;
    const desiredZ = followingRebound ? velocity.z / reboundSpeed * Math.max(reboundSpeed, locomotion.runSpeed) : intent.move.z * desiredSpeed * inputLength;
    const acceleration = (inputLength <= .08 ? locomotion.braking : intent.run ? locomotion.runAcceleration : locomotion.acceleration) * (movementControl === 1 ? 1 : .24);
    if (movementControl > 0 && BODYWORKS_FLAGS.locomotion) {
      // Translate every segment by one shared center-of-mass velocity delta.
      // This produces no internal joint error, unlike per-limb velocity servos,
      // and avoids the pelvis-only impulse overshoot that caused the visible
      // two-metre-per-second idle vibration.
      const center = this.rigPlanarCenter(rig);
      const maximumChange = acceleration * dt * (inputLength > .08 ? 1.52 : 1.72);
      const deltaX = clamp(desiredX - center.velocityX, -maximumChange, maximumChange);
      const deltaZ = clamp(desiredZ - center.velocityZ, -maximumChange, maximumChange);
      const settled = inputLength <= .08 && Math.hypot(center.velocityX, center.velocityZ) < .006;
      if (!settled) for (const body of Object.values(rig.bodies)) {
        if (!body?.isValid()) continue;
        body.applyImpulse({ x: body.mass() * deltaX, y: 0, z: body.mass() * deltaZ }, true);
      }
    }
    if (inputLength > .08 || Math.hypot(fighter.position.x - model[key === 'player' ? 'opponent' : 'player'].position.x, fighter.position.z - model[key === 'player' ? 'opponent' : 'player'].position.z) < 4.8) {
      const desiredFacing = fighter.facing;
      const rotation = pelvis.rotation();
      const currentFacing = Math.atan2(2 * (rotation.w * rotation.y + rotation.x * rotation.z), 1 - 2 * (rotation.y * rotation.y + rotation.x * rotation.x));
      const error = Math.atan2(Math.sin(desiredFacing - currentFacing), Math.cos(desiredFacing - currentFacing));
      pelvis.applyTorqueImpulse({ x: 0, y: clamp(error * fighter.body.inertia * .022 - pelvis.angvel().y * .055, -1.1, 1.1), z: 0 }, true);
    }
    if (rig.jumpQueued) {
      const grounded = rig.supportContacts.size > 0 || pelvis.translation().y <= targetPelvisY + .16;
      if (grounded && rig.jumpCooldown <= 0 && (['idle', 'locomotion', 'jumping'].includes(fighter.state) || fighter.moveId === 'kick_up')) {
        const launchSpeed = fighter.moveId === 'kick_up' ? 4.6 : 8.2;
        rig.supportContacts.clear();
        for (const body of Object.values(rig.bodies)) {
          if (!body?.isValid()) continue;
          const velocity = body.linvel();
          const deltaY = Math.max(0, launchSpeed - velocity.y);
          body.applyImpulse({ x: 0, y: body.mass() * deltaY, z: 0 }, true);
        }
        rig.jumpCooldown = .65;
      }
      rig.jumpQueued = false;
    }
    if (rig.skeletonStabilized && motorProfile.rootMode !== 'physical') this.applyCorePostureDrive(rig);
    this.applyFootPlantDrive(rig, fighter, { x: desiredX, z: desiredZ }, inputLength);
    if (BODYWORKS_FLAGS.ropes) this.applyRopeController(rig, fighter, model);
    if (BODYWORKS_FLAGS.contactStrikes) this.applyPhysicalStrike(key, rig, fighter, model);
    const tableLandingPose = this.pendingLandings.get(key)?.targetSurface === 'table' ? POSES.downed : undefined;
    this.applyPoseDrive(rig, fighter, motorProfile, tableLandingPose);
  }

  private configureRotationalAuthority(rig: FighterRigRegistration, fighter: FighterRuntime, profile: MotorProfile): void {
    const dynamic = new Set<BodySegmentId>();
    if (profile.rootMode === 'physical') for (const segment of Object.keys(rig.bodies) as BodySegmentId[]) dynamic.add(segment);
    // Arms remain a live, supported chain in standing locomotion so hands are
    // physically held in a guard and can reach from that guard. Locking them
    // in their spawn-down orientation made every contact-true punch miss.
    if (['neutral', 'combat', 'walking', 'running', 'braking', 'jumpLoad', 'landing', 'victory'].includes(profile.id)) {
      // The shoulder/elbow chain supplies readable gait and guard movement.
      // Hands inherit the solved forearm pose and stay rotation-locked until
      // an actual strike, block, or grapple needs them. Continuously driving
      // four tiny distal bodies was the last visible idle buzz source.
      for (const segment of ['leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm'] as const) dynamic.add(segment);
    }
    if (fighter.state === 'blocking') for (const segment of ['leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm', 'leftHand', 'rightHand'] as const) dynamic.add(segment);
    if (fighter.state === 'grappling' || profile.id === 'clinch' || profile.id === 'lift' || profile.id === 'throw') for (const segment of ['leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm', 'leftHand', 'rightHand', 'chest', 'abdomen'] as const) dynamic.add(segment);
    const strike = fighter.moveId ? strikeDriveProfile(fighter.moveId) : null;
    if (strike) {
      dynamic.add(strike.source);
      if (strike.source.startsWith('left') && (strike.source.includes('Hand') || strike.source.includes('Arm') || strike.source.includes('Forearm'))) for (const segment of ['leftUpperArm', 'leftForearm', 'leftHand'] as const) dynamic.add(segment);
      if (strike.source.startsWith('right') && (strike.source.includes('Hand') || strike.source.includes('Arm') || strike.source.includes('Forearm'))) for (const segment of ['rightUpperArm', 'rightForearm', 'rightHand'] as const) dynamic.add(segment);
      if (strike.source.startsWith('left') && (strike.source.includes('Foot') || strike.source.includes('Shin') || strike.source.includes('Thigh'))) for (const segment of ['leftThigh', 'leftShin', 'leftFoot'] as const) dynamic.add(segment);
      if (strike.source.startsWith('right') && (strike.source.includes('Foot') || strike.source.includes('Shin') || strike.source.includes('Thigh'))) for (const segment of ['rightThigh', 'rightShin', 'rightFoot'] as const) dynamic.add(segment);
      if (strike.source === 'chest') for (const segment of ['chest', 'abdomen', 'leftUpperArm', 'rightUpperArm'] as const) dynamic.add(segment);
      if (fighter.moveId === 'stiff_arm' || fighter.moveId === 'rebound') for (const segment of ['leftUpperArm', 'leftForearm', 'leftHand', 'rightUpperArm', 'rightForearm', 'rightHand'] as const) dynamic.add(segment);
    }
    const signature = `${profile.rootMode}:${[...dynamic].sort().join(',')}`;
    if (signature === rig.rotationSignature) return;
    for (const [segment, body] of Object.entries(rig.bodies) as [BodySegmentId, RapierRigidBody][]) {
      if (!body?.isValid() || segment === 'pelvis') continue;
      const active = dynamic.has(segment); body.setEnabledRotations(active, active, active, true);
      if (!active) body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    rig.rotationallyDynamic = dynamic;
    rig.rotationSignature = signature; rig.skeletonStabilized = true;
  }

  private applyCorePostureDrive(rig: FighterRigRegistration): void {
    const pelvis = rig.bodies.pelvis; if (!pelvis) return;
    const pelvisPosition = pelvis.translation(); const pelvisVelocity = pelvis.linvel();
    for (const id of ['abdomen', 'chest', 'head'] as const) {
      const body = rig.bodies[id]; const offset = rig.restOffsets[id]; if (!body || !offset) continue;
      const position = body.translation(); const velocity = body.linvel();
      const acceleration = {
        x: clamp((pelvisPosition.x + offset.x - position.x) * 55 - (velocity.x - pelvisVelocity.x) * 11, -20, 20),
        y: clamp((pelvisPosition.y + offset.y - position.y) * 55 - (velocity.y - pelvisVelocity.y) * 11, -20, 20),
        z: clamp((pelvisPosition.z + offset.z - position.z) * 55 - (velocity.z - pelvisVelocity.z) * 11, -20, 20),
      };
      const force = { x: acceleration.x * body.mass(), y: acceleration.y * body.mass(), z: acceleration.z * body.mass() };
      body.addForce(force, true); pelvis.addForce({ x: -force.x, y: -force.y, z: -force.z }, true);
    }
  }

  private applyCloseRangeSeparation(model: MatchModel): void {
    if (model.grapple || !['idle', 'locomotion', 'blocking'].includes(model.player.state) || !['idle', 'locomotion', 'blocking'].includes(model.opponent.state)) return;
    const player = this.rigs.get('player')?.bodies.pelvis; const opponent = this.rigs.get('opponent')?.bodies.pelvis; if (!player || !opponent) return;
    const a = player.translation(); const b = opponent.translation(); let dx = b.x - a.x; let dz = b.z - a.z; let separation = Math.hypot(dx, dz);
    // Core colliders already prevent body overlap. This smaller comfort gap
    // lets real hands reach real targets; the old 1.08 m force field made a
    // clean jab geometrically impossible despite accepting the input.
    const comfortGap = .56;
    if (separation >= comfortGap) return;
    if (separation < .01) { dx = Math.sin(model.player.facing); dz = Math.cos(model.player.facing); separation = 1; }
    const nx = dx / separation; const nz = dz / separation; const relative = (opponent.linvel().x - player.linvel().x) * nx + (opponent.linvel().z - player.linvel().z) * nz;
    const averageMass = (player.mass() + opponent.mass()) * .5; const force = clamp((comfortGap - separation) * averageMass * 28 - relative * averageMass * 2.8, 0, 1_050);
    player.addForce({ x: -nx * force, y: 0, z: -nz * force }, true); opponent.addForce({ x: nx * force, y: 0, z: nz * force }, true);
  }

  private applyFootPlantDrive(rig: FighterRigRegistration, fighter: FighterRuntime, desiredVelocity: Vec2, inputLength: number): void {
    if (!['idle', 'locomotion', 'blocking', 'recovering'].includes(fighter.state)) return;
    // The pelvis owns planar locomotion. Feet only remove visible residual
    // skate after the fighter has stopped; they never counter-drive a stride.
    if (fighter.state === 'locomotion' || inputLength > .08 || Math.hypot(desiredVelocity.x, desiredVelocity.z) > .08) return;
    const entries: readonly [BodySegmentId, boolean][] = [['leftFoot', fighter.body.leftFoot.planted], ['rightFoot', fighter.body.rightFoot.planted]];
    for (const [id, planted] of entries) {
      if (!planted) continue;
      const foot = rig.bodies[id]; if (!foot) continue;
      const velocity = foot.linvel(); const planarSpeed = Math.hypot(velocity.x, velocity.z); if (planarSpeed < .18) continue;
      const mass = foot.mass(); const strength = fighter.state === 'recovering' ? 2.2 : 4.8;
      foot.addForce({ x: clamp(-velocity.x * mass * strength, -42, 42), y: 0, z: clamp(-velocity.z * mass * strength, -42, 42) }, true);
    }
  }

  private applyPhysicalStrike(key: FighterKey, rig: FighterRigRegistration, fighter: FighterRuntime, model: MatchModel): void {
    if (!fighter.moveId || (fighter.attackPhase !== 'anticipation' && fighter.attackPhase !== 'active')) return;
    const baseProfile = strikeDriveProfile(fighter.moveId); if (!baseProfile) return;
    if ((fighter.moveId === 'aerial' || fighter.moveId === 'aerial_kick' || fighter.moveId === 'aerial_elbow') && fighter.attackPhase !== 'active') return;
    const targetKey: FighterKey = key === 'player' ? 'opponent' : 'player'; const targetRig = this.rigs.get(targetKey);
    const authoredTarget = targetRig?.bodies[baseProfile.target];
    const directionalForearm = (fighter.moveId === 'stiff_arm' || fighter.moveId === 'rebound') && authoredTarget
      ? (['leftForearm', 'rightForearm'] as const).filter((segment) => rig.bodies[segment]?.isValid()).reduce<BodySegmentId>((nearest, segment) => {
          const nearestPosition = rig.bodies[nearest]?.translation(); const candidatePosition = rig.bodies[segment]?.translation(); const targetPosition = authoredTarget.translation();
          if (!nearestPosition) return segment; if (!candidatePosition) return nearest;
          return Math.hypot(candidatePosition.x - targetPosition.x, candidatePosition.y - targetPosition.y, candidatePosition.z - targetPosition.z)
            < Math.hypot(nearestPosition.x - targetPosition.x, nearestPosition.y - targetPosition.y, nearestPosition.z - targetPosition.z) ? segment : nearest;
        }, baseProfile.source)
      : baseProfile.source;
    const profile = directionalForearm === baseProfile.source ? baseProfile : { ...baseProfile, source: directionalForearm };
    const source = rig.bodies[profile.source]; const pelvis = rig.bodies.pelvis;
    const guardCandidates = model[targetKey].state === 'blocking' && BODYWORKS_FLAGS.physicalBlock
      // A valid block must physically meet a glove or raised forearm. Upper
      // arms are deliberately excluded because combat scoring treats those as
      // ordinary body damage, not a magically guarded torso hit.
      ? [targetRig?.bodies.leftHand, targetRig?.bodies.rightHand, targetRig?.bodies.leftForearm, targetRig?.bodies.rightForearm].filter((candidate): candidate is RapierRigidBody => Boolean(candidate?.isValid()))
      : [];
    const target = source && guardCandidates.length > 0
      ? guardCandidates.reduce((nearest, candidate) => {
          const sourcePosition = source.translation(); const nearestPosition = nearest.translation(); const candidatePosition = candidate.translation();
          return Math.hypot(candidatePosition.x - sourcePosition.x, candidatePosition.y - sourcePosition.y, candidatePosition.z - sourcePosition.z)
            < Math.hypot(nearestPosition.x - sourcePosition.x, nearestPosition.y - sourcePosition.y, nearestPosition.z - sourcePosition.z) ? candidate : nearest;
        })
      : authoredTarget;
    if (!source || !target || !pelvis) return;
    const sourcePosition = source.translation(); const targetPosition = target.translation();
    const strikePlanarDistance = Math.hypot(targetPosition.x - sourcePosition.x, targetPosition.z - sourcePosition.z);
    const strikeVerticalDistance = Math.abs(targetPosition.y - sourcePosition.y);
    const strikeDistance = Math.hypot(strikePlanarDistance, strikeVerticalDistance);
    const strikeMetricKey = `${key}:${fighter.attackInstanceId}:${fighter.moveId}`;
    if (strikeMetricKey !== this.lastStrikeMetricKey) {
      this.lastStrikeMetricKey = strikeMetricKey; this.metrics.minimumStrikeDistance = strikeDistance;
      this.metrics.minimumStrikePlanarDistance = strikePlanarDistance; this.metrics.minimumStrikeVerticalDistance = strikeVerticalDistance;
    }
    this.metrics.lastStrikeDistance = strikeDistance;
    if (strikeDistance < this.metrics.minimumStrikeDistance) {
      this.metrics.minimumStrikeDistance = strikeDistance; this.metrics.minimumStrikePlanarDistance = strikePlanarDistance; this.metrics.minimumStrikeVerticalDistance = strikeVerticalDistance;
    }
    const separation = Math.hypot(targetPosition.x - pelvis.translation().x, targetPosition.z - pelvis.translation().z);
    const move = getMove(fighter.moveId); if (separation > move.maximumRange + .65) return;
    const phaseScale = fighter.attackPhase === 'active' ? 1 : .68;
    const force = computeStrikeForce(sourcePosition, targetPosition, source.linvel(), target.linvel(), source.mass(), profile);
    source.addForce({ x: force.x * phaseScale, y: force.y * phaseScale, z: force.z * phaseScale }, true);
    const planarDistance = Math.max(.001, Math.hypot(targetPosition.x - sourcePosition.x, targetPosition.z - sourcePosition.z));
    this.applyRigAcceleration(rig, {
      x: (targetPosition.x - sourcePosition.x) / planarDistance * profile.pelvisAcceleration * phaseScale,
      y: 0,
      z: (targetPosition.z - sourcePosition.z) / planarDistance * profile.pelvisAcceleration * phaseScale,
    });
    if (fighter.moveId === 'aerial') {
      const chest = rig.bodies.chest;
      chest?.addForce({ x: force.x * .6, y: Math.min(0, force.y * .35), z: force.z * .6 }, true);
    }
  }

  private applyRopeController(rig: FighterRigRegistration, fighter: FighterRuntime, model: MatchModel): void {
    const pelvis = rig.bodies.pelvis; if (!pelvis || ['airborne', 'downed', 'defeated', 'climbing'].includes(fighter.state)) { rig.ropeContact = null; return; }
    const position = pelvis.translation(); const velocity = pelvis.linvel();
    // The ropes resist a wrestler leaving the raised ring, not someone who is
    // already working on the ringside floor. Reapplying the spring from the
    // outside pulled wrestlers through the apron and made ringside grapples
    // impossible; returning is owned by the explicit apron transition.
    if (isRingside({ x: position.x, z: position.z }) && !rig.ropeContact) { rig.ropeContact = null; return; }
    const response = solveRopeResponse({ x: position.x, z: position.z }, { x: velocity.x, z: velocity.z }, model.chaosEvent?.type === 'OVERDRIVE ROPES');
    if (response.engaged) {
      const hardLimit = response.axis === 'x' ? RING_HARD_LIMIT.x : RING_HARD_LIMIT.z;
      const axisPosition = response.axis === 'x' ? position.x : position.z;
      const overshoot = Math.max(0, Math.abs(axisPosition) - hardLimit);
      if (overshoot > 0) {
        // Penetration correction is an elastic velocity response, never a body
        // teleport. The stiffness rises over the final travel band and the
        // opposite impulse is distributed over the full articulated mass.
        const center = this.rigPlanarCenter(rig);
        const currentAxisSpeed = response.axis === 'x' ? center.velocityX : center.velocityZ;
        const inwardSpeed = Math.max(2.8, Math.min(8.2, response.outwardSpeed * .58 + response.compression * 3.2 + overshoot * 18));
        this.applyRigVelocityDelta(rig, response.axis === 'x'
          ? { x: -response.side * inwardSpeed - currentAxisSpeed, y: 0, z: 0 }
          : { x: 0, y: 0, z: -response.side * inwardSpeed - currentAxisSpeed });
      }
      const center = this.rigPlanarCenter(rig);
      this.applyRigAcceleration(rig, { x: response.force.x / Math.max(.001, center.mass), y: 0, z: response.force.z / Math.max(.001, center.mass) });
      if (!rig.ropeContact || rig.ropeContact.axis !== response.axis || rig.ropeContact.side !== response.side) {
        rig.ropeContact = { axis: response.axis, side: response.side, peakCompression: response.compression, entrySpeed: response.outwardSpeed };
        if (response.outwardSpeed > 1.55) {
          fighter.body.balance = clamp(fighter.body.balance - response.outwardSpeed * .8, 0, 100);
        }
      } else {
        rig.ropeContact.peakCompression = Math.max(rig.ropeContact.peakCompression, response.compression);
        rig.ropeContact.entrySpeed = Math.max(rig.ropeContact.entrySpeed, response.outwardSpeed);
      }
      const contact = rig.ropeContact;
      const axisVelocity = (response.axis === 'x' ? center.velocityX : center.velocityZ) * response.side;
      if (contact && axisVelocity < -.42 && response.compression < contact.peakCompression - .025) {
        this.releaseRopeRebound(rig, fighter, model, contact);
      }
      return;
    }
    const contact = rig.ropeContact;
    if (!contact) return;
    this.releaseRopeRebound(rig, fighter, model, contact);
  }

  private releaseRopeRebound(rig: FighterRigRegistration, fighter: FighterRuntime, model: MatchModel, contact: NonNullable<FighterRigRegistration['ropeContact']>): void {
    const releaseSpeed = clamp(2.9 + contact.entrySpeed * .58 + contact.peakCompression * 6.4, 3.2, model.chaosEvent?.type === 'OVERDRIVE ROPES' ? 9 : 7.45);
    const center = this.rigPlanarCenter(rig);
    const desiredX = contact.axis === 'x' ? -contact.side * Math.max(releaseSpeed, Math.abs(center.velocityX)) : center.velocityX;
    const desiredZ = contact.axis === 'z' ? -contact.side * Math.max(releaseSpeed, Math.abs(center.velocityZ)) : center.velocityZ;
    this.applyRigVelocityDelta(rig, { x: desiredX - center.velocityX, y: 0, z: desiredZ - center.velocityZ });
    // The special strike window belongs to the inward run, not the compression
    // phase. Opening it on first rope contact let players throw the stiff-arm
    // while still travelling out of the ring and made the move miss by design.
    fighter.ropeRebound = 1.65;
    rig.ropeContact = null;
  }

  private syncPhysicalProps(world: World, model: MatchModel): void {
    const jointData = this.jointData; if (!jointData) return;
    for (const [propId, registration] of this.props) {
      const prop = model.props.find((candidate) => candidate.id === propId);
      const existing = this.propGrips.get(propId);
      if (!prop || prop.broken) {
        if (existing) this.releasePropGrip(world, existing, null);
        continue;
      }
      if (!prop.heldBy) {
        if (existing) this.releasePropGrip(world, existing, model);
        continue;
      }
      if (existing && existing.owner !== prop.heldBy) this.releasePropGrip(world, existing, null);
      if (this.propGrips.has(propId)) continue;
      const rig = this.rigs.get(prop.heldBy); const hand = rig?.bodies.rightHand; const body = registration.body;
      if (!hand || !body.isValid()) continue;
      const handPosition = hand.translation(); const propPosition = body.translation();
      const dx = handPosition.x - propPosition.x; const dy = handPosition.y - propPosition.y; const dz = handPosition.z - propPosition.z;
      const distance = Math.max(.001, Math.hypot(dx, dy, dz));
      if (distance > .52) {
        const handVelocity = hand.linvel(); const propVelocity = body.linvel(); const desiredSpeed = clamp(distance * 9, 2.4, 7.2);
        const force = {
          x: clamp((handVelocity.x + dx / distance * desiredSpeed - propVelocity.x) * body.mass() * 15, -260, 260),
          y: clamp((handVelocity.y + dy / distance * desiredSpeed - propVelocity.y) * body.mass() * 15, -260, 260),
          z: clamp((handVelocity.z + dz / distance * desiredSpeed - propVelocity.z) * body.mass() * 15, -260, 260),
        };
        body.addForce(force, true); hand.addForce({ x: -force.x * .12, y: -force.y * .12, z: -force.z * .12 }, true);
        continue;
      }
      const propAnchor = registration.kind === 'chair' ? { x: 0, y: -.42, z: .2 } : registration.kind === 'trash' ? { x: 0, y: -.48, z: 0 } : { x: 0, y: -.25, z: 0 };
      const joint = world.createImpulseJoint(jointData.spherical({ x: 0, y: 0, z: 0 }, propAnchor), hand, body, true);
      joint.setContactsEnabled(false);
      this.propGrips.set(propId, { propId, owner: prop.heldBy, joint });
      this.metrics.propGripCount = this.propGrips.size;
      this.metrics.jointCount = this.rigs.size * 15 + this.propGrips.size;
    }
  }

  private releasePropGrip(world: World, grip: PhysicalPropGrip, model: MatchModel | null): void {
    const registration = this.props.get(grip.propId); const rig = this.rigs.get(grip.owner); const hand = rig?.bodies.rightHand;
    if (grip.joint.isValid()) world.removeImpulseJoint(grip.joint, true);
    this.propGrips.delete(grip.propId);
    this.metrics.propGripCount = this.propGrips.size;
    this.metrics.jointCount = this.rigs.size * 15 + this.propGrips.size;
    if (!model || !registration?.body.isValid() || !hand) return;
    const fighter = model[grip.owner]; const current = registration.body.linvel(); const handVelocity = hand.linvel(); const throwSpeed = registration.kind === 'chair' ? 7.2 : 8.7;
    if (fighter.moveId === 'prop_throw') this.releasedPropAttacks.set(grip.propId, { owner: grip.owner, attackInstanceId: fighter.attackInstanceId, moveId: 'prop_throw', expiresAt: model.elapsed + 1.05 });
    registration.body.setLinvel({
      x: current.x * .28 + handVelocity.x * .72 + Math.sin(fighter.facing) * throwSpeed,
      y: Math.max(1.8, current.y * .3 + handVelocity.y * .7 + 1.7),
      z: current.z * .28 + handVelocity.z * .72 + Math.cos(fighter.facing) * throwSpeed,
    }, true);
    registration.body.setAngvel(registration.kind === 'chair' ? { x: 5.2, y: 2.7, z: -4.4 } : { x: 2.2, y: 3.8, z: 6.4 }, true);
  }

  private capRigVelocity(rig: FighterRigRegistration): void {
    for (const body of Object.values(rig.bodies)) {
      if (!body?.isValid()) continue;
      body.resetForces(true); body.resetTorques(true);
      const linear = body.linvel(); const linearSpeed = Math.hypot(linear.x, linear.y, linear.z);
      if (linearSpeed > 12) { const scale = 12 / linearSpeed; body.setLinvel({ x: linear.x * scale, y: linear.y * scale, z: linear.z * scale }, true); }
      const angular = body.angvel(); const angularSpeed = Math.hypot(angular.x, angular.y, angular.z);
      if (angularSpeed > 24) { const scale = 24 / angularSpeed; body.setAngvel({ x: angular.x * scale, y: angular.y * scale, z: angular.z * scale }, true); }
    }
  }

  private advancePhysicalGrapple(world: World, model: MatchModel, dt: number): void {
    if (!this.jointData) return;
    const grapple = model.grapple;
    if (!grapple) { this.releaseAllGrips(world); this.grappleEnvironmentTarget = null; return; }
    const attacker = model[grapple.attacker]; const defender = model[grapple.defender]; const attackerRig = this.rigs.get(grapple.attacker); const defenderRig = this.rigs.get(grapple.defender);
    if (!attackerRig || !defenderRig || !attacker.moveId || !['grappling', 'attacking'].includes(attacker.state)) { this.releaseAllGrips(world); this.grappleEnvironmentTarget = null; model.grapple = null; return; }
    const move = getMove(attacker.moveId); grapple.age += dt;
    if (grapple.phase === 'impact' || grapple.phase === 'release') return;
    const environmentTargetMatches = this.grappleEnvironmentTarget?.attacker === grapple.attacker
      && this.grappleEnvironmentTarget.defender === grapple.defender
      && this.grappleEnvironmentTarget.attackInstanceId === attacker.attackInstanceId;
    if (!environmentTargetMatches) {
      const table = model.props.find((prop) => prop.kind === 'table' && !prop.broken);
      const tableDistance = table ? Math.hypot(table.position.x - defender.position.x, table.position.z - defender.position.z) : Number.POSITIVE_INFINITY;
      if (move.id === 'corner_smash') {
        this.grappleEnvironmentTarget = { attacker: grapple.attacker, defender: grapple.defender, attackInstanceId: attacker.attackInstanceId, surface: 'turnbuckle', position: { x: Math.sign(defender.position.x || attacker.position.x || 1) * 5.35, z: Math.sign(defender.position.z || attacker.position.z || 1) * 3.85 } };
      } else {
        this.grappleEnvironmentTarget = table && tableDistance <= 2.6 && (isRingside(attacker.position) || isRingside(defender.position))
          ? { attacker: grapple.attacker, defender: grapple.defender, attackInstanceId: attacker.attackInstanceId, surface: 'table', position: { ...table.position } }
          : null;
      }
    }
    // A directional follow-up changes the throw without releasing the physical
    // collar-and-elbow lock. Grips belong to the grapple session, not the
    // currently selected move, so the same hands can flow from lock-up to slam.
    const owned = this.grips.filter((grip) => grip.attacker === grapple.attacker);
    if (owned.length < 2) {
      grapple.phase = owned.length === 0 ? 'reach' : 'acquire';
      let nearestGripDistance = Number.POSITIVE_INFINITY;
      const attackerCenter = this.rigPlanarCenter(attackerRig); const defenderCenter = this.rigPlanarCenter(defenderRig);
      const centerX = defenderCenter.x - attackerCenter.x; const centerZ = defenderCenter.z - attackerCenter.z;
      const centerDistance = Math.max(.001, Math.hypot(centerX, centerZ)); const centerNormalX = centerX / centerDistance; const centerNormalZ = centerZ / centerDistance;
      const closingSpeed = (defenderCenter.velocityX - attackerCenter.velocityX) * centerNormalX + (defenderCenter.velocityZ - attackerCenter.velocityZ) * centerNormalZ;
      const approachAcceleration = clamp((centerDistance - .82) * 7.5 + closingSpeed * 1.8, -2.2, 4.6);
      this.applyRigAcceleration(attackerRig, { x: centerNormalX * approachAcceleration * .58, y: 0, z: centerNormalZ * approachAcceleration * .58 });
      this.applyRigAcceleration(defenderRig, { x: -centerNormalX * approachAcceleration * .42, y: 0, z: -centerNormalZ * approachAcceleration * .42 });
      const preferences: readonly [BodySegmentId, BodySegmentId, number][] = gripPreferences(move.id);
      for (const [handId, targetId, targetAnchorX] of preferences) {
        if (this.grips.some((grip) => grip.attacker === grapple.attacker && grip.hand === handId)) continue;
        const hand = attackerRig.bodies[handId]; const target = defenderRig.bodies[targetId]; if (!hand || !target) continue;
        const handPosition = hand.translation(); const targetPosition = bodySurfaceAnchorWorld(target, targetAnchorX, handPosition, targetId);
        const delta = { x: targetPosition.x - handPosition.x, y: targetPosition.y - handPosition.y, z: targetPosition.z - handPosition.z };
        const distance = Math.hypot(delta.x, delta.y, delta.z);
        nearestGripDistance = Math.min(nearestGripDistance, distance);
        if (distance > 2) continue;
        const acquiredHands = this.grips.filter((grip) => grip.attacker === grapple.attacker).length;
        // The first hand establishes the collar tie and can rotate two large
        // articulated bodies a few centimetres apart. Give the second hand a
        // slightly wider catch envelope so a visually valid two-hand lock does
        // not fail because the first constraint moved the hips mid-frame.
        // Surface-to-hand tolerance: the first hand establishes a collar tie;
        // the second closes the elbow side once the bodies are physically
        // coupled. These are measured from collider surfaces, not body centres.
        const catchDistance = acquiredHands > 0 ? 1.1 : 1.04;
        if (distance > catchDistance) {
          // Reach is a compliant hand-to-anchor spring. It may guide the hand,
          // but cannot create a grip until the visible bodies are genuinely
          // close. Equal and opposite force keeps the acquisition physical.
          const handVelocity = hand.linvel(); const targetVelocity = target.linvel();
          const reachForce = {
            x: clamp(delta.x * 145 - (handVelocity.x - targetVelocity.x) * 18, -210, 210),
            y: clamp(delta.y * 145 - (handVelocity.y - targetVelocity.y) * 18, -210, 210),
            z: clamp(delta.z * 145 - (handVelocity.z - targetVelocity.z) * 18, -210, 210),
          };
          const forceMagnitude = Math.hypot(reachForce.x, reachForce.y, reachForce.z);
          const forceScale = forceMagnitude > 190 ? 190 / forceMagnitude : 1;
          hand.addForce({ x: reachForce.x * forceScale, y: reachForce.y * forceScale, z: reachForce.z * forceScale }, true);
          target.addForce({ x: -reachForce.x * forceScale, y: -reachForce.y * forceScale, z: -reachForce.z * forceScale }, true);
          continue;
        }
        // Two hard cross-rig joints form a closed constraint loop through both
        // articulated skeletons. Rapier can resolve that loop with positional
        // corrections large enough to launch a wrestler even after velocity
        // clamping. A bounded spring grip keeps the hands physically coupled
        // without adding a singular loop to the solver graph.
        this.metrics.gripCreateCount += 1;
        const ownerTask = this.tasks.active(grapple.attacker); const gripId = `${grapple.attacker}:${attacker.attackInstanceId}:${handId}`;
        this.grips.push({ id: gripId, ownerTaskId: ownerTask?.id ?? 'unowned', attacker: grapple.attacker, defender: grapple.defender, hand: handId, target: targetId, targetAnchorX, moveId: move.id, strength: gripCapacity(attacker), createdAt: model.elapsed });
        this.tasks.ownGrip(grapple.attacker, gripId);
      }
      this.metrics.nearestGripDistance = Number.isFinite(nearestGripDistance) ? nearestGripDistance : 0;
    }
    const activeGrips = this.grips.filter((grip) => grip.attacker === grapple.attacker);
    let sessionMaximumError = 0; let sessionMaximumLoad = 0;
    for (const grip of activeGrips) {
      const hand = attackerRig.bodies[grip.hand]; const target = defenderRig.bodies[grip.target];
      if (!hand || !target) { this.removeGrip(world, grip, 'missing-body'); continue; }
      const handPosition = hand.translation(); const targetPosition = bodySurfaceAnchorWorld(target, grip.targetAnchorX, handPosition, grip.target); const error = Math.hypot(handPosition.x - targetPosition.x, handPosition.y - targetPosition.y, handPosition.z - targetPosition.z);
      const handVelocity = hand.linvel(); const targetVelocity = target.linvel();
      const relativeVelocity = { x: targetVelocity.x - handVelocity.x, y: targetVelocity.y - handVelocity.y, z: targetVelocity.z - handVelocity.z };
      const load = Math.hypot(relativeVelocity.x, relativeVelocity.y, relativeVelocity.z) * defender.body.mass / 100;
      sessionMaximumError = Math.max(sessionMaximumError, error); sessionMaximumLoad = Math.max(sessionMaximumLoad, load);
      this.metrics.maximumGripError = Math.max(this.metrics.maximumGripError, error); this.metrics.maximumGripLoad = Math.max(this.metrics.maximumGripLoad, load);
      // A completed collar-and-elbow tie must survive the authored load phase.
      // The previous limits were below the normal inertial load of two
      // heavyweight rigs and caused hands to pop free before a slam could
      // reach its active frame.
      const acquisitionGrace = model.elapsed - grip.createdAt < 1.05;
      if (!['grappling', 'attacking'].includes(attacker.state)) this.removeGrip(world, grip, 'incompatible-state');
      // A secured environmental spot remains a real force-held clinch, but it
      // is no longer cancelled by the generic free-wrestling escape threshold
      // while both bodies are coherently travelling to the same surface. The
      // explicit grip-break lab path has no environment target and still
      // exercises both error and load failures.
      else if (!acquisitionGrace && !environmentTargetMatches && error > 1.2) this.removeGrip(world, grip, 'anchor-error');
      else if (!acquisitionGrace && !environmentTargetMatches && load > grip.strength * 58) this.removeGrip(world, grip, 'load-break');
      else {
        const dx = targetPosition.x - handPosition.x; const dy = targetPosition.y - handPosition.y; const dz = targetPosition.z - handPosition.z;
        const capacity = 190 + grip.strength * 230;
        const requested = {
          x: dx * 210 + relativeVelocity.x * 22,
          y: dy * 210 + relativeVelocity.y * 22,
          z: dz * 210 + relativeVelocity.z * 22,
        };
        const magnitude = Math.hypot(requested.x, requested.y, requested.z); const scale = magnitude > capacity ? capacity / magnitude : 1;
        const force = { x: requested.x * scale, y: requested.y * scale, z: requested.z * scale };
        hand.addForce(force, true); target.addForce({ x: -force.x, y: -force.y, z: -force.z }, true);
      }
    }
    if (activeGrips.length > 0) {
      const attackerCenter = this.rigPlanarCenter(attackerRig); const defenderCenter = this.rigPlanarCenter(defenderRig);
      const dx = defenderCenter.x - attackerCenter.x; const dz = defenderCenter.z - attackerCenter.z;
      const distance = Math.max(.001, Math.hypot(dx, dz)); const nx = dx / distance; const nz = dz / distance;
      const relativeSpeed = (defenderCenter.velocityX - attackerCenter.velocityX) * nx + (defenderCenter.velocityZ - attackerCenter.velocityZ) * nz;
      const acceleration = clamp((distance - .78) * 11 + relativeSpeed * 2.4, -3.5, 9.5);
      this.applyRigAcceleration(attackerRig, { x: nx * acceleration * .62, y: 0, z: nz * acceleration * .62 });
      this.applyRigAcceleration(defenderRig, { x: -nx * acceleration * .38, y: 0, z: -nz * acceleration * .38 });
    }
    grapple.gripCount = this.grips.filter((grip) => grip.attacker === grapple.attacker).length;
    const attackerIntent = this.intents[grapple.attacker]; const defenderIntent = this.intents[grapple.defender];
    const attackerDrive = attacker.body.mass * (.72 + fighterPower(attacker) * .68) * (.62 + attacker.body.muscle * .38);
    const defenderDefinition = fighterById(defender.definitionId);
    const defenderDrive = defender.body.mass * (.7 + defenderDefinition.stats.technique / 230) * (.62 + defender.body.muscle * .38);
    grapple.leverage = clamp(attackerDrive / Math.max(1, defenderDrive), .35, 2.2);
    grapple.struggle = clamp(grapple.struggle + (Math.hypot(defenderIntent.move.x, defenderIntent.move.z) * .8 - Math.hypot(attackerIntent.move.x, attackerIntent.move.z) * .28 - .08) * dt, 0, 1);
    grapple.tension = clamp(sessionMaximumError * .72 + sessionMaximumLoad / 18 + grapple.struggle * .24, 0, 1);
    this.metrics.gripCount = this.grips.length; this.metrics.jointCount = this.rigs.size * 15 + this.propGrips.size;
    if (grapple.gripCount < 2) {
      if (grapple.age > 2.25) {
        grapple.phase = 'failed'; this.releaseAllGrips(world); this.grappleEnvironmentTarget = null; model.grapple = null;
        attacker.state = 'staggered'; attacker.stateElapsed = 0; attacker.moveId = null; attacker.attackPhase = null;
        if (defender.state === 'grabbed') defender.state = 'idle';
        model.announcement = 'GRIP DENIED — SCRAMBLE!'; model.announcementTimer = .9;
      }
      return;
    }
    if (grapple.phase === 'reach' || grapple.phase === 'acquire') grapple.age = 0;
    if (defender.state !== 'grabbed') { defender.state = 'grabbed'; defender.stateElapsed = 0; }
    const progress = clamp(attacker.phaseElapsed / Math.max(.01, move.anticipationDuration), 0, 1);
    const liftFeasibility = clamp((attacker.body.mass * (.55 + fighterPower(attacker) * .55) * attacker.body.muscle) / Math.max(55, defender.body.mass), .42, 1.45);
    const defenderPelvis = defenderRig.bodies.pelvis; const defenderChest = defenderRig.bodies.chest; const attackerPelvis = attackerRig.bodies.pelvis;
    if (!defenderPelvis || !defenderChest || !attackerPelvis) return;
    const attackerPosition = attackerPelvis.translation(); const defenderPosition = defenderPelvis.translation();
    const separationX = defenderPosition.x - attackerPosition.x; const separationZ = defenderPosition.z - attackerPosition.z; const planarSeparation = Math.max(.001, Math.hypot(separationX, separationZ));
    grapple.rotation = Math.atan2(separationX, separationZ) - attacker.facing;
    grapple.lift = Math.max(0, defenderPosition.y - attackerPosition.y);
    const environmentTarget = this.grappleEnvironmentTarget?.attacker === grapple.attacker
      && this.grappleEnvironmentTarget.defender === grapple.defender
      && this.grappleEnvironmentTarget.attackInstanceId === attacker.attackInstanceId
      ? this.grappleEnvironmentTarget : null;
    // Do not drag a planted wrestler through a table or turnbuckle during the
    // clinch.  Environmental travel begins only after the physical lift has
    // unloaded the feet.
    if (environmentTarget && progress > .52) {
      const center = this.rigPlanarCenter(defenderRig); const dx = environmentTarget.position.x - center.x; const dz = environmentTarget.position.z - center.z;
      const distance = Math.hypot(dx, dz);
      if (distance > .18) {
        const desiredSpeed = clamp(distance / .8, .2, 2.4);
        const desiredX = dx / distance * desiredSpeed; const desiredZ = dz / distance * desiredSpeed;
        this.applyRigVelocityDelta(defenderRig, {
          x: clamp(desiredX - center.velocityX, -.08, .08),
          y: 0,
          z: clamp(desiredZ - center.velocityZ, -.08, .08),
        });
        // The attacker walks the secured clinch toward the furniture instead
        // of becoming an immovable anchor. Moving both articulated rigs at a
        // shared bounded velocity preserves the real hand grips until release.
        const attackerCenter = this.rigPlanarCenter(attackerRig);
        this.applyRigVelocityDelta(attackerRig, {
          x: clamp(desiredX - attackerCenter.velocityX, -.08, .08),
          y: 0,
          z: clamp(desiredZ - attackerCenter.velocityZ, -.08, .08),
        });
      }
    }
    if (progress < .38) grapple.phase = 'clinch';
    else if (progress < .56) grapple.phase = 'load';
    else if (attacker.attackPhase === 'anticipation') {
      grapple.phase = 'lift';
      const liftDrive = liftDriveForMove(move.id) * liftFeasibility;
      this.applyRigAcceleration(defenderRig, { x: 0, y: 36 + liftDrive * 20, z: 0 });
      const coherentLiftDelta = clamp(3.15 - defenderPelvis.linvel().y, 0, .18);
      if (coherentLiftDelta > 0) this.applyRigVelocityDelta(defenderRig, { x: 0, y: coherentLiftDelta, z: 0 });
      defenderChest.addForce({ x: Math.sin(attacker.facing) * defenderChest.mass() * liftDrive * 2.1, y: defenderChest.mass() * liftDrive * 12, z: Math.cos(attacker.facing) * defenderChest.mass() * liftDrive * 2.1 }, true);
      defenderPelvis.applyTorqueImpulse({ x: move.id === 'suplex' || move.id === 'skyhook' ? -.032 * liftDrive : .018 * liftDrive, y: 0, z: (grapple.position === 'overhook' ? .028 : -.018) * liftDrive }, true);
      this.applyRigAcceleration(attackerRig, { x: 0, y: -12, z: 0 });
    }
    if (grapple.phase === 'clinch' || grapple.phase === 'load') {
      const braceX = separationX / planarSeparation; const braceZ = separationZ / planarSeparation; const shuffle = Math.sin(grapple.age * 18) * (grapple.phase === 'load' ? 1 : .55);
      for (const [footId, side] of [['leftFoot', -1], ['rightFoot', 1]] as const) {
        const foot = defenderRig.bodies[footId]; if (!foot) continue;
        foot.addForce({ x: (braceX * 11 + braceZ * shuffle * side * 4.5) * foot.mass(), y: 0, z: (braceZ * 11 - braceX * shuffle * side * 4.5) * foot.mass() }, true);
      }
    }
    if (attacker.attackPhase === 'active') {
      grapple.phase = 'release';
      this.releaseAllGrips(world);
      // A held direction during the release is the player's throw direction.
      // Fall back to the live clinch axis for a neutral throw; animated facing
      // can auto-turn during a load and is not physical authority here.
      const inputLength = Math.hypot(attackerIntent.move.x, attackerIntent.move.z);
      const liveSeparation = Math.hypot(separationX, separationZ);
      const inputDirection = inputLength > .25
        ? { x: attackerIntent.move.x / inputLength, z: attackerIntent.move.z / inputLength }
        : liveSeparation > .15
          ? { x: separationX / planarSeparation, z: separationZ / planarSeparation }
          : { x: Math.sin(attacker.facing), z: Math.cos(attacker.facing) };
      const environmentDelta = environmentTarget ? { x: environmentTarget.position.x - defenderPosition.x, z: environmentTarget.position.z - defenderPosition.z } : null;
      const environmentDistance = environmentDelta ? Math.hypot(environmentDelta.x, environmentDelta.z) : Number.POSITIVE_INFINITY;
      const environmentTargeted = Boolean(environmentDelta && environmentTarget);
      const direction = environmentTargeted && environmentDelta && environmentDistance > .08
        ? { x: environmentDelta.x / environmentDistance, z: environmentDelta.z / environmentDistance }
        : inputDirection;
      const horizontalReleaseSpeed = environmentTargeted ? clamp(environmentDistance / (environmentTarget?.surface === 'turnbuckle' ? .64 : .48), .06, environmentTarget?.surface === 'turnbuckle' ? 6.8 : 7.5) : .9;
      // Release into a brief upward clearance and one shared angular velocity.
      // The pending-landing controller owns the subsequent fall, so feet do
      // not catch the mat before the torso can rotate through the impact.
      for (const body of Object.values(defenderRig.bodies)) {
        if (!body?.isValid()) continue;
        const mass = body.mass(); const velocity = body.linvel();
        body.applyImpulse({ x: (direction.x * horizontalReleaseSpeed - velocity.x) * mass, y: (2.8 - velocity.y) * mass, z: (direction.z * horizontalReleaseSpeed - velocity.z) * mass }, true);
      }
      const fallTorque = { x: direction.z, z: -direction.x };
      for (const body of Object.values(defenderRig.bodies)) {
        if (!body?.isValid()) continue;
        const spin = body.angvel();
        body.setAngvel({ x: fallTorque.x * 5.6 + spin.x * .12, y: spin.y * .12, z: fallTorque.z * 5.6 + spin.z * .12 }, true);
      }
      const attackerVelocity = attackerPelvis.linvel();
      attackerPelvis.setLinvel({ x: attackerVelocity.x * .28, y: Math.max(0, attackerVelocity.y * .2), z: attackerVelocity.z * .28 }, true);
      attackerPelvis.setAngvel({ x: 0, y: attackerPelvis.angvel().y * .25, z: 0 }, true);
      defender.state = 'airborne'; defender.stateElapsed = 0; defender.downTimer = 1.5 + (100 - defender.health) / 85;
      this.pendingLandings.set(grapple.defender, {
        attacker: grapple.attacker, defender: grapple.defender, attackInstanceId: attacker.attackInstanceId, moveId: move.id,
        releasedAt: model.elapsed, expiresAt: model.elapsed + (environmentTargeted ? 4.1 : 2.2),
        targetSurface: environmentTargeted && environmentTarget ? environmentTarget.surface : null, targetPosition: environmentTargeted && environmentTarget ? { ...environmentTarget.position } : null,
      });
      this.grappleEnvironmentTarget = null;
      grapple.phase = 'impact'; grapple.gripCount = 0;
    }
  }

  private removeGrip(_world: World, grip: PhysicalGrip, reason = 'release'): void {
    const index = this.grips.indexOf(grip); if (index >= 0) this.grips.splice(index, 1);
    this.tasks.releaseGrip(grip.attacker, grip.id);
    this.metrics.lastGripBreakReason = reason;
  }

  private releaseAllGrips(world: World): void { for (const grip of [...this.grips]) this.removeGrip(world, grip); this.metrics.gripCount = 0; this.metrics.jointCount = this.rigs.size * 15 + this.propGrips.size; }

  private applyPoseDrive(rig: FighterRigRegistration, fighter: FighterRuntime, motorProfile: MotorProfile, overridePose?: Pose): void {
    const definition = fighterById(fighter.definitionId);
    const fatigue = 1 - fighter.body.muscle;
    const pose = overridePose ?? targetPoseFor(fighter); const targets = physicalPoseTargets(pose, fighter.facing);
    for (const [segment, body] of Object.entries(rig.bodies) as [BodySegmentId, RapierRigidBody][]) {
      // Locked neutral limbs are constraint-stabilized and need no motor. A
      // motor fighting a disabled rotation cannot animate the limb; it only
      // hammers Rapier's limit and was the source of the old standing buzz.
      if (segment !== 'pelvis' && !rig.rotationallyDynamic.has(segment)) continue;
      if (segment === 'pelvis' && motorProfile.rootMode !== 'physical') continue;
      const chain = motorProfile.chains[motorChainForSegment(segment)];
      const pelvisScale = segment === 'pelvis' ? 1.28 : 1;
      const stiffnessScale = definition.physics.jointStiffness * pelvisScale;
      // Small distal bodies have very little inertia. A human-scale motor cap
      // therefore scales with segment mass; applying a torso-sized impulse to
      // a hand or upper arm produces solver-speed vibration even when the
      // abstract profile value is bounded.
      const torquePerKg = segment.includes('UpperArm') ? 140
        : segment.includes('Forearm') ? 90
        : segment.includes('Hand') ? 60
        : segment.includes('Thigh') ? 14
        : segment.includes('Shin') || segment.includes('Foot') ? 10
        : segment === 'head' ? 5
        : 6.5;
      const massTorqueCap = body.mass() * torquePerKg;
      const maximumTorque = Math.min(chain.maximumTorque * stiffnessScale, massTorqueCap);
      const torque = computeMotorTorque(body.rotation(), targets[segment], body.angvel(), { x: 0, y: 0, z: 0 }, {
        stiffness: chain.stiffness * stiffnessScale,
        damping: chain.damping * stiffnessScale,
        maxTorque: maximumTorque,
        strength: motorStrengthFor(fighter, motorProfile, segment),
        fatigue,
      });
      const requestedMagnitude = Math.hypot(torque.x, torque.y, torque.z);
      if (requestedMagnitude >= maximumTorque * .985) {
        this.metrics.motorSaturationCount += 1;
        this.metrics.currentMotorSaturations += 1;
      }
      const impulse = { x: torque.x * this.currentFixedDt, y: torque.y * this.currentFixedDt, z: torque.z * this.currentFixedDt };
      body.applyTorqueImpulse(impulse, true);
      const parentId = SEGMENT_PARENT[segment]; const parent = parentId ? rig.bodies[parentId] : null;
      if (parent?.isValid()) parent.applyTorqueImpulse({ x: -impulse.x, y: -impulse.y, z: -impulse.z }, true);
    }
  }

  afterFixedStep(model: MatchModel): void {
    if (this.stepStartedAt >= 0) this.recordStepDuration(performance.now() - this.stepStartedAt);
    this.stepStartedAt = -1;
    if (model.paused) return;
    for (const rig of this.rigs.values()) this.capRigVelocity(rig);
    this.refreshPendingLandingContacts(model);
    this.refreshPhysicalSupportContacts();
    this.inspectNumericalHealth();
    this.containRigsToArena(model);
    this.syncFighter('player', model.player);
    this.syncFighter('opponent', model.opponent);
    this.replayAccumulator += this.currentFixedDt;
    if (this.replayAccumulator >= 1 / 30) {
      this.replayAccumulator %= 1 / 30;
      this.captureReplayFrame(model.elapsed);
    }
  }

  /**
   * Read the solved Rapier manifold for committed environmental landings.
   * React contact-force callbacks remain useful for ordinary strikes, but a
   * short fixed-body impact may begin and settle between rendered commits.
   * The narrow phase is the authoritative source for table/turnbuckle truth.
   */
  private refreshPendingLandingContacts(model: MatchModel): void {
    const world = this.world; if (!world || this.pendingLandings.size === 0) return;
    for (const [defender, landing] of [...this.pendingLandings]) {
      if (!landing.targetSurface) continue;
      const rig = this.rigs.get(defender); const surface = [...this.landingSurfaces.values()].find((candidate) => candidate.kind === landing.targetSurface);
      if (!rig || !surface?.body.isValid()) continue;
      let recorded = false;
      for (const segment of ['chest', 'abdomen', 'pelvis', 'head'] as const) {
        const body = rig.bodies[segment]; if (!body?.isValid() || body.numColliders() === 0) continue;
        const sourceCollider = body.collider(0);
        for (let index = 0; index < surface.body.numColliders(); index += 1) {
          const targetCollider = surface.body.collider(index); let totalImpulse = 0; let maximumImpulse = 0; let point: Vector3Value | null = null; let direction: Vector3Value = { x: 0, y: 1, z: 0 };
          world.contactPair(sourceCollider, targetCollider, (manifold, flipped) => {
            const normal = manifold.normal(); direction = flipped ? { x: -normal.x, y: -normal.y, z: -normal.z } : { x: normal.x, y: normal.y, z: normal.z };
            for (let contact = 0; contact < manifold.numContacts(); contact += 1) {
              const impulse = Math.abs(manifold.contactImpulse(contact)); totalImpulse += impulse; maximumImpulse = Math.max(maximumImpulse, impulse);
            }
            if (manifold.numSolverContacts() > 0) point = manifold.solverContactPoint(0);
          });
          if (totalImpulse <= .0001) continue;
          const position = point ?? body.translation(); const velocity = body.linvel(); const fixedVelocity = surface.body.linvel();
          this.recordContact({
            time: model.elapsed, sourceFighter: defender, sourceSegment: segment, targetFighter: null, targetSegment: null, targetRegion: segment === 'abdomen' ? 'ribs' : segment,
            totalForce: totalImpulse / Math.max(1 / 240, this.currentFixedDt), maximumForce: maximumImpulse / Math.max(1 / 240, this.currentFixedDt),
            forceDirection: [direction.x, direction.y, direction.z], point: [position.x, position.y, position.z],
            relativeSpeed: Math.hypot(velocity.x - fixedVelocity.x, velocity.y - fixedVelocity.y, velocity.z - fixedVelocity.z),
            attackInstanceId: null, moveId: null, sourceObjectId: null, targetSurface: surface.kind, isLanding: false,
          });
          recorded = true; break;
        }
        if (recorded) break;
      }
    }
  }

  /**
   * Rebuild foot support from Rapier's solved contact manifolds. React event
   * callbacks can miss the initial overlap when a fighter and the mat mount in
   * the same commit, and an exit from one overlapping surface can otherwise
   * erase a second valid support. The narrow phase is the authority here.
   */
  private refreshPhysicalSupportContacts(): void {
    const world = this.world; if (!world) return;
    for (const rig of this.rigs.values()) {
      rig.supportContacts.clear();
      for (const footId of ['leftFoot', 'rightFoot'] as const) {
        const foot = rig.bodies[footId]; if (!foot?.isValid() || foot.numColliders() === 0) continue;
        const collider = foot.collider(0); let touching = false;
        world.contactPairsWith(collider, (other) => {
          if (touching) return;
          const otherParent = other.parent();
          if (otherParent) {
            let ownBody = false;
            for (const body of Object.values(rig.bodies)) {
              if (body?.isValid() && body.handle === otherParent.handle) { ownBody = true; break; }
            }
            if (ownBody) return;
          }
          world.contactPair(collider, other, (manifold) => {
            if (manifold.numSolverContacts() > 0 || manifold.numContacts() > 0) touching = true;
          });
        });
        if (touching) rig.supportContacts.add(footId);
      }
    }
  }

  private inspectNumericalHealth(): void {
    let currentMaximumJointSeparation = 0;
    for (const rig of this.rigs.values()) {
      rig.settlingFrames += 1;
      let bodyFault: NumericalFault | null = null;
      for (const [segment, body] of Object.entries(rig.bodies) as [BodySegmentId, RapierRigidBody][]) {
        if (!body?.isValid()) continue;
        bodyFault = inspectNumericalBody({ segment, position: body.translation(), rotation: body.rotation(), linearVelocity: body.linvel(), angularVelocity: body.angvel() });
        if (bodyFault) break;
      }
      let maximumJointExcess = 0;
      let jointFault: NumericalFault | null = null;
      for (const [parentId, childId] of JOINT_LINKS) {
        const parent = rig.bodies[parentId]; const child = rig.bodies[childId]; const parentRest = rig.restOffsets[parentId]; const childRest = rig.restOffsets[childId];
        if (!parent || !child || !parentRest || !childRest) continue;
        const halfY = (childRest.y - parentRest.y) * .5;
        const parentAnchor = rotatedLocalPoint(parent, { x: childRest.x - parentRest.x, y: halfY, z: childRest.z - parentRest.z });
        const childAnchor = rotatedLocalPoint(child, { x: 0, y: -halfY, z: 0 });
        const separation = Math.hypot(childAnchor.x - parentAnchor.x, childAnchor.y - parentAnchor.y, childAnchor.z - parentAnchor.z);
        maximumJointExcess = Math.max(maximumJointExcess, separation);
        jointFault ??= jointSeparationFault(childId, 0, separation);
      }
      currentMaximumJointSeparation = Math.max(currentMaximumJointSeparation, maximumJointExcess);
      // React/Rapier registers bodies one effect before all joint constraints
      // have completed their first solve. Ignore that bounded warm-up in the
      // historical maximum, but continue inspecting body finiteness at once.
      if (rig.settlingFrames > 12) this.metrics.maximumJointSeparation = Math.max(this.metrics.maximumJointSeparation, maximumJointExcess);
      if (bodyFault) {
        rig.jointFaultFrames += 1;
        this.metrics.numericalFaultCount += 1;
        this.metrics.lastNumericalFault = `${bodyFault.code}:${bodyFault.segment}:${Number.isFinite(bodyFault.value) ? bodyFault.value.toFixed(3) : 'nan'}`;
      } else if (jointFault) {
        rig.jointFaultFrames += 1;
        // A single solver frame above tolerance during a hard contact is not
        // a broken body tree. Report the episode only when the separation is
        // persistent, while the emergency path still watches every frame.
        if (rig.jointFaultFrames > 3 && !rig.jointFaultReported && rig.settlingFrames > 12) {
          rig.jointFaultReported = true;
          this.metrics.numericalFaultCount += 1;
          this.metrics.lastNumericalFault = `${jointFault.code}:${jointFault.segment}:${Number.isFinite(jointFault.value) ? jointFault.value.toFixed(3) : 'nan'}`;
        }
      } else {
        rig.jointFaultFrames = 0; rig.jointFaultReported = false;
        const center = this.rigPlanarCenter(rig); rig.lastSafeCenter = { x: center.x, z: center.z };
      }
    }
    this.metrics.currentJointSeparation = currentMaximumJointSeparation;
  }

  private containRigsToArena(model: MatchModel): void {
    const maximumX = VOLT_DOME.playable.halfWidth - .34; const maximumZ = VOLT_DOME.playable.halfDepth - .34;
    for (const key of ['player', 'opponent'] as const) {
      const rig = this.rigs.get(key); const pelvis = rig?.bodies.pelvis; if (!rig || !pelvis?.isValid()) continue;
      const pelvisPosition = pelvis.translation();
      let brokenTree = rig.jointFaultFrames > 45 || ![pelvisPosition.x, pelvisPosition.y, pelvisPosition.z].every(Number.isFinite);
      for (const body of Object.values(rig.bodies)) {
        if (!body?.isValid()) continue;
        const position = body.translation();
        if (![position.x, position.y, position.z].every(Number.isFinite)
          || Math.hypot(position.x - pelvisPosition.x, position.z - pelvisPosition.z) > 3.1
          || Math.abs(position.y - pelvisPosition.y) > 3.4) { brokenTree = true; break; }
      }
      if (brokenTree) {
        const modelPosition = model[key].position;
        const anchorX = clamp(Number.isFinite(pelvisPosition.x) ? rig.lastSafeCenter.x : modelPosition.x, -maximumX, maximumX);
        const anchorZ = clamp(Number.isFinite(pelvisPosition.z) ? rig.lastSafeCenter.z : modelPosition.z, -maximumZ, maximumZ);
        const anchorY = rig.restPelvisY - (isRingside({ x: anchorX, z: anchorZ }) ? 1.48 : 0);
        for (const [segment, body] of Object.entries(rig.bodies) as [BodySegmentId, RapierRigidBody][]) {
          if (!body?.isValid()) continue;
          const offset = rig.restOffsets[segment] ?? { x: 0, y: 0, z: 0 };
          body.setTranslation({ x: anchorX + offset.x, y: anchorY + offset.y, z: anchorZ + offset.z }, true);
          body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true); body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        }
        this.metrics.containmentCount += 1;
        this.metrics.emergencyResetCount += 1;
        this.metrics.lastNumericalFault = 'emergency-safe-reset';
        rig.jointFaultFrames = 0;
        continue;
      }
      const center = this.rigPlanarCenter(rig); const boundedX = clamp(center.x, -maximumX, maximumX); const boundedZ = clamp(center.z, -maximumZ, maximumZ);
      const dx = boundedX - center.x; const dz = boundedZ - center.z;
      if (Math.abs(dx) < .001 && Math.abs(dz) < .001) continue;
      for (const body of Object.values(rig.bodies)) {
        if (!body?.isValid()) continue;
        const velocity = body.linvel(); const desiredX = Math.abs(dx) > .001 ? clamp(dx * 8, -5.5, 5.5) : velocity.x; const desiredZ = Math.abs(dz) > .001 ? clamp(dz * 8, -5.5, 5.5) : velocity.z;
        body.applyImpulse({ x: (desiredX - velocity.x) * body.mass(), y: 0, z: (desiredZ - velocity.z) * body.mass() }, true);
      }
      this.metrics.containmentCount += 1;
    }
  }

  private captureReplayFrame(time: number): void {
    const fighters = { player: {}, opponent: {} } as Record<FighterKey, Partial<Record<BodySegmentId, { position: Vector3Value; rotation: QuaternionValue }>>>;
    for (const key of ['player', 'opponent'] as const) {
      const rig = this.rigs.get(key); if (!rig) continue;
      for (const [segment, body] of Object.entries(rig.bodies) as [BodySegmentId, RapierRigidBody][]) {
        if (!body.isValid()) continue;
        const position = body.translation(); const rotation = body.rotation();
        fighters[key][segment] = { position: { x: position.x, y: position.y, z: position.z }, rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w } };
      }
    }
    const props: Record<string, { position: Vector3Value; rotation: QuaternionValue }> = {};
    for (const [id, registration] of this.props) {
      if (!registration.body.isValid()) continue;
      const position = registration.body.translation(); const rotation = registration.body.rotation();
      props[id] = { position: { x: position.x, y: position.y, z: position.z }, rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w } };
    }
    this.replay.push({ time, fighters, props });
    const transformCount = Object.values(fighters).reduce((total, fighter) => total + Object.keys(fighter).length, 0) + Object.keys(props).length;
    this.metrics.replayEstimatedBytes = this.replay.size * (40 + transformCount * 72);
  }

  private supportScore(rig: FighterRigRegistration): number {
    let totalMass = 0; let centerX = 0; let centerZ = 0;
    for (const body of Object.values(rig.bodies)) {
      if (!body?.isValid()) continue;
      const mass = body.mass(); const position = body.translation(); totalMass += mass; centerX += position.x * mass; centerZ += position.z * mass;
    }
    if (totalMass <= 0 || rig.supportContacts.size === 0) return 0;
    centerX /= totalMass; centerZ /= totalMass;
    const feet = (['leftFoot', 'rightFoot'] as const).filter((id) => rig.supportContacts.has(id)).map((id) => rig.bodies[id]?.translation()).filter((value): value is { x: number; y: number; z: number } => Boolean(value));
    if (feet.length === 0) return 0;
    if (feet.length === 1) { const foot = feet[0]!; return clamp(1 - Math.hypot(centerX - foot.x, centerZ - foot.z) / .72, 0, 1); }
    const first = feet[0]!; const second = feet[1]!; const dx = second.x - first.x; const dz = second.z - first.z; const lengthSquared = dx * dx + dz * dz;
    const projection = lengthSquared > .0001 ? clamp(((centerX - first.x) * dx + (centerZ - first.z) * dz) / lengthSquared, 0, 1) : 0;
    const closestX = first.x + dx * projection; const closestZ = first.z + dz * projection;
    return clamp(1 - Math.hypot(centerX - closestX, centerZ - closestZ) / .82, 0, 1);
  }

  private syncFighter(key: FighterKey, fighter: FighterRuntime): void {
    const rig = this.rigs.get(key); const pelvis = rig?.bodies.pelvis; if (!rig || !pelvis) return;
    const position = pelvis.translation(); const velocity = pelvis.linvel(); const rotation = pelvis.rotation();
    if (![position.x, position.y, position.z, velocity.x, velocity.y, velocity.z].every(Number.isFinite)) { this.metrics.emergencyResetCount += 1; return; }
    const center = this.rigPlanarCenter(rig);
    fighter.position.x = center.x; fighter.position.z = center.z;
    fighter.velocity.x = center.velocityX; fighter.velocity.z = center.velocityZ;
    const upright = clamp(1 - (Math.abs(rotation.x) + Math.abs(rotation.z)) * 1.7, 0, 1);
    const supportScore = this.supportScore(rig); if (key === 'player') this.metrics.supportScore = supportScore;
    fighter.body.balance = clamp(supportScore * 58 + upright * 42 - Math.hypot(velocity.x, velocity.z) * 1.1, 0, 100);
    const groundedPelvisY = rig.restPelvisY - (isRingside(fighter.position) ? 1.46 : 0);
    fighter.body.verticalOffset = Math.max(0, position.y - groundedPelvisY);
    fighter.body.verticalVelocity = velocity.y;
    if (fighter.state === 'downed' && Math.hypot(velocity.x, velocity.y, velocity.z) < 1.6) {
      const chestRotation = rig.bodies.chest?.rotation() ?? rotation;
      const frontUp = 2 * (chestRotation.y * chestRotation.z - chestRotation.w * chestRotation.x);
      const rightUp = 2 * (chestRotation.x * chestRotation.y + chestRotation.w * chestRotation.z);
      fighter.recoveryOrientation = Math.abs(frontUp) >= Math.abs(rightUp)
        ? frontUp > 0 ? 'back' : 'front'
        : rightUp > 0 ? 'right' : 'left';
    }
  }

  reset(): void {
    if (this.world) this.releaseAllGrips(this.world);
    if (this.world) for (const grip of [...this.propGrips.values()]) this.releasePropGrip(this.world, grip, null);
    if (this.instrumentedWorld && this.originalRemoveImpulseJoint) this.instrumentedWorld.removeImpulseJoint = this.originalRemoveImpulseJoint;
    this.generation += 1; this.rigs.clear(); this.commands.length = 0; this.contacts.length = 0; this.replay.clear(); this.tasks.clear();
    this.pendingLandings.clear(); this.landingDeflections.clear(); this.grappleEnvironmentTarget = null; this.props.clear(); this.landingSurfaces.clear(); this.propGrips.clear(); this.releasedPropAttacks.clear(); this.replayAccumulator = 0; this.world = null; this.instrumentedWorld = null; this.originalRemoveImpulseJoint = null; this.stepStartedAt = -1; this.lastStrikeMetricKey = '';
    this.stepSamples.fill(0); this.stepSampleCursor = 0; this.stepSampleCount = 0; this.stepSampleTotal = 0;
    this.intents.player = EMPTY_INTENT(); this.intents.opponent = EMPTY_INTENT();
    this.presentationPoints.player = {}; this.presentationPoints.opponent = {};
    this.labAdditionalMass.player = 0; this.labAdditionalMass.opponent = 0;
    this.metrics.fixedSteps = 0; this.metrics.bodyCount = 0; this.metrics.jointCount = 0; this.metrics.gripCount = 0; this.metrics.nearestGripDistance = 0; this.metrics.maximumGripError = 0; this.metrics.maximumGripLoad = 0; this.metrics.lastGripBreakReason = 'none'; this.metrics.worldJointCount = 0; this.metrics.gripCreateCount = 0; this.metrics.gripInvalidCount = 0; this.metrics.propBodyCount = 0; this.metrics.propGripCount = 0; this.metrics.worldBodyCount = 0; this.metrics.invalidRegisteredBodyCount = 0; this.metrics.worldRemoveCount = 0; this.metrics.contactCount = 0; this.metrics.lastContactPair = 'none'; this.metrics.emergencyResetCount = 0; this.metrics.containmentCount = 0; this.metrics.lastStepMs = 0; this.metrics.averageStepMs = 0; this.metrics.p95StepMs = 0; this.metrics.maximumStepMs = 0; this.metrics.replayEstimatedBytes = 0; this.metrics.currentJointSeparation = 0; this.metrics.maximumJointSeparation = 0; this.metrics.motorSaturationCount = 0; this.metrics.currentMotorSaturations = 0; this.metrics.lastStrikeDistance = 0; this.metrics.minimumStrikeDistance = 0; this.metrics.minimumStrikePlanarDistance = 0; this.metrics.minimumStrikeVerticalDistance = 0; this.metrics.numericalFaultCount = 0; this.metrics.lastNumericalFault = 'none'; this.metrics.supportScore = 0; this.metrics.taskCount = 0; this.metrics.taskTimeoutCount = 0; this.metrics.lastTaskPhase = 'none';
  }

  pendingCommandCount(): number { return this.commands.length; }

  registeredLandingSurfaceCount(): number { return this.landingSurfaces.size; }

  /** Presentation rigs report a bounded set of anatomical landmarks for Physics Lab alignment diagnostics. */
  setPresentationPoint(key: FighterKey, segment: BodySegmentId, position: Vector3Value): void {
    if (![position.x, position.y, position.z].every(Number.isFinite)) return;
    this.presentationPoints[key][segment] = { x: position.x, y: position.y, z: position.z };
  }

  presentationPoint(key: FighterKey, segment: BodySegmentId): Vector3Value | null {
    return this.presentationPoints[key][segment] ?? null;
  }

  segmentSnapshot(key: FighterKey, segment: BodySegmentId): SegmentTransformSnapshot | null {
    const body = this.rigs.get(key)?.bodies[segment];
    if (!body?.isValid()) return null;
    const position = body.translation(); const rotation = body.rotation();
    return {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
    };
  }

  presentationAlignmentSnapshot(key?: FighterKey): PresentationAlignmentSnapshot {
    const keys: readonly FighterKey[] = key ? [key] : ['player', 'opponent'];
    let total = 0; let count = 0; let maximumError = 0; let maximumSegment: BodySegmentId | null = null;
    for (const fighter of keys) {
      for (const [segment, presentation] of Object.entries(this.presentationPoints[fighter]) as [BodySegmentId, Vector3Value][]) {
        const physical = this.segmentSnapshot(fighter, segment)?.position;
        if (!physical) continue;
        const error = Math.hypot(presentation.x - physical.x, presentation.y - physical.y, presentation.z - physical.z);
        total += error; count += 1;
        if (error > maximumError) { maximumError = error; maximumSegment = segment; }
      }
    }
    return { sampleCount: count, averageError: count > 0 ? total / count : 0, maximumError, maximumSegment };
  }

  fighterSnapshot(key: FighterKey): FighterPhysicsSnapshot {
    const rig = this.rigs.get(key); const pelvis = rig?.bodies.pelvis; const head = rig?.bodies.head; const leftFoot = rig?.bodies.leftFoot; const rightFoot = rig?.bodies.rightFoot;
    if (!rig || !pelvis || !head || !leftFoot || !rightFoot) return { pelvisY: 0, headY: 0, footY: 0, upright: 0, speed: 0, supportFeet: 0 };
    const rotation = pelvis.rotation(); const velocity = pelvis.linvel(); const center = this.rigPlanarCenter(rig);
    return {
      pelvisY: pelvis.translation().y,
      headY: head.translation().y,
      footY: Math.min(leftFoot.translation().y, rightFoot.translation().y),
      upright: clamp(1 - (Math.abs(rotation.x) + Math.abs(rotation.z)) * 1.7, 0, 1),
      speed: Math.hypot(center.velocityX, velocity.y, center.velocityZ),
      supportFeet: rig.supportContacts.size,
    };
  }

  stressTestGrip(attacker: FighterKey): boolean {
    const defender: FighterKey = attacker === 'player' ? 'opponent' : 'player'; const attackerRig = this.rigs.get(attacker); const defenderRig = this.rigs.get(defender);
    if (!attackerRig || !defenderRig || this.grips.filter((grip) => grip.attacker === attacker).length === 0) return false;
    const attackerCenter = this.rigPlanarCenter(attackerRig); const defenderCenter = this.rigPlanarCenter(defenderRig);
    const dx = defenderCenter.x - attackerCenter.x; const dz = defenderCenter.z - attackerCenter.z; const distance = Math.max(.001, Math.hypot(dx, dz));
    for (const grip of this.grips) if (grip.attacker === attacker) grip.createdAt -= 1.2;
    this.applyRigVelocityDelta(defenderRig, { x: dx / distance * 8.4, y: .8, z: dz / distance * 8.4 });
    this.applyRigVelocityDelta(attackerRig, { x: -dx / distance * 3.2, y: 0, z: -dz / distance * 3.2 });
    return true;
  }
}

const fighterPower = (fighter: FighterRuntime): number => fighter.definitionId === 'atlas' ? .96 : fighter.definitionId === 'chad' ? .88 : fighter.definitionId === 'brick' ? .82 : fighter.definitionId === 'nova' ? .7 : .64;
const gripCapacity = (fighter: FighterRuntime): number => fighter.body.muscle * (fighter.definitionId === 'nova' ? .98 : fighter.definitionId === 'chad' ? .97 : fighter.definitionId === 'atlas' ? .91 : fighter.definitionId === 'brick' ? .84 : .7);
const liftDriveForMove = (moveId: string): number => ['powerbomb', 'mountain_drop', 'skyhook', 'finisher'].includes(moveId) ? 1.2 : ['slam', 'suplex', 'spinebuster'].includes(moveId) ? 1 : .7;
const gripPreferences = (moveId: string): readonly [BodySegmentId, BodySegmentId, number][] => {
  if (moveId === 'slam') return [['leftHand', 'chest', -.18], ['rightHand', 'chest', .18]];
  if (moveId === 'suplex' || moveId === 'skyhook') return [['leftHand', 'pelvis', -.14], ['rightHand', 'pelvis', .14]];
  if (moveId === 'clutch') return [['leftHand', 'chest', -.16], ['rightHand', 'head', .08]];
  if (moveId === 'whip' || moveId === 'arm_drag') return [['leftHand', 'rightForearm', -.06], ['rightHand', 'rightUpperArm', .06]];
  return [['leftHand', 'chest', -.17], ['rightHand', 'pelvis', .16]];
};

const quaternionMultiply = (a: QuaternionValue, b: QuaternionValue): QuaternionValue => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});

const quaternionFromEuler = ([x, y, z]: readonly [number, number, number]): QuaternionValue => {
  const cx = Math.cos(x / 2); const sx = Math.sin(x / 2); const cy = Math.cos(y / 2); const sy = Math.sin(y / 2); const cz = Math.cos(z / 2); const sz = Math.sin(z / 2);
  return { x: sx * cy * cz + cx * sy * sz, y: cx * sy * cz - sx * cy * sz, z: cx * cy * sz + sx * sy * cz, w: cx * cy * cz - sx * sy * sz };
};

const withYaw = (yaw: QuaternionValue, euler: readonly [number, number, number]): QuaternionValue => quaternionMultiply(yaw, quaternionFromEuler(euler));

const locomotionPoseFor = (fighter: FighterRuntime): Pose => {
  const speed = Math.hypot(fighter.velocity.x, fighter.velocity.z); const running = speed > 3.75; const phase = fighter.body.gaitPhase;
  const swing = Math.sin(phase); const trailing = Math.cos(phase); const stride = running ? .72 : .38; const armDrive = running ? .88 : .46;
  const leftKnee = Math.max(0, -swing) * (running ? 1.05 : .42); const rightKnee = Math.max(0, swing) * (running ? 1.05 : .42);
  return {
    ...POSES[running ? 'run' : 'walk'],
    torso: [running ? .2 + Math.abs(trailing) * .035 : .07, 0, swing * (running ? .035 : .02)],
    leftArm: [-swing * armDrive, 0, -.24 - Math.abs(swing) * .12], rightArm: [swing * armDrive, 0, .24 + Math.abs(swing) * .12],
    leftForearm: [-.32 - leftKnee * .58, 0, 0], rightForearm: [-.32 - rightKnee * .58, 0, 0],
    leftLeg: [swing * stride, 0, 0], rightLeg: [-swing * stride, 0, 0],
    leftShin: [-leftKnee, 0, 0], rightShin: [-rightKnee, 0, 0],
    rootY: Math.abs(trailing) * (running ? .085 : .035), rootTilt: running ? .16 : .045, rootRoll: swing * (running ? .045 : .022),
  };
};

const climbPoseFor = (fighter: FighterRuntime): Pose => {
  const stage = fighter.climbStage || 1;
  return {
    ...POSES.climb,
    torso: [stage === 1 ? .42 : stage === 2 ? .24 : .08, 0, 0],
    leftArm: stage === 3 ? [-.72, 0, -.62] : [-1.18, 0, -.52],
    rightArm: stage === 3 ? [-.72, 0, .62] : [-1.18, 0, .52],
    leftLeg: [stage === 1 ? -.92 : stage === 2 ? -.58 : -.22, 0, 0],
    rightLeg: [stage === 1 ? -.52 : stage === 2 ? -.36 : -.12, 0, 0],
    leftShin: [stage === 1 ? -1.1 : -.52, 0, 0], rightShin: [stage === 1 ? -.72 : -.35, 0, 0],
    rootY: stage === 1 ? .18 : stage === 2 ? .58 : .96,
    rootTilt: stage === 3 ? .02 : .18,
  };
};

const tauntPoseFor = (fighter: FighterRuntime): Pose => {
  const base = POSES.taunt;
  if (fighter.definitionId === 'atlas') return { ...base, leftArm: [-2.82, 0, -.32], rightArm: [-2.82, 0, .32], leftForearm: [-.3, 0, 0], rightForearm: [-.3, 0, 0], rootTilt: -.06 };
  if (fighter.definitionId === 'vex') return { ...base, leftArm: [-.55, 0, -.48], rightArm: [-2.9, .25, .22], leftForearm: [-1.1, 0, 0], rightForearm: [-.18, 0, 0], rootRoll: -.12 };
  if (fighter.definitionId === 'nova') return { ...base, leftArm: [-1.62, -.65, -.54], rightArm: [-1.62, .65, .54], leftForearm: [-1.22, 0, 0], rightForearm: [-1.22, 0, 0], rootYaw: .2 };
  if (fighter.definitionId === 'brick') return { ...base, leftArm: [-.72, .25, -.5], rightArm: [-.72, -.25, .5], leftForearm: [-1.5, 0, 0], rightForearm: [-1.5, 0, 0], rootTilt: .12 };
  return { ...base, leftArm: [-2.78, 0, -.18], rightArm: [-1.08, 0, .62], leftForearm: [-.25, 0, 0], rightForearm: [-.5, 0, 0], rootRoll: .08 };
};

const CENTER_ROPE_POSE: Pose = {
  ...POSES.combatIdle,
  torso: [.62, 0, 0], leftArm: [-1.42, 0, -.64], rightArm: [-1.42, 0, .64], leftForearm: [-.48, 0, 0], rightForearm: [-.48, 0, 0],
  leftLeg: [.48, 0, -.12], rightLeg: [.48, 0, .12], leftShin: [-.92, 0, 0], rightShin: [-.92, 0, 0], rootTilt: .52, rootRoll: .08,
};

const targetPoseFor = (fighter: FighterRuntime): Pose => {
  if (fighter.moveId) {
    const move = getMove(fighter.moveId);
    if (move.id === 'taunt') return tauntPoseFor(fighter);
    return getPairedPose(move, 'actor', fighter.attackPhase, fighter.phaseElapsed, fighter.definitionId) ?? getStrikePose(move, fighter.attackPhase, fighter.phaseElapsed) ?? POSES[move.animationKey];
  }
  if (fighter.state === 'blocking') return POSES.block;
  if (fighter.state === 'climbing') return climbPoseFor(fighter);
  if (fighter.state === 'jumping' || fighter.state === 'airborne') return POSES.aerial;
  if (fighter.state === 'staggered') return POSES.stagger;
  if (fighter.state === 'downed') return recoveryPose(fighter.recoveryOrientation, 'downed', fighter.stateElapsed);
  if (fighter.state === 'defeated') return POSES.downed;
  if (fighter.state === 'recovering') return recoveryPose(fighter.recoveryOrientation, 'recovering', fighter.stateElapsed);
  if (fighter.state === 'victorious') return POSES.victory;
  const neutralPose = fighter.state === 'locomotion' ? locomotionPoseFor(fighter) : POSES.combatIdle;
  return applyBodyLanguage(neutralPose, fighter);
};

const physicalPoseTargets = (pose: Pose, facing: number): Record<BodySegmentId, QuaternionValue> => {
  const yaw = quaternionFromEuler([pose.rootTilt, facing + pose.rootYaw, pose.rootRoll]);
  const chest = withYaw(yaw, pose.torso); const leftUpperArm = quaternionMultiply(chest, quaternionFromEuler(pose.leftArm)); const rightUpperArm = quaternionMultiply(chest, quaternionFromEuler(pose.rightArm));
  const leftForearm = quaternionMultiply(leftUpperArm, quaternionFromEuler(pose.leftForearm)); const rightForearm = quaternionMultiply(rightUpperArm, quaternionFromEuler(pose.rightForearm));
  const leftThigh = withYaw(yaw, pose.leftLeg); const rightThigh = withYaw(yaw, pose.rightLeg); const leftShin = quaternionMultiply(leftThigh, quaternionFromEuler(pose.leftShin)); const rightShin = quaternionMultiply(rightThigh, quaternionFromEuler(pose.rightShin));
  const abdomenOffset: Vector3Value = { x: pose.torso[0] * .45, y: pose.torso[1] * .45, z: pose.torso[2] * .45 };
  return {
    pelvis: yaw, abdomen: withYaw(yaw, [abdomenOffset.x, abdomenOffset.y, abdomenOffset.z]), chest, head: yaw,
    leftUpperArm, rightUpperArm, leftForearm, rightForearm, leftHand: leftForearm, rightHand: rightForearm,
    leftThigh, rightThigh, leftShin, rightShin, leftFoot: leftShin, rightFoot: rightShin,
  };
};

export const bodyWorksRuntime = new BodyWorksRuntime();
