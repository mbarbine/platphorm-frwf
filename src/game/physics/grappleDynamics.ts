import { fighterById } from '../data/fighters';
import { getMove } from '../data/moves';
import type { FighterRuntime, GrapplePosition, GrappleRuntime, MatchModel, Vec2 } from '../types/game';
import { clamp, length, normalize } from '../utils/math';

type FighterKey = 'player' | 'opponent';

const MOVE_POSITIONS: Readonly<Record<string, GrapplePosition>> = {
  slam: 'underhook',
  suplex: 'rearWaistLock',
  takedown: 'armControl',
  whip: 'armControl',
  arm_drag: 'armControl',
  skyhook: 'frontFacelock',
  powerbomb: 'frontFacelock',
  clutch: 'headlock',
  spinebuster: 'waistLock',
  side_toss: 'overhook',
  mountain_drop: 'waistLock',
  finisher: 'collarTie',
};

const HOLD_OFFSETS: Readonly<Record<GrapplePosition, { forward: number; side: number }>> = {
  collarTie: { forward: .78, side: 0 },
  overhook: { forward: .68, side: .2 },
  underhook: { forward: .65, side: 0 },
  headlock: { forward: .48, side: .42 },
  waistLock: { forward: .55, side: 0 },
  rearWaistLock: { forward: -.5, side: 0 },
  frontFacelock: { forward: .57, side: .1 },
  armControl: { forward: .9, side: .28 },
};

const LIFT_HEIGHTS: Readonly<Record<string, number>> = {
  slam: .9,
  suplex: 1.08,
  takedown: .2,
  whip: .08,
  arm_drag: .25,
  skyhook: 1.42,
  powerbomb: 1.7,
  clutch: .18,
  spinebuster: .74,
  side_toss: .62,
  mountain_drop: 1.48,
  finisher: 1.3,
};

const wrapAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

export const grapplePositionForMove = (moveId: string): GrapplePosition => MOVE_POSITIONS[moveId] ?? 'collarTie';

export const createGrappleRuntime = (attacker: FighterKey, defender: FighterKey, moveId: string): GrappleRuntime => ({
  attacker,
  defender,
  position: grapplePositionForMove(moveId),
  leverage: 0,
  tension: 0,
  rotation: 0,
  lift: 0,
  struggle: 0,
  age: 0,
});

export const retargetGrapple = (grapple: GrappleRuntime, moveId: string): void => {
  grapple.position = grapplePositionForMove(moveId);
};

const inputFor = (key: FighterKey, playerIntent: Vec2, opponentIntent: Vec2): Vec2 => key === 'player' ? playerIntent : opponentIntent;

const addConstraintVelocity = (fighter: FighterRuntime, force: Vec2, dt: number, sign: number): void => {
  const accelerationScale = 92 / Math.max(55, fighter.body.mass);
  fighter.velocity.x += force.x * dt * accelerationScale * sign;
  fighter.velocity.z += force.z * dt * accelerationScale * sign;
};

export interface GrappleStepResult {
  broken: boolean;
  liftEnergy: number;
}

