import type { RapierRigidBody } from '@react-three/rapier';
import type { FrameInput } from '../systems/combat';
import type { BodyRegion, FighterRuntime, GameCommand, MatchModel, Vec2 } from '../types/game';
import { clamp } from '../utils/math';
import type { BodySegmentId } from './bodySchema';
import { computeMotorTorque } from './motorController';
import { PhysicsReplayBuffer } from './replayBuffer';

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

const EMPTY_INTENT = (): IntentState => ({ move: { x: 0, z: 0 }, run: false, block: false });
const MAX_COMMANDS = 32;
const MAX_CONTACTS = 128;
const COMMAND_BUFFER_SECONDS = .13;

/** Imperative simulation state. It is intentionally outside React and Zustand. */
export class BodyWorksRuntime {
  private readonly rigs = new Map<FighterKey, FighterRigRegistration>();
  private readonly intents: Record<FighterKey, IntentState> = { player: EMPTY_INTENT(), opponent: EMPTY_INTENT() };
  private readonly commands: BufferedPhysicsCommand[] = [];
  private readonly contacts: BodyWorksContact[] = [];
  private commandId = 0;
  private contactId = 0;
  private generation = 0;
  readonly replay = new PhysicsReplayBuffer(300);
  readonly metrics: BodyWorksMetrics = { fixedSteps: 0, bodyCount: 0, jointCount: 0, gripCount: 0, contactCount: 0, emergencyResetCount: 0, lastStepMs: 0, maximumStepMs: 0 };

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
    this.contactId += 1;
    this.contacts.push({ id: this.contactId, ...contact });
    if (this.contacts.length > MAX_CONTACTS) this.contacts.splice(0, this.contacts.length - MAX_CONTACTS);
    this.metrics.contactCount += 1;
  }

  consumeContacts(): readonly BodyWorksContact[] { const result = this.contacts.splice(0); return result; }

  beforeFixedStep(dt: number, model: MatchModel): void {
    const startedAt = performance.now();
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

  private applyPoseDrive(rig: FighterRigRegistration, fighter: FighterRuntime): void {
    const falling = ['airborne', 'downed', 'defeated'].includes(fighter.state);
    const strength = fighter.state === 'defeated' ? .025 : falling ? .16 : fighter.state === 'staggered' ? .42 : .82;
    const fatigue = 1 - fighter.body.muscle;
    for (const [segment, body] of Object.entries(rig.bodies) as [BodySegmentId, RapierRigidBody][]) {
      if (segment === 'pelvis') continue;
      const torque = computeMotorTorque(body.rotation(), { x: 0, y: 0, z: 0, w: 1 }, body.angvel(), { x: 0, y: 0, z: 0 }, {
        stiffness: segment === 'head' ? 7 : 11,
        damping: segment === 'head' ? 1.8 : 2.5,
        maxTorque: segment.includes('Hand') || segment.includes('Foot') ? .18 : .42,
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
    this.generation += 1; this.rigs.clear(); this.commands.length = 0; this.contacts.length = 0; this.replay.clear();
    this.intents.player = EMPTY_INTENT(); this.intents.opponent = EMPTY_INTENT();
    this.metrics.fixedSteps = 0; this.metrics.bodyCount = 0; this.metrics.jointCount = 0; this.metrics.gripCount = 0; this.metrics.contactCount = 0; this.metrics.lastStepMs = 0; this.metrics.maximumStepMs = 0;
  }

  pendingCommandCount(): number { return this.commands.length; }
}

const fighterBySpeed = (fighter: FighterRuntime): number => fighter.definitionId === 'vex' ? 97 : fighter.definitionId === 'nova' ? 77 : fighter.definitionId === 'brick' ? 76 : fighter.definitionId === 'chad' ? 67 : 48;

export const bodyWorksRuntime = new BodyWorksRuntime();
