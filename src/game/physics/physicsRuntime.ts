import type { RapierRigidBody } from '@react-three/rapier';
import { JointData } from '@dimforge/rapier3d-compat';
import type { ImpulseJoint, World } from '@dimforge/rapier3d-compat';
import type { FrameInput } from '../systems/combat';
import type { BodyRegion, FighterRuntime, GameCommand, MatchModel, Vec2 } from '../types/game';
import { clamp } from '../utils/math';
import type { BodySegmentId } from './bodySchema';
import { computeMotorTorque } from './motorController';
import { PhysicsReplayBuffer } from './replayBuffer';
import { getMove } from '../data/moves';
import { fighterById } from '../data/fighters';
import { getPairedPose, getStrikePose } from '../animation/choreography';
import { POSES } from '../animation/poses';
import type { Pose } from '../animation/poses';
import type { QuaternionValue, Vector3Value } from './motorController';
import { apronTransitionTarget, isRingside, solveRopeResponse } from './ringDynamics';
import { computeStrikeForce, strikeDriveProfile } from './strikeDynamics';
import { locomotionProfile } from './bodyDynamics';

export type FighterKey = 'player' | 'opponent';

export interface BufferedPhysicsCommand {
  id: number;
  fighter: FighterKey;
  command: GameCommand;
  direction: Vec2;
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
  emergencyResetCount: number;
  lastStepMs: number;
  maximumStepMs: number;
}

export interface FighterPhysicsSnapshot { pelvisY: number; headY: number; footY: number; upright: number; speed: number; supportFeet: number }

interface FighterRigRegistration {
  bodies: Partial<Record<BodySegmentId, RapierRigidBody>>;
  supportContacts: Set<BodySegmentId>;
  jumpQueued: boolean;
  jumpCooldown: number;
  ropeContact: { axis: 'x' | 'z'; side: -1 | 1; peakCompression: number; entrySpeed: number } | null;
  cornerAnchor: (Vec2 & { stage: 1 | 2 | 3 }) | null;
  apronAnchor: { target: Vec2; inside: boolean; age: number } | null;
}

interface IntentState { move: Vec2; run: boolean; block: boolean }

interface PhysicalGrip {
  joint: ImpulseJoint;
  attacker: FighterKey;
  defender: FighterKey;
  hand: BodySegmentId;
  target: BodySegmentId;
  targetAnchorX: number;
  moveId: string;
  strength: number;
  createdAt: number;
}

interface RegisteredProp {
  body: RapierRigidBody;
  kind: 'chair' | 'sign';
}

interface PhysicalPropGrip {
  propId: string;
  owner: FighterKey;
  joint: ImpulseJoint;
}

interface PendingLanding { attacker: FighterKey; defender: FighterKey; attackInstanceId: number; moveId: string; expiresAt: number }
interface ReleasedPropAttack { owner: FighterKey; attackInstanceId: number; moveId: 'prop_throw'; expiresAt: number }

const EMPTY_INTENT = (): IntentState => ({ move: { x: 0, z: 0 }, run: false, block: false });
const MAX_COMMANDS = 32;
const MAX_CONTACTS = 128;
const COMMAND_BUFFER_SECONDS = .16;

const bodyAnchorWorld = (body: RapierRigidBody, localX: number): { x: number; y: number; z: number } => {
  const position = body.translation(); const rotation = body.rotation();
  const doubledX = localX * 2;
  return {
    x: position.x + localX * (1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z)),
    y: position.y + doubledX * (rotation.x * rotation.y + rotation.w * rotation.z),
    z: position.z + doubledX * (rotation.x * rotation.z - rotation.w * rotation.y),
  };
};

/** Imperative simulation state. It is intentionally outside React and Zustand. */
export class BodyWorksRuntime {
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
  private readonly propGrips = new Map<string, PhysicalPropGrip>();
  private readonly releasedPropAttacks = new Map<string, ReleasedPropAttack>();
  private readonly pendingLandings = new Map<FighterKey, PendingLanding>();
  private replayAccumulator = 0;
  readonly replay = new PhysicsReplayBuffer(300);
  readonly metrics: BodyWorksMetrics = { fixedSteps: 0, bodyCount: 0, jointCount: 0, gripCount: 0, nearestGripDistance: 0, maximumGripError: 0, maximumGripLoad: 0, lastGripBreakReason: 'none', worldJointCount: 0, gripCreateCount: 0, gripInvalidCount: 0, propBodyCount: 0, propGripCount: 0, worldBodyCount: 0, invalidRegisteredBodyCount: 0, worldRemoveCount: 0, contactCount: 0, emergencyResetCount: 0, lastStepMs: 0, maximumStepMs: 0 };

  registerFighter(fighter: FighterKey, bodies: Partial<Record<BodySegmentId, RapierRigidBody>>, jointCount: number): () => void {
    this.rigs.set(fighter, { bodies, supportContacts: new Set<BodySegmentId>(), jumpQueued: false, jumpCooldown: 0, ropeContact: null, cornerAnchor: null, apronAnchor: null });
    this.recount(jointCount);
    const registeredGeneration = this.generation;
    return () => {
      if (registeredGeneration === this.generation) this.rigs.delete(fighter);
      this.recount(0);
    };
  }