/** A soft two-body constraint. It preserves mass and momentum instead of placing either fighter. */
export const stepGrappleDynamics = (model: MatchModel, dt: number, playerIntent: Vec2, opponentIntent: Vec2): GrappleStepResult => {
  const grapple = model.grapple;
  if (!grapple) return { broken: false, liftEnergy: 0 };
  const attacker = model[grapple.attacker];
  const defender = model[grapple.defender];
  if (!attacker.moveId || !['grappling', 'attacking'].includes(attacker.state) || defender.state !== 'grabbed') {
    return { broken: true, liftEnergy: 0 };
  }

  const move = getMove(attacker.moveId);
  const attackerDefinition = fighterById(attacker.definitionId);
  const defenderDefinition = fighterById(defender.definitionId);
  const attackerIntent = inputFor(grapple.attacker, playerIntent, opponentIntent);
  const defenderIntent = inputFor(grapple.defender, playerIntent, opponentIntent);
  const attackerInput = Math.min(1, length(attackerIntent));
  const defenderInput = Math.min(1, length(defenderIntent));
  grapple.age += dt;
  grapple.position = grapplePositionForMove(move.id);

  const toDefender = { x: defender.position.x - attacker.position.x, z: defender.position.z - attacker.position.z };
  const separation = Math.max(.001, length(toDefender));
  const contactDirection = normalize(toDefender);
  const desiredFacing = Math.atan2(contactDirection.x, contactDirection.z);
  const facingDelta = wrapAngle(desiredFacing - attacker.facing);
  const rotateRate = (1.65 + attackerDefinition.stats.technique / 75) * dt;
  attacker.facing = wrapAngle(attacker.facing + clamp(facingDelta, -rotateRate, rotateRate));

  const forward = { x: Math.sin(attacker.facing), z: Math.cos(attacker.facing) };
  const right = { x: Math.cos(attacker.facing), z: -Math.sin(attacker.facing) };
  const offset = HOLD_OFFSETS[grapple.position];
  const desired = {
    x: attacker.position.x + forward.x * offset.forward + right.x * offset.side,
    z: attacker.position.z + forward.z * offset.forward + right.z * offset.side,
  };
  const error = { x: desired.x - defender.position.x, z: desired.z - defender.position.z };
  const relativeVelocity = { x: defender.velocity.x - attacker.velocity.x, z: defender.velocity.z - attacker.velocity.z };
  const technique = attackerDefinition.stats.technique / 100;
  const power = attackerDefinition.stats.power / 100;
  const defenderBase = defenderDefinition.stats.technique / 100;
  const attackerDrive = (.62 + power * .34 + technique * .38) * attacker.body.muscle * (1 + attackerInput * .08);
  const defenderDrive = (.5 + defenderBase * .28) * defender.body.muscle * (1 + defenderInput * .2);
  grapple.leverage = clamp(attackerDrive / Math.max(.15, defenderDrive), .35, 2.2);
  grapple.struggle = clamp(grapple.struggle + (defenderInput - attackerInput * .45) * dt - dt * .12, 0, 1);

  const stiffness = (13 + technique * 6) * clamp(grapple.leverage, .65, 1.45);
  const damping = 4.8 + technique * 2.2;
  const force = {
    x: clamp(error.x * stiffness - relativeVelocity.x * damping, -18, 18),
    z: clamp(error.z * stiffness - relativeVelocity.z * damping, -18, 18),
  };
  grapple.tension = clamp(Math.hypot(force.x, force.z) / 18, 0, 1);
  grapple.rotation = wrapAngle(Math.atan2(toDefender.x, toDefender.z) - attacker.facing);
  addConstraintVelocity(defender, force, dt, 1);
  addConstraintVelocity(attacker, force, dt, -.62);
  defender.facing = wrapAngle(attacker.facing + (grapple.position === 'rearWaistLock' ? 0 : Math.PI));
  defender.body.balance = clamp(defender.body.balance - grapple.tension * dt * (2.5 + grapple.struggle * 5), 0, 100);
  attacker.body.balance = clamp(attacker.body.balance - grapple.tension * dt * 1.2, 0, 100);

  const progress = clamp(attacker.phaseElapsed / Math.max(.01, move.anticipationDuration), 0, 1);
  const configuredHeight = LIFT_HEIGHTS[move.id] ?? .35;
  const liftWindow = clamp((progress - .18) / .64, 0, 1);
  const massAdvantage = clamp((attacker.body.mass * (.72 + power * .55)) / Math.max(55, defender.body.mass), .55, 1.55);
  const desiredLift = configuredHeight * Math.sin(liftWindow * Math.PI * .5) * massAdvantage * attacker.body.muscle;
  const liftAcceleration = clamp((desiredLift - defender.body.verticalOffset) * 22 - defender.body.verticalVelocity * 4.8, -14, 18);
  defender.body.verticalVelocity += liftAcceleration * dt;
  defender.body.verticalOffset = Math.max(0, defender.body.verticalOffset);
  grapple.lift = defender.body.verticalOffset;

  const impossibleStretch = separation > 3.25 && grapple.age > .16;
  const leverageBreak = grapple.struggle > .94 && grapple.leverage < .78 && grapple.age > .45;
  return { broken: impossibleStretch || leverageBreak, liftEnergy: Math.max(0, liftAcceleration) * defender.body.mass / 100 };
};

export const releaseGrapple = (model: MatchModel, defenderState: FighterRuntime['state'] = 'staggered'): void => {
  if (!model.grapple) return;
  const defender = model[model.grapple.defender];
  if (defender.state === 'grabbed') {
    defender.state = defenderState;
    defender.stateElapsed = 0;
  }
  model.grapple = null;
};
