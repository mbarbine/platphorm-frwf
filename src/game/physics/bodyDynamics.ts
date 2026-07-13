import { clamp, length, normalize } from '../utils/math';
import type { BodyDynamicsRuntime, BodyRegion, CollisionOutcome, FighterDefinition, FighterRuntime, MoveDefinition, Vec2 } from '../types/game';

const wrapAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));
const approach = (value: number, target: number, maximumDelta: number): number => value + clamp(target - value, -maximumDelta, maximumDelta);

export interface ImpactCalculation {
  region: BodyRegion;
  direction: Vec2;
  force: number;
  torque: number;
  verticalImpulse: number;
  closingSpeed: number;
}

export const createBodyDynamics = (definition: FighterDefinition): BodyDynamicsRuntime => {
  const mass = definition.physics.massKg;
  return {
    mass,
    inertia: Math.round(mass * (.72 + definition.proportions.height * .28) * 10) / 10,
    balance: 100,
    muscle: 1,
    leanForward: 0,
    leanSide: 0,
    twist: 0,
    headSnap: 0,
    pelvisDrop: 0,
    leanVelocity: 0,
    sideVelocity: 0,
    twistVelocity: 0,
    headVelocity: 0,
    verticalOffset: 0,
    verticalVelocity: 0,
    gaitPhase: 0,
    stride: 0,
    leftFoot: { planted: true, phase: 0, lift: 0, offset: { x: 0, z: 0 } },
    rightFoot: { planted: true, phase: Math.PI, lift: 0, offset: { x: 0, z: 0 } },
    stumble: 0,
    impactEnergy: 0,
    lastImpactRegion: null,
  };
};

const updateFoot = (fighter: FighterRuntime, foot: BodyDynamicsRuntime['leftFoot'], phase: number, stride: number, side: number): void => {
  const cycle = Math.sin(phase);
  foot.phase = phase;
  foot.planted = cycle <= .12;
  foot.lift = Math.max(0, cycle) * (.08 + stride * .11);
  const forward = Math.cos(phase) * stride * .34;
  const forwardVector = { x: Math.sin(fighter.facing), z: Math.cos(fighter.facing) };
  const rightVector = { x: Math.cos(fighter.facing), z: -Math.sin(fighter.facing) };
  foot.offset = { x: forwardVector.x * forward + rightVector.x * side, z: forwardVector.z * forward + rightVector.z * side };
};

export const integrateLocomotion = (fighter: FighterRuntime, definition: FighterDefinition, desiredMove: Vec2, running: boolean, dt: number): void => {
  const body = fighter.body;
  const desiredMagnitude = Math.min(1, length(desiredMove));
  const desiredDirection = desiredMagnitude > .001 ? normalize(desiredMove) : { x: 0, z: 0 };
  const speed = length(fighter.velocity);
  const massFactor = clamp(112 / body.mass, .72, 1.28);
  const exhausted = fighter.stamina < fighter.staminaCap * .2;
  const topSpeed = (running ? 5.25 : 3.2) * (.72 + definition.stats.speed / 250) * (exhausted ? .78 : 1);
  const targetVelocity = { x: desiredDirection.x * topSpeed * desiredMagnitude, z: desiredDirection.z * topSpeed * desiredMagnitude };
  const accelerating = desiredMagnitude > .08;
  const acceleration = (6.2 + definition.stats.speed * .067) * massFactor * (running ? 1.04 : 1);
  const deceleration = (accelerating ? acceleration : 7.4 * massFactor) * (running && !accelerating ? .68 : 1);
  const previousVelocity = { ...fighter.velocity };
  fighter.velocity.x = approach(fighter.velocity.x, targetVelocity.x, deceleration * dt);
  fighter.velocity.z = approach(fighter.velocity.z, targetVelocity.z, deceleration * dt);

  if (accelerating) {
    const desiredFacing = Math.atan2(desiredDirection.x, desiredDirection.z);
    const turnDifference = wrapAngle(desiredFacing - fighter.facing);
    const speedControl = 1 - clamp(speed / 9, 0, .48);
    const turnRate = (2.4 + definition.stats.speed / 32) * massFactor * speedControl;
    fighter.facing = wrapAngle(fighter.facing + clamp(turnDifference, -turnRate * dt, turnRate * dt));
    const currentDirection = speed > .1 ? normalize(previousVelocity) : desiredDirection;
    const directionDot = currentDirection.x * desiredDirection.x + currentDirection.z * desiredDirection.z;
    const turnStress = Math.max(0, 1 - directionDot) * speed * body.mass / 185 * dt;
    body.balance = clamp(body.balance - turnStress * (running ? 1.2 : .72), 0, 100);
    body.sideVelocity += wrapAngle(desiredFacing - Math.atan2(previousVelocity.x, previousVelocity.z)) * speed * dt * .14;
  }

  const accelerationDelta = Math.hypot(fighter.velocity.x - previousVelocity.x, fighter.velocity.z - previousVelocity.z) / Math.max(dt, .001);
  const desiredLean = accelerating ? clamp(accelerationDelta / 38 + speed / 34, 0, running ? .3 : .18) : clamp(speed / 42, 0, .12);
  body.leanVelocity += (desiredLean - body.leanForward) * dt * 16;
  body.stride = clamp(speed / Math.max(.1, topSpeed), 0, 1) * (running ? 1 : .68);
  if (speed > .08) body.gaitPhase += speed * dt * (1.55 + definition.stats.speed / 180);
  updateFoot(fighter, body.leftFoot, body.gaitPhase, body.stride, -.16 * definition.proportions.width);
  updateFoot(fighter, body.rightFoot, body.gaitPhase + Math.PI, body.stride, .16 * definition.proportions.width);
};