  registerProp(id: string, kind: 'chair' | 'sign', body: RapierRigidBody): () => void {
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

  private recount(fallbackJoints: number): void {
    let bodies = 0;
    for (const rig of this.rigs.values()) bodies += Object.keys(rig.bodies).length;
    this.metrics.bodyCount = bodies;
    this.metrics.jointCount = this.rigs.size > 0 ? Math.max(this.metrics.jointCount, fallbackJoints * this.rigs.size) : 0;
  }

  captureInput(fighter: FighterKey, input: FrameInput, now: number): void {
    const intent = this.intents[fighter];
    intent.move.x = input.move.x; intent.move.z = input.move.z; intent.run = input.run; intent.block = input.block;
    for (const command of input.commands) {
      this.commandId += 1;
      this.commands.push({ id: this.commandId, fighter, command, direction: { ...input.move }, issuedAt: now, expiresAt: now + COMMAND_BUFFER_SECONDS });
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
    const direction = { x: dx / distance, z: dz / distance }; const mass = pelvis.mass();
    pelvis.applyImpulse({ x: direction.x * mass * 6.7, y: mass * 5.15, z: direction.z * mass * 6.7 }, true);
    chest?.applyImpulse({ x: direction.x * mass * 1.25, y: mass * 1.2, z: direction.z * mass * 1.25 }, true);
    pelvis.applyTorqueImpulse({ x: -mass * .014, y: 0, z: direction.x * mass * .006 }, true);
  }

  requestApronTransition(fighter: FighterKey, from: Vec2): void {
    const rig = this.rigs.get(fighter); if (!rig) return;
    const transition = apronTransitionTarget(from);
    rig.apronAnchor = { ...transition, age: 0 };
    rig.ropeContact = null; rig.cornerAnchor = null;
  }

  prepareLabPositions(player: Vec2, opponent: Vec2): void {
    if (this.world) this.releaseAllGrips(this.world);
    this.pendingLandings.clear(); this.contacts.length = 0;
    this.placeFighter('player', player); this.placeFighter('opponent', opponent);
  }

  private placeFighter(fighter: FighterKey, target: Vec2): void {
    const rig = this.rigs.get(fighter); const pelvis = rig?.bodies.pelvis; if (!rig || !pelvis) return;
    const origin = pelvis.translation(); const dx = target.x - origin.x; const dz = target.z - origin.z;
    for (const body of Object.values(rig.bodies)) {
      if (!body?.isValid()) continue;
      const position = body.translation(); body.setTranslation({ x: position.x + dx, y: position.y, z: position.z + dz }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    rig.supportContacts.clear(); rig.jumpQueued = false; rig.ropeContact = null; rig.cornerAnchor = null; rig.apronAnchor = null;
  }

  setFootContact(fighter: FighterKey, foot: BodySegmentId, touching: boolean): void {
    const rig = this.rigs.get(fighter); if (!rig) return;
    if (touching) rig.supportContacts.add(foot); else rig.supportContacts.delete(foot);
  }

  recordContact(contact: Omit<BodyWorksContact, 'id'>): void {
    const pending = contact.sourceFighter ? this.pendingLandings.get(contact.sourceFighter) : undefined;
    const torsoLanding = contact.sourceSegment === 'chest' || contact.sourceSegment === 'abdomen' || contact.sourceSegment === 'pelvis';
    const validLandingSurface = contact.targetSurface === 'ring' || contact.targetSurface === 'floor' || contact.targetSurface === 'table';
    if (pending && contact.targetFighter === null && torsoLanding && validLandingSurface && contact.maximumForce > 55) {
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
  }

  consumeContacts(): readonly BodyWorksContact[] { const result = this.contacts.splice(0); return result; }

  isAwaitingLanding(fighter: FighterKey): boolean { return this.pendingLandings.has(fighter); }

  propAttackSource(propId: string, now: number): ReleasedPropAttack | null {
    const source = this.releasedPropAttacks.get(propId);
    if (!source || source.expiresAt < now) { this.releasedPropAttacks.delete(propId); return null; }
    return source;
  }

  beforeFixedStep(dt: number, model: MatchModel, world?: World): void {
    const startedAt = performance.now();
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
    if (model.paused || model.resolved) return;
    if (['idle', 'locomotion'].includes(model.opponent.state)) {
      const intent = this.intents.opponent;
      intent.move.x = model.aiMovement.x; intent.move.z = model.aiMovement.z; intent.run = model.aiRunning;
      intent.block = model.aiBlockTimer > 0;
    }
    for (const rig of this.rigs.values()) this.capRigVelocity(rig);
    this.applyFighterController('player', model.player, dt, model);
    this.applyFighterController('opponent', model.opponent, dt, model);
    this.applyCloseRangeSeparation(model);
    if (this.world) this.syncPhysicalProps(this.world, model);
    if (this.world) this.advancePhysicalGrapple(this.world, model, dt);
    for (const [fighter, landing] of this.pendingLandings) if (landing.expiresAt < model.elapsed) this.pendingLandings.delete(fighter);
    for (const [propId, attack] of this.releasedPropAttacks) if (attack.expiresAt < model.elapsed) this.releasedPropAttacks.delete(propId);
    this.metrics.fixedSteps += 1;
    const elapsed = performance.now() - startedAt;
    this.metrics.lastStepMs = elapsed; this.metrics.maximumStepMs = Math.max(this.metrics.maximumStepMs, elapsed);
  }

  private applyFighterController(key: FighterKey, fighter: FighterRuntime, dt: number, model: MatchModel): void {
    const rig = this.rigs.get(key); if (!rig) return;
    rig.jumpCooldown = Math.max(0, rig.jumpCooldown - dt);
    const pelvis = rig.bodies.pelvis; if (!pelvis) return;
    const intent = this.intents[key];
    const velocity = pelvis.linvel();
    const definition = fighterById(fighter.definitionId);
    const locomotion = locomotionProfile(definition);
    const ringPelvisY = 1.92 + 1.12 * (definition.physics.standingHeightM / 1.88) - fighter.body.pelvisDrop * .32;
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
      pelvis.addForce({
        x: clamp(dx * fighter.body.mass * 34 - transitionVelocity.x * fighter.body.mass * 7.5, -4_800, 4_800),
        y: clamp((targetY - position.y) * fighter.body.mass * 31 - transitionVelocity.y * fighter.body.mass * 7.2, -4_800, 5_400),
        z: clamp(dz * fighter.body.mass * 34 - transitionVelocity.z * fighter.body.mass * 7.5, -4_800, 4_800),
      }, true);
      this.applyPoseDrive(rig, fighter, CENTER_ROPE_POSE);
      if ((planarDistance < .28 && Math.abs(targetY - position.y) < .45) || anchor.age > 1.55) rig.apronAnchor = null;
      return;
    }
    if (fighter.state === 'climbing' && !rig.cornerAnchor && fighter.climbStage > 0) this.requestCornerClimb(key, fighter.position, fighter.climbStage as 1 | 2 | 3);
    if (fighter.state === 'climbing' && rig.cornerAnchor) {
      const position = pelvis.translation(); const target = rig.cornerAnchor;
      target.stage = fighter.climbStage || 1;
      const targetY = target.stage === 1 ? 2.72 : target.stage === 2 ? 3.46 : 4.28;
      pelvis.addForce({ x: clamp((target.x - position.x) * fighter.body.mass * 36 - velocity.x * fighter.body.mass * 8, -4_600, 4_600), y: clamp((targetY - position.y) * fighter.body.mass * 38 - velocity.y * fighter.body.mass * 8.5, -5_200, 5_200), z: clamp((target.z - position.z) * fighter.body.mass * 36 - velocity.z * fighter.body.mass * 8, -4_600, 4_600) }, true);
      this.applyPoseDrive(rig, fighter);
      return;
    }
    if (fighter.state !== 'climbing') rig.cornerAnchor = null;
    const groundedControl = ['idle', 'locomotion', 'blocking', 'attacking', 'grappling', 'recovering', 'victorious'].includes(fighter.state);
    if (groundedControl) {
      const recoveryBlend = fighter.state === 'recovering' ? clamp(fighter.stateElapsed / .7, 0, 1) : 1;
      const recoveryTargetY = targetPelvisY - (1 - recoveryBlend) * .62;
      const contactMultiplier = rig.supportContacts.size > 0 ? 1 : pelvis.translation().y < recoveryTargetY + .2 ? .72 : 0;
      const supportAcceleration = clamp(18 + (recoveryTargetY - pelvis.translation().y) * 42 - velocity.y * 8.5, 0, 48) * fighter.body.muscle * contactMultiplier * (.42 + recoveryBlend * .58);
      pelvis.addForce({ x: 0, y: fighter.body.mass * supportAcceleration, z: 0 }, true);
    }
    const movementControl = ['idle', 'locomotion'].includes(fighter.state) ? 1 : fighter.state === 'recovering' ? .08 : 0;
    const desiredSpeed = (intent.run ? locomotion.runSpeed : locomotion.walkSpeed) * (fighter.body.muscle < .3 ? .86 : 1) * movementControl;
    const inputLength = Math.min(1, Math.hypot(intent.move.x, intent.move.z)) * movementControl;
    const desiredX = intent.move.x * desiredSpeed * inputLength; const desiredZ = intent.move.z * desiredSpeed * inputLength;
    const acceleration = (inputLength <= .08 ? locomotion.braking : intent.run ? locomotion.runAcceleration : locomotion.acceleration) * (movementControl === 1 ? 1 : .24);
    const velocityGain = inputLength <= .08 ? 8.5 : intent.run ? 7.4 : 8;
    if (movementControl > 0) pelvis.addForce({ x: clamp((desiredX - velocity.x) * velocityGain, -acceleration, acceleration) * fighter.body.mass, y: 0, z: clamp((desiredZ - velocity.z) * velocityGain, -acceleration, acceleration) * fighter.body.mass }, true);
    if (inputLength > .08) {
      const desiredFacing = Math.atan2(intent.move.x, intent.move.z);
      const rotation = pelvis.rotation();
      const currentFacing = Math.atan2(2 * (rotation.w * rotation.y + rotation.x * rotation.z), 1 - 2 * (rotation.y * rotation.y + rotation.x * rotation.x));
      const error = Math.atan2(Math.sin(desiredFacing - currentFacing), Math.cos(desiredFacing - currentFacing));
      pelvis.applyTorqueImpulse({ x: 0, y: clamp(error * fighter.body.inertia * .015 - pelvis.angvel().y * .04, -.75, .75), z: 0 }, true);
    }
    if (rig.jumpQueued) {
      const grounded = rig.supportContacts.size > 0 || pelvis.translation().y <= targetPelvisY + .16;
      if (grounded && rig.jumpCooldown <= 0 && (['idle', 'locomotion', 'jumping'].includes(fighter.state) || fighter.moveId === 'kick_up')) {
        const launchSpeed = fighter.moveId === 'kick_up' ? 4.15 : 4.85;
        for (const body of Object.values(rig.bodies)) {
          if (!body?.isValid()) continue;
          body.applyImpulse({ x: 0, y: body.mass() * launchSpeed, z: 0 }, true);
        }
        rig.jumpCooldown = .65;
      }
      rig.jumpQueued = false;
    }
    this.applyFootPlantDrive(rig, fighter);
    this.applyRopeController(rig, fighter, model);
    this.applyPhysicalStrike(key, rig, fighter, model);
    this.applyPoseDrive(rig, fighter);
  }

  private applyCloseRangeSeparation(model: MatchModel): void {
    if (model.grapple || !['idle', 'locomotion', 'blocking'].includes(model.player.state) || !['idle', 'locomotion', 'blocking'].includes(model.opponent.state)) return;
    const player = this.rigs.get('player')?.bodies.pelvis; const opponent = this.rigs.get('opponent')?.bodies.pelvis; if (!player || !opponent) return;
    const a = player.translation(); const b = opponent.translation(); let dx = b.x - a.x; let dz = b.z - a.z; let separation = Math.hypot(dx, dz);
    if (separation >= 1.08) return;
    if (separation < .01) { dx = Math.sin(model.player.facing); dz = Math.cos(model.player.facing); separation = 1; }
    const nx = dx / separation; const nz = dz / separation; const relative = (opponent.linvel().x - player.linvel().x) * nx + (opponent.linvel().z - player.linvel().z) * nz;
    const averageMass = (player.mass() + opponent.mass()) * .5; const force = clamp((1.08 - separation) * averageMass * 28 - relative * averageMass * 2.8, 0, 1_050);
    player.addForce({ x: -nx * force, y: 0, z: -nz * force }, true); opponent.addForce({ x: nx * force, y: 0, z: nz * force }, true);
  }

  private applyFootPlantDrive(rig: FighterRigRegistration, fighter: FighterRuntime): void {
    if (!['idle', 'locomotion', 'blocking', 'recovering'].includes(fighter.state)) return;
    const entries: readonly [BodySegmentId, boolean][] = [['leftFoot', fighter.body.leftFoot.planted], ['rightFoot', fighter.body.rightFoot.planted]];
    for (const [id, planted] of entries) {
      if (!planted) continue;
      const foot = rig.bodies[id]; if (!foot) continue;
      const velocity = foot.linvel(); const mass = foot.mass(); const strength = fighter.state === 'locomotion' ? 6.5 : 22;
      foot.addForce({ x: clamp(-velocity.x * mass * strength, -180, 180), y: 0, z: clamp(-velocity.z * mass * strength, -180, 180) }, true);
    }
  }

  private applyPhysicalStrike(key: FighterKey, rig: FighterRigRegistration, fighter: FighterRuntime, model: MatchModel): void {
    if (!fighter.moveId || fighter.attackPhase !== 'active') return;
    const profile = strikeDriveProfile(fighter.moveId); if (!profile) return;
    const targetKey: FighterKey = key === 'player' ? 'opponent' : 'player'; const targetRig = this.rigs.get(targetKey);
    const source = rig.bodies[profile.source]; const target = targetRig?.bodies[profile.target]; const pelvis = rig.bodies.pelvis;
    if (!source || !target || !pelvis) return;
    const sourcePosition = source.translation(); const targetPosition = target.translation();
    const separation = Math.hypot(targetPosition.x - pelvis.translation().x, targetPosition.z - pelvis.translation().z);
    const move = getMove(fighter.moveId); if (separation > move.maximumRange + .65) return;
    const force = computeStrikeForce(sourcePosition, targetPosition, source.linvel(), target.linvel(), source.mass(), profile);
    source.addForce(force, true);
    const planarDistance = Math.max(.001, Math.hypot(targetPosition.x - sourcePosition.x, targetPosition.z - sourcePosition.z));
    pelvis.addForce({
      x: (targetPosition.x - sourcePosition.x) / planarDistance * fighter.body.mass * profile.pelvisAcceleration,
      y: 0,
      z: (targetPosition.z - sourcePosition.z) / planarDistance * fighter.body.mass * profile.pelvisAcceleration,
    }, true);
    if (fighter.moveId === 'aerial') {
      const chest = rig.bodies.chest;
      chest?.addForce({ x: force.x * .6, y: Math.min(0, force.y * .35), z: force.z * .6 }, true);
    }
    if (model[targetKey].state === 'blocking') {
      const guardTarget = targetRig?.bodies.leftForearm ?? targetRig?.bodies.rightForearm;
      if (guardTarget) {
        const guardedForce = computeStrikeForce(sourcePosition, guardTarget.translation(), source.linvel(), guardTarget.linvel(), source.mass(), profile);
        source.addForce({ x: guardedForce.x * .38, y: guardedForce.y * .38, z: guardedForce.z * .38 }, true);
      }
    }
  }

  private applyRopeController(rig: FighterRigRegistration, fighter: FighterRuntime, model: MatchModel): void {
    const pelvis = rig.bodies.pelvis; if (!pelvis || ['airborne', 'downed', 'defeated', 'climbing'].includes(fighter.state)) { rig.ropeContact = null; return; }
    const position = pelvis.translation(); const velocity = pelvis.linvel();
    const response = solveRopeResponse({ x: position.x, z: position.z }, { x: velocity.x, z: velocity.z }, model.chaosEvent?.type === 'OVERDRIVE ROPES');
    if (response.engaged) {
      pelvis.addForce({ x: response.force.x, y: 0, z: response.force.z }, true);
      if (!rig.ropeContact || rig.ropeContact.axis !== response.axis || rig.ropeContact.side !== response.side) {
        rig.ropeContact = { axis: response.axis, side: response.side, peakCompression: response.compression, entrySpeed: response.outwardSpeed };
        if (response.outwardSpeed > 1.55) {
          fighter.ropeRebound = 1.5;
          fighter.body.balance = clamp(fighter.body.balance - response.outwardSpeed * .8, 0, 100);
        }
      } else {
        rig.ropeContact.peakCompression = Math.max(rig.ropeContact.peakCompression, response.compression);
        rig.ropeContact.entrySpeed = Math.max(rig.ropeContact.entrySpeed, response.outwardSpeed);
      }
      return;
    }
    const contact = rig.ropeContact;
    if (!contact) return;
    const releaseSpeed = clamp(2.9 + contact.entrySpeed * .58 + contact.peakCompression * 6.4, 3.2, model.chaosEvent?.type === 'OVERDRIVE ROPES' ? 9 : 7.45);
    const current = pelvis.linvel();
    if (contact.axis === 'x') pelvis.setLinvel({ x: -contact.side * Math.max(releaseSpeed, Math.abs(current.x)), y: current.y, z: current.z }, true);
    else pelvis.setLinvel({ x: current.x, y: current.y, z: -contact.side * Math.max(releaseSpeed, Math.abs(current.z)) }, true);
    fighter.ropeRebound = 1.65;
    rig.ropeContact = null;
  }

  private syncPhysicalProps(world: World, model: MatchModel): void {
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
      const propAnchor = registration.kind === 'chair' ? { x: 0, y: -.42, z: .2 } : { x: 0, y: -.25, z: 0 };
      const joint = world.createImpulseJoint(JointData.spherical({ x: 0, y: 0, z: 0 }, propAnchor), hand, body, true);
      joint.setContactsEnabled(false);
      this.propGrips.set(propId, { propId, owner: prop.heldBy, joint });
      this.metrics.propGripCount = this.propGrips.size;
      this.metrics.jointCount = this.rigs.size * 15 + this.grips.length + this.propGrips.size;
    }
  }

  private releasePropGrip(world: World, grip: PhysicalPropGrip, model: MatchModel | null): void {
    const registration = this.props.get(grip.propId); const rig = this.rigs.get(grip.owner); const hand = rig?.bodies.rightHand;
    if (grip.joint.isValid()) world.removeImpulseJoint(grip.joint, true);
    this.propGrips.delete(grip.propId);
    this.metrics.propGripCount = this.propGrips.size;
    this.metrics.jointCount = this.rigs.size * 15 + this.grips.length + this.propGrips.size;
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
      if (linearSpeed > 18) { const scale = 18 / linearSpeed; body.setLinvel({ x: linear.x * scale, y: linear.y * scale, z: linear.z * scale }, true); }
      const angular = body.angvel(); const angularSpeed = Math.hypot(angular.x, angular.y, angular.z);
      if (angularSpeed > 24) { const scale = 24 / angularSpeed; body.setAngvel({ x: angular.x * scale, y: angular.y * scale, z: angular.z * scale }, true); }
    }
  }

  private advancePhysicalGrapple(world: World, model: MatchModel, dt: number): void {
    const grapple = model.grapple;
    if (!grapple) { this.releaseAllGrips(world); return; }
    const attacker = model[grapple.attacker]; const defender = model[grapple.defender]; const attackerRig = this.rigs.get(grapple.attacker); const defenderRig = this.rigs.get(grapple.defender);
    if (!attackerRig || !defenderRig || !attacker.moveId || !['grappling', 'attacking'].includes(attacker.state)) { this.releaseAllGrips(world); model.grapple = null; return; }
    const move = getMove(attacker.moveId); grapple.age += dt;
    if (grapple.phase === 'impact' || grapple.phase === 'release') return;
    // A directional follow-up changes the throw without releasing the physical
    // collar-and-elbow lock. Grips belong to the grapple session, not the
    // currently selected move, so the same hands can flow from lock-up to slam.
    const owned = this.grips.filter((grip) => grip.attacker === grapple.attacker);
    if (owned.length < 2) {
      grapple.phase = owned.length === 0 ? 'reach' : 'acquire';
      let nearestGripDistance = Number.POSITIVE_INFINITY;
      const preferences: readonly [BodySegmentId, BodySegmentId, number][] = gripPreferences(move.id);
      for (const [handId, targetId, targetAnchorX] of preferences) {
        if (this.grips.some((grip) => grip.attacker === grapple.attacker && grip.hand === handId)) continue;
        const hand = attackerRig.bodies[handId]; const target = defenderRig.bodies[targetId]; if (!hand || !target) continue;
        const handPosition = hand.translation(); const targetPosition = bodyAnchorWorld(target, targetAnchorX);
        const delta = { x: targetPosition.x - handPosition.x, y: targetPosition.y - handPosition.y, z: targetPosition.z - handPosition.z };
        const distance = Math.hypot(delta.x, delta.y, delta.z);
        nearestGripDistance = Math.min(nearestGripDistance, distance);
        if (distance > 1.5) continue;
        const handVelocity = hand.linvel(); const targetVelocity = target.linvel(); const inverseDistance = 1 / Math.max(.001, distance);
        const desiredSpeed = clamp(distance * 11, 2.5, 8.5);
        const desiredVelocity = { x: targetVelocity.x + delta.x * inverseDistance * desiredSpeed, y: targetVelocity.y + delta.y * inverseDistance * desiredSpeed, z: targetVelocity.z + delta.z * inverseDistance * desiredSpeed };
        const rawForce = { x: (desiredVelocity.x - handVelocity.x) * hand.mass() * 18, y: (desiredVelocity.y - handVelocity.y) * hand.mass() * 18, z: (desiredVelocity.z - handVelocity.z) * hand.mass() * 18 };
        const rawMagnitude = Math.hypot(rawForce.x, rawForce.y, rawForce.z); const forceScale = rawMagnitude > 260 ? 260 / rawMagnitude : 1;
        const force = { x: rawForce.x * forceScale, y: rawForce.y * forceScale, z: rawForce.z * forceScale };
        hand.addForce(force, true); target.addForce({ x: -force.x * .12, y: -force.y * .12, z: -force.z * .12 }, true);
        const attackerPelvis = attackerRig.bodies.pelvis; const defenderPelvis = defenderRig.bodies.pelvis;
        if (attackerPelvis && defenderPelvis) {
          const attackerPosition = attackerPelvis.translation(); const defenderPosition = defenderPelvis.translation(); const planarDistance = Math.max(.001, Math.hypot(defenderPosition.x - attackerPosition.x, defenderPosition.z - attackerPosition.z));
          attackerPelvis.addForce({ x: (defenderPosition.x - attackerPosition.x) / planarDistance * attacker.body.mass * 3.6, y: 0, z: (defenderPosition.z - attackerPosition.z) / planarDistance * attacker.body.mass * 3.6 }, true);
        }
        // The hand and target colliders already account for roughly .28 m of
        // this separation. Closing the remaining reach with a short rope joint
        // gives the lock-up a visible hand-to-body snap without teleporting.
        const acquiredHands = this.grips.filter((grip) => grip.attacker === grapple.attacker).length;
        // The first hand establishes the collar tie and can rotate two large
        // articulated bodies a few centimetres apart. Give the second hand a
        // slightly wider catch envelope so a visually valid two-hand lock does
        // not fail because the first constraint moved the hips mid-frame.
        const catchDistance = acquiredHands > 0 ? .86 : .66;
        if (distance > catchDistance) continue;
        const joint = world.createImpulseJoint(JointData.rope(.24, { x: 0, y: 0, z: 0 }, { x: targetAnchorX, y: 0, z: 0 }), hand, target, true);
        joint.setContactsEnabled(false);
        this.metrics.gripCreateCount += 1;
        this.grips.push({ joint, attacker: grapple.attacker, defender: grapple.defender, hand: handId, target: targetId, targetAnchorX, moveId: move.id, strength: gripCapacity(attacker), createdAt: model.elapsed });
      }
      this.metrics.nearestGripDistance = Number.isFinite(nearestGripDistance) ? nearestGripDistance : 0;
    }
    const activeGrips = this.grips.filter((grip) => grip.attacker === grapple.attacker);
    for (const grip of activeGrips) {
      const hand = attackerRig.bodies[grip.hand]; const target = defenderRig.bodies[grip.target];
      if (!hand || !target) { this.removeGrip(world, grip, 'missing-body'); continue; }
      if (!grip.joint.isValid()) { this.metrics.gripInvalidCount += 1; this.removeGrip(world, grip, 'invalid-joint'); continue; }
      const handPosition = hand.translation(); const targetPosition = bodyAnchorWorld(target, grip.targetAnchorX); const error = Math.hypot(handPosition.x - targetPosition.x, handPosition.y - targetPosition.y, handPosition.z - targetPosition.z);
      const load = Math.hypot(target.linvel().x - hand.linvel().x, target.linvel().y - hand.linvel().y, target.linvel().z - hand.linvel().z) * defender.body.mass / 100;
      this.metrics.maximumGripError = Math.max(this.metrics.maximumGripError, error); this.metrics.maximumGripLoad = Math.max(this.metrics.maximumGripLoad, load);
      if (error > .18) {
        const delta = { x: targetPosition.x - handPosition.x, y: targetPosition.y - handPosition.y, z: targetPosition.z - handPosition.z }; const inverseError = 1 / Math.max(.001, error);
        const pull = clamp((error - .18) * 68, 0, 52); const force = { x: delta.x * inverseError * pull, y: delta.y * inverseError * pull, z: delta.z * inverseError * pull };
        hand.addForce(force, true); target.addForce({ x: -force.x, y: -force.y, z: -force.z }, true);
      }
      const acquisitionGrace = model.elapsed - grip.createdAt < .58;
      if (!['grappling', 'attacking'].includes(attacker.state)) this.removeGrip(world, grip, 'incompatible-state');
      else if (!acquisitionGrace && error > 1.35) this.removeGrip(world, grip, 'anchor-error');
      else if (!acquisitionGrace && load > grip.strength * 24) this.removeGrip(world, grip, 'load-break');
    }
    grapple.gripCount = this.grips.filter((grip) => grip.attacker === grapple.attacker).length;
    this.metrics.gripCount = this.grips.length; this.metrics.jointCount = this.rigs.size * 15 + this.grips.length + this.propGrips.size;
    if (grapple.gripCount < 2) {
      if (grapple.age > 2.25) {
        grapple.phase = 'failed'; this.releaseAllGrips(world); model.grapple = null;
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
    if (progress < .38) grapple.phase = 'clinch';
    else if (progress < .56) grapple.phase = 'load';
    else if (attacker.attackPhase === 'anticipation') {
      grapple.phase = 'lift';
      const liftDrive = liftDriveForMove(move.id) * liftFeasibility;
      defenderPelvis.addForce({ x: 0, y: defender.body.mass * (20 + liftDrive * 12), z: 0 }, true);
      defenderChest.addForce({ x: Math.sin(attacker.facing) * defender.body.mass * liftDrive * 2.1, y: defender.body.mass * liftDrive * 4, z: Math.cos(attacker.facing) * defender.body.mass * liftDrive * 2.1 }, true);
      defenderPelvis.applyTorqueImpulse({ x: move.id === 'suplex' || move.id === 'skyhook' ? -.032 * liftDrive : .018 * liftDrive, y: 0, z: (grapple.position === 'overhook' ? .028 : -.018) * liftDrive }, true);
      attackerPelvis.addForce({ x: 0, y: -attacker.body.mass * 5.5, z: 0 }, true);
    }
    if (attacker.attackPhase === 'active') {
      grapple.phase = 'release';
      this.releaseAllGrips(world);
      const direction = { x: Math.sin(attacker.facing), z: Math.cos(attacker.facing) };
      defenderPelvis.applyImpulse({ x: direction.x * defender.body.mass * 1.7, y: -defender.body.mass * 4.15, z: direction.z * defender.body.mass * 1.7 }, true);
      defenderChest.applyTorqueImpulse({ x: move.id.includes('suplex') || move.id === 'skyhook' ? -.16 : -.08, y: 0, z: grapple.position === 'overhook' ? .12 : -.08 }, true);
      defender.state = 'airborne'; defender.stateElapsed = 0; defender.downTimer = 1.5 + (100 - defender.health) / 85;
      this.pendingLandings.set(grapple.defender, { attacker: grapple.attacker, defender: grapple.defender, attackInstanceId: attacker.attackInstanceId, moveId: move.id, expiresAt: model.elapsed + 2.2 });
      grapple.phase = 'impact'; grapple.gripCount = 0;
    }
  }

  private removeGrip(world: World, grip: PhysicalGrip, reason = 'release'): void {
    const index = this.grips.indexOf(grip); if (index >= 0) this.grips.splice(index, 1);
    this.metrics.lastGripBreakReason = reason;
    if (grip.joint.isValid()) world.removeImpulseJoint(grip.joint, true);
  }

  private releaseAllGrips(world: World): void { for (const grip of [...this.grips]) this.removeGrip(world, grip); this.metrics.gripCount = 0; this.metrics.jointCount = this.rigs.size * 15 + this.propGrips.size; }

  private applyPoseDrive(rig: FighterRigRegistration, fighter: FighterRuntime, overridePose?: Pose): void {
    const falling = ['airborne', 'downed', 'defeated'].includes(fighter.state);
    const definition = fighterById(fighter.definitionId);
    const recoveryStrength = .38 + clamp(fighter.stateElapsed / .7, 0, 1) * .56;
    const strength = fighter.state === 'defeated' ? .02 : falling ? .13 : fighter.state === 'recovering' ? recoveryStrength : fighter.state === 'grabbed' ? .34 : fighter.state === 'staggered' ? .48 : .94;
    const fatigue = 1 - fighter.body.muscle;
    const pose = overridePose ?? targetPoseFor(fighter); const targets = physicalPoseTargets(pose, fighter.facing);
    for (const [segment, body] of Object.entries(rig.bodies) as [BodySegmentId, RapierRigidBody][]) {
      const isCore = segment === 'pelvis' || segment === 'chest' || segment === 'abdomen'; const isDistal = segment.includes('Hand') || segment.includes('Foot'); const isLeg = segment.includes('Thigh') || segment.includes('Shin');
      const stiffnessScale = definition.physics.jointStiffness;
      const torque = computeMotorTorque(body.rotation(), targets[segment], body.angvel(), { x: 0, y: 0, z: 0 }, {
        stiffness: (segment === 'pelvis' ? 420 : isCore ? 320 : segment === 'head' ? 150 : isLeg ? 220 : isDistal ? 90 : 170) * stiffnessScale,
        damping: (segment === 'pelvis' ? 62 : isCore ? 48 : segment === 'head' ? 22 : isLeg ? 34 : isDistal ? 14 : 27) * stiffnessScale,
        maxTorque: (segment === 'pelvis' ? 460 : isCore ? 340 : segment === 'head' ? 110 : isLeg ? 210 : isDistal ? 58 : 160) * stiffnessScale,
        strength,
        fatigue,
      });
      body.applyTorqueImpulse({ x: torque.x * .016, y: torque.y * .016, z: torque.z * .016 }, true);
    }
  }

  afterFixedStep(model: MatchModel): void {
    if (model.paused) return;
    this.syncFighter('player', model.player);
    this.syncFighter('opponent', model.opponent);
    this.replayAccumulator += 1 / 60;
    if (this.replayAccumulator >= 1 / 30) {
      this.replayAccumulator %= 1 / 30;
      this.captureReplayFrame(model.elapsed);
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
  }

  private syncFighter(key: FighterKey, fighter: FighterRuntime): void {
    const rig = this.rigs.get(key); const pelvis = rig?.bodies.pelvis; if (!rig || !pelvis) return;
    const position = pelvis.translation(); const velocity = pelvis.linvel(); const rotation = pelvis.rotation();
    if (![position.x, position.y, position.z, velocity.x, velocity.y, velocity.z].every(Number.isFinite)) { this.metrics.emergencyResetCount += 1; return; }
    fighter.position.x = position.x; fighter.position.z = position.z;
    fighter.velocity.x = velocity.x; fighter.velocity.z = velocity.z;
    fighter.facing = Math.atan2(2 * (rotation.w * rotation.y + rotation.x * rotation.z), 1 - 2 * (rotation.y * rotation.y + rotation.x * rotation.x));
    const upright = clamp(1 - (Math.abs(rotation.x) + Math.abs(rotation.z)) * 1.7, 0, 1);
    fighter.body.balance = clamp((rig.supportContacts.size > 0 ? 52 : 12) + upright * 48 - Math.hypot(velocity.x, velocity.z) * 1.1, 0, 100);
    fighter.body.verticalOffset = Math.max(0, position.y - 3.02);
  }

  reset(): void {
    if (this.world) this.releaseAllGrips(this.world);
    if (this.world) for (const grip of [...this.propGrips.values()]) this.releasePropGrip(this.world, grip, null);
    if (this.instrumentedWorld && this.originalRemoveImpulseJoint) this.instrumentedWorld.removeImpulseJoint = this.originalRemoveImpulseJoint;
    this.generation += 1; this.rigs.clear(); this.commands.length = 0; this.contacts.length = 0; this.replay.clear();
    this.pendingLandings.clear(); this.props.clear(); this.propGrips.clear(); this.releasedPropAttacks.clear(); this.replayAccumulator = 0; this.world = null; this.instrumentedWorld = null; this.originalRemoveImpulseJoint = null;
    this.intents.player = EMPTY_INTENT(); this.intents.opponent = EMPTY_INTENT();
    this.metrics.fixedSteps = 0; this.metrics.bodyCount = 0; this.metrics.jointCount = 0; this.metrics.gripCount = 0; this.metrics.nearestGripDistance = 0; this.metrics.maximumGripError = 0; this.metrics.maximumGripLoad = 0; this.metrics.lastGripBreakReason = 'none'; this.metrics.worldJointCount = 0; this.metrics.gripCreateCount = 0; this.metrics.gripInvalidCount = 0; this.metrics.propBodyCount = 0; this.metrics.propGripCount = 0; this.metrics.worldBodyCount = 0; this.metrics.invalidRegisteredBodyCount = 0; this.metrics.worldRemoveCount = 0; this.metrics.contactCount = 0; this.metrics.lastStepMs = 0; this.metrics.maximumStepMs = 0;
  }

  pendingCommandCount(): number { return this.commands.length; }

  fighterSnapshot(key: FighterKey): FighterPhysicsSnapshot {
    const rig = this.rigs.get(key); const pelvis = rig?.bodies.pelvis; const head = rig?.bodies.head; const leftFoot = rig?.bodies.leftFoot; const rightFoot = rig?.bodies.rightFoot;
    if (!rig || !pelvis || !head || !leftFoot || !rightFoot) return { pelvisY: 0, headY: 0, footY: 0, upright: 0, speed: 0, supportFeet: 0 };
    const rotation = pelvis.rotation(); const velocity = pelvis.linvel();
    return {
      pelvisY: pelvis.translation().y,
      headY: head.translation().y,
      footY: Math.min(leftFoot.translation().y, rightFoot.translation().y),
      upright: clamp(1 - (Math.abs(rotation.x) + Math.abs(rotation.z)) * 1.7, 0, 1),
      speed: Math.hypot(velocity.x, velocity.y, velocity.z),
      supportFeet: rig.supportContacts.size,
    };
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
  if (fighter.state === 'downed' || fighter.state === 'defeated') return POSES.downed;
  if (fighter.state === 'recovering') return POSES.recovery;
  if (fighter.state === 'victorious') return POSES.victory;
  return fighter.state === 'locomotion' ? locomotionPoseFor(fighter) : POSES.combatIdle;
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
