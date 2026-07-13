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
import { getPairedPose, getStrikePose } from '../animation/choreography';
import { POSES } from '../animation/poses';
import type { Pose } from '../animation/poses';
import type { QuaternionValue, Vector3Value } from './motorController';

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
  worldBodyCount: number;
  invalidRegisteredBodyCount: number;
  worldRemoveCount: number;
  contactCount: number;
  emergencyResetCount: number;
  lastStepMs: number;
  maximumStepMs: number;
}

interface FighterRigRegistration {
  bodies: Partial<Record<BodySegmentId, RapierRigidBody>>;
  supportContacts: Set<BodySegmentId>;
  jumpQueued: boolean;
  jumpCooldown: number;
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

interface PendingLanding { attacker: FighterKey; defender: FighterKey; attackInstanceId: number; moveId: string; expiresAt: number }

const EMPTY_INTENT = (): IntentState => ({ move: { x: 0, z: 0 }, run: false, block: false });
const MAX_COMMANDS = 32;
const MAX_CONTACTS = 128;
const COMMAND_BUFFER_SECONDS = .13;

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
  private readonly pendingLandings = new Map<FighterKey, PendingLanding>();
  readonly replay = new PhysicsReplayBuffer(300);
  readonly metrics: BodyWorksMetrics = { fixedSteps: 0, bodyCount: 0, jointCount: 0, gripCount: 0, nearestGripDistance: 0, maximumGripError: 0, maximumGripLoad: 0, lastGripBreakReason: 'none', worldJointCount: 0, gripCreateCount: 0, gripInvalidCount: 0, worldBodyCount: 0, invalidRegisteredBodyCount: 0, worldRemoveCount: 0, contactCount: 0, emergencyResetCount: 0, lastStepMs: 0, maximumStepMs: 0 };

  registerFighter(fighter: FighterKey, bodies: Partial<Record<BodySegmentId, RapierRigidBody>>, jointCount: number): () => void {
    this.rigs.set(fighter, { bodies, supportContacts: new Set<BodySegmentId>(), jumpQueued: false, jumpCooldown: 0 });
    this.recount(jointCount);
    const registeredGeneration = this.generation;
    return () => {
      if (registeredGeneration === this.generation) this.rigs.delete(fighter);
      this.recount(0);
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

  resolveCommands(fighter: FighterKey, now: number, attempt: (command: BufferedPhysicsCommand) => boolean): void {
    for (let index = this.commands.length - 1; index >= 0; index -= 1) {
      const command = this.commands[index];
      if (!command) continue;
      if (command.expiresAt < now) { this.commands.splice(index, 1); continue; }
      if (command.fighter === fighter && attempt(command)) this.commands.splice(index, 1);
    }
  }

  setAiIntent(move: Vec2, run: boolean, block: boolean): void {
    const intent = this.intents.opponent; intent.move.x = move.x; intent.move.z = move.z; intent.run = run; intent.block = block;
  }

  requestJump(fighter: FighterKey): void { const rig = this.rigs.get(fighter); if (rig) rig.jumpQueued = true; }

  setFootContact(fighter: FighterKey, foot: BodySegmentId, touching: boolean): void {
    const rig = this.rigs.get(fighter); if (!rig) return;
    if (touching) rig.supportContacts.add(foot); else rig.supportContacts.delete(foot);
  }

  recordContact(contact: Omit<BodyWorksContact, 'id'>): void {
    const pending = contact.sourceFighter ? this.pendingLandings.get(contact.sourceFighter) : undefined;
    if (pending && contact.targetFighter === null && contact.maximumForce > 90) {
      contact = {
        ...contact,
        sourceFighter: pending.attacker,
        sourceSegment: 'chest',
        targetFighter: pending.defender,
        attackInstanceId: pending.attackInstanceId,
      };
      this.pendingLandings.delete(pending.defender);
    }
    this.contactId += 1;
    this.contacts.push({ id: this.contactId, ...contact });
    if (this.contacts.length > MAX_CONTACTS) this.contacts.splice(0, this.contacts.length - MAX_CONTACTS);
    this.metrics.contactCount += 1;
  }

  consumeContacts(): readonly BodyWorksContact[] { const result = this.contacts.splice(0); return result; }

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
      const deltaX = model.player.position.x - model.opponent.position.x; const deltaZ = model.player.position.z - model.opponent.position.z; const distance = Math.hypot(deltaX, deltaZ);
      const intent = this.intents.opponent;
      if (distance > 1.55) { intent.move.x = deltaX / Math.max(.001, distance); intent.move.z = deltaZ / Math.max(.001, distance); intent.run = distance > 3.5; }
      else { intent.move.x = 0; intent.move.z = 0; intent.run = false; }
      intent.block = model.aiBlockTimer > 0;
    }
    this.applyFighterController('player', model.player, dt);
    this.applyFighterController('opponent', model.opponent, dt);
    for (const [fighter, landing] of this.pendingLandings) if (landing.expiresAt < model.elapsed) this.pendingLandings.delete(fighter);
    this.metrics.fixedSteps += 1;
    const elapsed = performance.now() - startedAt;
    this.metrics.lastStepMs = elapsed; this.metrics.maximumStepMs = Math.max(this.metrics.maximumStepMs, elapsed);
  }