export const stepBodyDynamics = (fighter: FighterRuntime, dt: number): { landed: boolean; landingEnergy: number } => {
  const body = fighter.body;
  const staminaRatio = fighter.staminaCap > 0 ? fighter.stamina / fighter.staminaCap : 0;
  body.muscle = clamp(staminaRatio * .68 + fighter.health / 100 * .32, .16, 1);
  const desiredPelvisDrop = (1 - body.muscle) * .2 + (body.balance < 40 ? (40 - body.balance) / 230 : 0);
  body.pelvisDrop += (desiredPelvisDrop - body.pelvisDrop) * Math.min(1, dt * 7);
  body.stumble = Math.max(0, body.stumble - dt * body.muscle * .72);
  body.impactEnergy = Math.max(0, body.impactEnergy - dt * 11);

  body.leanVelocity += -body.leanForward * dt * 13;
  body.sideVelocity += -body.leanSide * dt * 15;
  body.twistVelocity += -body.twist * dt * 17;
  body.headVelocity += -body.headSnap * dt * 21;
  const damping = Math.exp(-dt * (4.2 + body.muscle * 2.4));
  body.leanVelocity *= damping; body.sideVelocity *= damping; body.twistVelocity *= damping; body.headVelocity *= damping;
  body.leanForward = clamp(body.leanForward + body.leanVelocity * dt, -.95, .95);
  body.leanSide = clamp(body.leanSide + body.sideVelocity * dt, -.85, .85);
  body.twist = clamp(body.twist + body.twistVelocity * dt, -1.2, 1.2);
  body.headSnap = clamp(body.headSnap + body.headVelocity * dt, -1.1, 1.1);

  const recoverable = ['idle', 'locomotion', 'blocking', 'downed', 'recovering'].includes(fighter.state);
  if (recoverable && body.verticalOffset <= .001) body.balance = clamp(body.balance + dt * (2.5 + body.muscle * 6.5), 0, 100);

  let landed = false; let landingEnergy = 0;
  if (body.verticalOffset > 0 || Math.abs(body.verticalVelocity) > .01) {
    body.verticalVelocity -= 18 * dt;
    body.verticalOffset += body.verticalVelocity * dt;
    if (body.verticalOffset <= 0) {
      landingEnergy = Math.abs(body.verticalVelocity) * body.mass / 115;
      landed = body.verticalVelocity < -1.2;
      body.verticalOffset = 0;
      body.verticalVelocity = body.verticalVelocity < -4 ? -body.verticalVelocity * .14 : 0;
      if (body.verticalVelocity > 0) body.verticalOffset = .01;
      body.balance = clamp(body.balance - landingEnergy * .7, 0, 100);
      body.leanVelocity -= landingEnergy * .025;
    }
  }
  return { landed, landingEnergy };
};

export const bodyRegionForMove = (move: MoveDefinition, sequence: number): BodyRegion => {
  if (move.id === 'jab' || move.id === 'heavy' || move.id === 'stiff_arm') return 'head';
  if (move.id === 'combo' || move.id === 'ground') return 'ribs';
  if (move.category === 'grapple' || move.category === 'finisher') return move.id === 'clutch' ? 'head' : 'pelvis';
  if (move.category === 'aerial') return 'chest';
  if (move.category === 'prop') return sequence % 3 === 0 ? 'leftArm' : sequence % 3 === 1 ? 'head' : 'ribs';
  return 'chest';
};