  private applyFighterController(key: FighterKey, fighter: FighterRuntime, dt: number): void {
    const rig = this.rigs.get(key); if (!rig) return;
    rig.jumpCooldown = Math.max(0, rig.jumpCooldown - dt);
    const pelvis = rig.bodies.pelvis; if (!pelvis) return;
    const intent = this.intents[key];
    const velocity = pelvis.linvel();
    const desiredSpeed = (intent.run ? 5.4 : 3.25) * (.78 + fighterBySpeed(fighter) / 235) * (fighter.body.muscle < .3 ? .72 : 1);
    const inputLength = Math.min(1, Math.hypot(intent.move.x, intent.move.z));
    const desiredX = intent.move.x * desiredSpeed * inputLength; const desiredZ = intent.move.z * desiredSpeed * inputLength;
    const acceleration = (intent.run ? 9.4 : 12.5) * clamp(105 / fighter.body.mass, .72, 1.3);
    pelvis.addForce({ x: clamp(desiredX - velocity.x, -acceleration, acceleration) * fighter.body.mass, y: 0, z: clamp(desiredZ - velocity.z, -acceleration, acceleration) * fighter.body.mass }, true);
    if (inputLength > .08) {
      const desiredFacing = Math.atan2(intent.move.x, intent.move.z);
      const rotation = pelvis.rotation();
      const currentFacing = Math.atan2(2 * (rotation.w * rotation.y + rotation.x * rotation.z), 1 - 2 * (rotation.y * rotation.y + rotation.x * rotation.x));
      const error = Math.atan2(Math.sin(desiredFacing - currentFacing), Math.cos(desiredFacing - currentFacing));
      pelvis.applyTorqueImpulse({ x: 0, y: clamp(error * fighter.body.inertia * .015 - pelvis.angvel().y * .04, -.75, .75), z: 0 }, true);
    }
    if (rig.jumpQueued) {
      if (rig.supportContacts.size > 0 && rig.jumpCooldown <= 0 && ['idle', 'locomotion', 'jumping'].includes(fighter.state)) {
        pelvis.applyImpulse({ x: 0, y: fighter.body.mass * .058, z: 0 }, true);
        rig.jumpCooldown = .65;
      }
      rig.jumpQueued = false;
    }
    this.applyPoseDrive(rig, fighter);
  }

  private advancePhysicalGrapple(world: World, model: MatchModel, dt: number): void {
    const grapple = model.grapple;
    if (!grapple) { this.releaseAllGrips(world); return; }
    const attacker = model[grapple.attacker]; const defender = model[grapple.defender]; const attackerRig = this.rigs.get(grapple.attacker); const defenderRig = this.rigs.get(grapple.defender);
    if (!attackerRig || !defenderRig || !attacker.moveId || !['grappling', 'attacking'].includes(attacker.state)) { this.releaseAllGrips(world); model.grapple = null; return; }
    const move = getMove(attacker.moveId); grapple.age += dt;
    const owned = this.grips.filter((grip) => grip.attacker === grapple.attacker && grip.moveId === move.id);
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
        if (distance > 1.38) continue;
        const handVelocity = hand.linvel(); const targetVelocity = target.linvel();
        const spring = clamp((distance - .22) * 42, 0, owned.length > 0 ? 44 : 34); const inverseDistance = 1 / Math.max(.001, distance);
        const force = {
          x: clamp(delta.x * inverseDistance * spring - (handVelocity.x - targetVelocity.x) * 2.8, -46, 46),
          y: clamp(delta.y * inverseDistance * spring - (handVelocity.y - targetVelocity.y) * 2.8, -46, 46),
          z: clamp(delta.z * inverseDistance * spring - (handVelocity.z - targetVelocity.z) * 2.8, -46, 46),
        };
        hand.addForce(force, true); target.addForce({ x: -force.x, y: -force.y, z: -force.z }, true);
        if (distance > .5) continue;
        const joint = world.createImpulseJoint(JointData.spherical({ x: 0, y: 0, z: 0 }, { x: targetAnchorX, y: 0, z: 0 }), hand, target, true);
        joint.setContactsEnabled(false);
        this.metrics.gripCreateCount += 1;
        this.grips.push({ joint, attacker: grapple.attacker, defender: grapple.defender, hand: handId, target: targetId, targetAnchorX, moveId: move.id, strength: gripCapacity(attacker), createdAt: model.elapsed });
      }
      this.metrics.nearestGripDistance = Number.isFinite(nearestGripDistance) ? nearestGripDistance : 0;
    }
    const activeGrips = this.grips.filter((grip) => grip.attacker === grapple.attacker && grip.moveId === move.id);
    for (const grip of activeGrips) {
      const hand = attackerRig.bodies[grip.hand]; const target = defenderRig.bodies[grip.target];
      if (!hand || !target) { this.removeGrip(world, grip, 'missing-body'); continue; }
      if (!grip.joint.isValid()) { this.metrics.gripInvalidCount += 1; this.removeGrip(world, grip, 'invalid-joint'); continue; }
      const handPosition = hand.translation(); const targetPosition = bodyAnchorWorld(target, grip.targetAnchorX); const error = Math.hypot(handPosition.x - targetPosition.x, handPosition.y - targetPosition.y, handPosition.z - targetPosition.z);
      const load = Math.hypot(target.linvel().x - hand.linvel().x, target.linvel().y - hand.linvel().y, target.linvel().z - hand.linvel().z) * defender.body.mass / 100;
      this.metrics.maximumGripError = Math.max(this.metrics.maximumGripError, error); this.metrics.maximumGripLoad = Math.max(this.metrics.maximumGripLoad, load);
      const acquisitionGrace = model.elapsed - grip.createdAt < .58;
      if (!['grappling', 'attacking'].includes(attacker.state)) this.removeGrip(world, grip, 'incompatible-state');
      else if (!acquisitionGrace && error > 1.35) this.removeGrip(world, grip, 'anchor-error');
      else if (!acquisitionGrace && load > grip.strength * 24) this.removeGrip(world, grip, 'load-break');
    }
    grapple.gripCount = this.grips.filter((grip) => grip.attacker === grapple.attacker && grip.moveId === move.id).length;
    this.metrics.gripCount = this.grips.length; this.metrics.jointCount = this.rigs.size * 15 + this.grips.length;
    if (grapple.gripCount < 2) {
      if (grapple.age > 1.8) {
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
      defenderPelvis.applyImpulse({ x: direction.x * defender.body.mass * .035, y: -defender.body.mass * .055, z: direction.z * defender.body.mass * .035 }, true);
      defenderChest.applyTorqueImpulse({ x: move.id.includes('suplex') || move.id === 'skyhook' ? -.16 : -.08, y: 0, z: grapple.position === 'overhook' ? .12 : -.08 }, true);
      defender.state = 'airborne'; defender.stateElapsed = 0; defender.downTimer = 1.5 + (100 - defender.health) / 85;
      this.pendingLandings.set(grapple.defender, { attacker: grapple.attacker, defender: grapple.defender, attackInstanceId: attacker.attackInstanceId, moveId: move.id, expiresAt: model.elapsed + 1.4 });
      grapple.phase = 'impact'; grapple.gripCount = 0;
    }
  }

  private removeGrip(world: World, grip: PhysicalGrip, reason = 'release'): void {
    const index = this.grips.indexOf(grip); if (index >= 0) this.grips.splice(index, 1);
    this.metrics.lastGripBreakReason = reason;
    if (grip.joint.isValid()) world.removeImpulseJoint(grip.joint, true);
  }

  private releaseAllGrips(world: World): void { for (const grip of [...this.grips]) this.removeGrip(world, grip); this.metrics.gripCount = 0; this.metrics.jointCount = this.rigs.size * 15; }

  private applyPoseDrive(rig: FighterRigRegistration, fighter: FighterRuntime): void {
    const falling = ['airborne', 'downed', 'defeated'].includes(fighter.state);
    const strength = fighter.state === 'defeated' ? .025 : falling ? .16 : fighter.state === 'staggered' ? .42 : .82;
    const fatigue = 1 - fighter.body.muscle;
    const pose = targetPoseFor(fighter); const targets = physicalPoseTargets(pose, fighter.facing);
    for (const [segment, body] of Object.entries(rig.bodies) as [BodySegmentId, RapierRigidBody][]) {
      const torque = computeMotorTorque(body.rotation(), targets[segment], body.angvel(), { x: 0, y: 0, z: 0 }, {
        stiffness: segment === 'pelvis' ? 16 : segment === 'head' ? 7 : 11,
        damping: segment === 'pelvis' ? 3.4 : segment === 'head' ? 1.8 : 2.5,
        maxTorque: segment === 'pelvis' ? 1.2 : segment === 'chest' || segment === 'abdomen' ? .72 : segment.includes('Hand') || segment.includes('Foot') ? .18 : .42,
        strength,
        fatigue,
      });
      body.applyTorqueImpulse({ x: torque.x * .016, y: torque.y * .016, z: torque.z * .016 }, true);
    }
  }

  afterFixedStep(model: MatchModel): void {
    if (model.paused) return;
    if (this.world && !model.resolved) this.advancePhysicalGrapple(this.world, model, 1 / 60);
    this.syncFighter('player', model.player);
    this.syncFighter('opponent', model.opponent);
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
    if (this.instrumentedWorld && this.originalRemoveImpulseJoint) this.instrumentedWorld.removeImpulseJoint = this.originalRemoveImpulseJoint;
    this.generation += 1; this.rigs.clear(); this.commands.length = 0; this.contacts.length = 0; this.replay.clear();
    this.pendingLandings.clear(); this.world = null; this.instrumentedWorld = null; this.originalRemoveImpulseJoint = null;
    this.intents.player = EMPTY_INTENT(); this.intents.opponent = EMPTY_INTENT();
    this.metrics.fixedSteps = 0; this.metrics.bodyCount = 0; this.metrics.jointCount = 0; this.metrics.gripCount = 0; this.metrics.nearestGripDistance = 0; this.metrics.maximumGripError = 0; this.metrics.maximumGripLoad = 0; this.metrics.lastGripBreakReason = 'none'; this.metrics.worldJointCount = 0; this.metrics.gripCreateCount = 0; this.metrics.gripInvalidCount = 0; this.metrics.worldBodyCount = 0; this.metrics.invalidRegisteredBodyCount = 0; this.metrics.worldRemoveCount = 0; this.metrics.contactCount = 0; this.metrics.lastStepMs = 0; this.metrics.maximumStepMs = 0;
  }

  pendingCommandCount(): number { return this.commands.length; }
}