export const calculateImpact = (actor: FighterRuntime, target: FighterRuntime, move: MoveDefinition, sequence: number): ImpactCalculation => {
  const direction = normalize({ x: target.position.x - actor.position.x, z: target.position.z - actor.position.z });
  const relativeVelocity = { x: actor.velocity.x - target.velocity.x, z: actor.velocity.z - target.velocity.z };
  const closingSpeed = Math.max(0, relativeVelocity.x * direction.x + relativeVelocity.z * direction.z);
  const categoryDrive = move.category === 'finisher' ? 2.4 : move.category === 'grapple' ? 1.75 : move.category === 'aerial' ? 2 : move.category === 'prop' ? 1.55 : 1;
  const massTransfer = actor.body.mass / Math.max(1, actor.body.mass + target.body.mass) * 2;
  const force = (closingSpeed + move.knockback * 2.4 + move.damage * .16) * massTransfer * categoryDrive;
  const contactFacing = Math.atan2(direction.x, direction.z);
  const contactAngle = wrapAngle(actor.facing - contactFacing);
  const region = bodyRegionForMove(move, sequence);
  const regionTorque = region === 'head' ? 1.28 : region === 'ribs' ? .92 : region === 'pelvis' ? .72 : 1;
  const torque = (Math.sin(contactAngle) * .7 + (sequence % 2 === 0 ? -.18 : .18)) * force * .11 * regionTorque;
  const verticalImpulse = move.category === 'aerial' ? -2.8 : move.category === 'grapple' || move.category === 'finisher' ? -1.8 : move.id === 'stiff_arm' ? 1.25 : .15;
  return { region, direction, force: Math.round(force * 100) / 100, torque: Math.round(torque * 100) / 100, verticalImpulse, closingSpeed };
};

export const applyLocalizedImpact = (target: FighterRuntime, impact: ImpactCalculation): CollisionOutcome => {
  const body = target.body;
  const plantedCount = Number(body.leftFoot.planted) + Number(body.rightFoot.planted);
  const stanceFactor = plantedCount === 2 ? .82 : plantedCount === 1 ? 1 : 1.2;
  const regionBalance = impact.region === 'head' ? 1.28 : impact.region === 'pelvis' ? 1.12 : impact.region.includes('Leg') ? 1.38 : .94;
  const balanceLoss = impact.force * regionBalance * stanceFactor * (1.28 - body.muscle * .28) * (112 / body.mass);
  body.balance = clamp(body.balance - balanceLoss, 0, 100);
  body.impactEnergy = Math.max(body.impactEnergy, impact.force);
  body.lastImpactRegion = impact.region;
  body.stumble = Math.max(body.stumble, clamp(balanceLoss / 28, .12, 1));
  body.twistVelocity += impact.torque / Math.max(1, body.inertia) * 15;
  body.sideVelocity += impact.torque * .035;
  body.leanVelocity -= impact.force * (impact.region === 'head' ? .052 : .035);
  if (impact.region === 'head') body.headVelocity -= impact.force * .075;
  if (impact.region === 'ribs' || impact.region === 'chest') body.twistVelocity += (impact.torque >= 0 ? 1 : -1) * impact.force * .026;
  if (impact.region === 'pelvis' || impact.region.includes('Leg')) body.pelvisDrop = clamp(body.pelvisDrop + impact.force * .012, 0, .45);
  const speedChange = impact.force * (108 / body.mass) * .15;
  target.velocity.x += impact.direction.x * speedChange;
  target.velocity.z += impact.direction.z * speedChange;
  if (impact.verticalImpulse > 0) body.verticalVelocity = Math.max(body.verticalVelocity, impact.verticalImpulse);
  else if (body.verticalOffset > .04) body.verticalVelocity = Math.min(body.verticalVelocity, impact.verticalImpulse);

  if (impact.force > 16 || body.balance < 12) return 'launch';
  if (body.balance < 24) return 'fall';
  if (impact.region.includes('Leg') && body.balance < 52) return 'trip';
  if (Math.abs(impact.torque) > .9 && body.balance < 62) return 'spin';
  if (body.balance < 68 || impact.force > 6) return 'stagger';
  return 'absorbed';
};