const fighterBySpeed = (fighter: FighterRuntime): number => fighter.definitionId === 'vex' ? 97 : fighter.definitionId === 'nova' ? 77 : fighter.definitionId === 'brick' ? 76 : fighter.definitionId === 'chad' ? 67 : 48;
const fighterPower = (fighter: FighterRuntime): number => fighter.definitionId === 'atlas' ? .96 : fighter.definitionId === 'chad' ? .88 : fighter.definitionId === 'brick' ? .82 : fighter.definitionId === 'nova' ? .7 : .64;
const gripCapacity = (fighter: FighterRuntime): number => fighter.body.muscle * (fighter.definitionId === 'nova' ? .98 : fighter.definitionId === 'chad' ? .97 : fighter.definitionId === 'atlas' ? .91 : fighter.definitionId === 'brick' ? .84 : .7);
const liftDriveForMove = (moveId: string): number => ['powerbomb', 'mountain_drop', 'skyhook', 'finisher'].includes(moveId) ? 1.2 : ['slam', 'suplex', 'spinebuster'].includes(moveId) ? 1 : .7;
const gripPreferences = (moveId: string): readonly [BodySegmentId, BodySegmentId, number][] => {
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

const targetPoseFor = (fighter: FighterRuntime): Pose => {
  if (fighter.moveId) {
    const move = getMove(fighter.moveId);
    return getPairedPose(move, 'actor', fighter.attackPhase, fighter.phaseElapsed, fighter.definitionId) ?? getStrikePose(move, fighter.attackPhase, fighter.phaseElapsed) ?? POSES[move.animationKey];
  }
  if (fighter.state === 'blocking') return POSES.block;
  if (fighter.state === 'jumping' || fighter.state === 'airborne') return POSES.aerial;
  if (fighter.state === 'staggered') return POSES.stagger;
  if (fighter.state === 'downed' || fighter.state === 'defeated') return POSES.downed;
  if (fighter.state === 'recovering') return POSES.recovery;
  if (fighter.state === 'victorious') return POSES.victory;
  return fighter.state === 'locomotion' ? (Math.hypot(fighter.velocity.x, fighter.velocity.z) > 3.8 ? POSES.run : POSES.walk) : POSES.combatIdle;
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
