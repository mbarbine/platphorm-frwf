// @vitest-environment node
import { loadContactSkin, visibleSurfaceGap } from './helpers/skinnedContact';
import { strikeDriveProfile } from '../game/physics/strikeDynamics';
import { configureCombatVenue, VENUES, type CombatVenue } from '../game/data/venues';
import { ColliderDesc, JointData, RigidBodyDesc, World, init } from '@dimforge/rapier3d-compat';
import type { RigidBody } from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIGHTERS, fighterById } from '../game/data/fighters';
import { buildBodySchema, extremityColliderShape, HEAD_COLLIDER_OFFSET, torsoColliderArgs } from '../game/physics/bodySchema';
import type { BodySegmentId, BodySegmentSchema } from '../game/physics/bodySchema';
import { shortestQuaternionError } from '../game/physics/motorController';
import { arenaCollisionGroups, fighterCollisionGroups } from '../game/physics/collisionGroups';
import { BodyWorksRuntime } from '../game/physics/physicsRuntime';
import { RINGSIDE_THRESHOLD } from '../game/physics/ringDynamics';
import { advanceMatch, applyPhysicalContact, createMatch, requestCommand } from '../game/systems/combat';
import { FALL_REASONS } from '../game/types/game';
import type { FighterId, FighterSlot, MatchModel, Vec2 } from '../game/types/game';

const STEP = 1 / 60;
const STILL = { move: { x: 0, z: 0 }, run: false, block: false, commands: [] } as const;

interface HeadlessRig {
  bodies: Record<BodySegmentId, RigidBody>;
  joints: number;
}

const schemaById = (schema: readonly BodySegmentSchema[]): Map<BodySegmentId, BodySegmentSchema> => new Map(schema.map((entry) => [entry.id, entry]));

const createHeadlessRig = (world: World, fighterId: FighterId, slot: FighterSlot, x: number): HeadlessRig => {
  const schema = buildBodySchema(fighterById(fighterId));
  const byId = schemaById(schema); const bodies = {} as Record<BodySegmentId, RigidBody>;
  for (const segment of schema) {
    const body = world.createRigidBody(RigidBodyDesc.dynamic()
      .setTranslation(x + segment.localPosition[0], 1.8 + segment.localPosition[1], segment.localPosition[2])
      .setLinearDamping(.55).setAngularDamping(2.2).setCanSleep(true).enabledRotations(false, false, false).setAdditionalSolverIterations(4).setCcdEnabled(segment.attackEligible || ['head', 'pelvis', 'abdomen', 'chest'].includes(segment.id)));
    const torsoArgs = torsoColliderArgs(segment);
    const extremity = extremityColliderShape(segment);
    const collider = torsoArgs ? ColliderDesc.roundCuboid(...torsoArgs) : segment.id === 'head' ? ColliderDesc.ball(segment.radius).setTranslation(...HEAD_COLLIDER_OFFSET)
      : extremity
        ? ColliderDesc.cuboid(...extremity.args).setTranslation(...extremity.position)
        : ColliderDesc.capsule(segment.halfLength, segment.radius);
    world.createCollider(collider.setMass(segment.massKg).setFriction(segment.id.includes('Foot') ? 1.45 : .76).setRestitution(.015).setCollisionGroups(fighterCollisionGroups(slot)), body);
    bodies[segment.id] = body;
  }
  const entry = (id: BodySegmentId): BodySegmentSchema => {
    const result = byId.get(id); if (!result) throw new Error(`Missing headless segment ${id}`); return result;
  };
  const anchors = (parent: BodySegmentId, child: BodySegmentId): readonly [{ x: number; y: number; z: number }, { x: number; y: number; z: number }] => {
    const halfDelta = (entry(child).localPosition[1] - entry(parent).localPosition[1]) * .5;
    return [{ x: 0, y: halfDelta, z: 0 }, { x: 0, y: -halfDelta, z: 0 }];
  };
  const spherical = (parent: BodySegmentId, child: BodySegmentId, parentX = 0): void => {
    const [a, b] = anchors(parent, child); a.x = parentX; world.createImpulseJoint(JointData.spherical(a, b), bodies[parent], bodies[child], true);
  };
  const revolute = (parent: BodySegmentId, child: BodySegmentId, limits: readonly [number, number]): void => {
    const [a, b] = anchors(parent, child); if (child.includes('Foot')) b.z = -.03; const data = JointData.revolute(a, b, { x: 1, y: 0, z: 0 }); data.limitsEnabled = true; data.limits = [...limits];
    world.createImpulseJoint(data, bodies[parent], bodies[child], true);
  };
  spherical('pelvis', 'abdomen'); spherical('abdomen', 'chest'); spherical('chest', 'head');
  spherical('chest', 'leftUpperArm', -Math.abs(entry('leftUpperArm').localPosition[0])); spherical('chest', 'rightUpperArm', Math.abs(entry('rightUpperArm').localPosition[0]));
  revolute('leftUpperArm', 'leftForearm', [-2.65, .08]); revolute('rightUpperArm', 'rightForearm', [-2.65, .08]); spherical('leftForearm', 'leftHand'); spherical('rightForearm', 'rightHand');
  spherical('pelvis', 'leftThigh', -Math.abs(entry('leftThigh').localPosition[0])); spherical('pelvis', 'rightThigh', Math.abs(entry('rightThigh').localPosition[0]));
  revolute('leftThigh', 'leftShin', [-.08, 2.58]); revolute('rightThigh', 'rightShin', [-.08, 2.58]); revolute('leftShin', 'leftFoot', [-.58, .68]); revolute('rightShin', 'rightFoot', [-.58, .68]);
  return { bodies, joints: 15 };
};

const makeHarness = (fighterId: FighterId = 'atlas'): { world: World; runtime: BodyWorksRuntime; model: MatchModel; rig: HeadlessRig } => {
  const world = new World({ x: 0, y: -18, z: 0 }); world.timestep = STEP; world.numSolverIterations = 8; world.numInternalPgsIterations = 2; world.maxCcdSubsteps = 2;
  const mat = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(0, 1.52, 0));
  world.createCollider(ColliderDesc.cuboid(6, .325, 4.5).setFriction(1.1).setCollisionGroups(arenaCollisionGroups), mat);
  const runtime = new BodyWorksRuntime(); const model = createMatch(fighterId, fighterId === 'nova' ? 'atlas' : 'nova', 'standard', 'normal', 913); model.physicsAuthority = true; model.aiThinkTimer = 999; model.aiControllers.opponent.thinkTimer = 999;
  runtime.setJointData(JointData);
  runtime.registerLandingSurface('ring', 'ring', mat);
  const rig = createHeadlessRig(world, fighterId, 'player', -1.6); runtime.registerFighter('player', rig.bodies, rig.joints);
  runtime.setFootContact('player', 'leftFoot', true); runtime.setFootContact('player', 'rightFoot', true);
  return { world, runtime, model, rig };
};

const stepHarness = (world: World, runtime: BodyWorksRuntime, model: MatchModel, movement: Vec2 = STILL.move, run = false, block = false): void => {
  const input = { move: movement, run, block, commands: [] };
  runtime.captureInput('player', input, model.elapsed); advanceMatch(model, STEP, input); runtime.beforeFixedStep(STEP, model, world); world.step(); runtime.afterFixedStep(model);
  for (const contact of runtime.consumeContacts()) applyPhysicalContact(model, contact);
};

const makeGrappleHarness = (venue?: CombatVenue, fighterId: FighterId = 'atlas', opponentId: FighterId = 'nova'): { world: World; runtime: BodyWorksRuntime; model: MatchModel; player: HeadlessRig; opponent: HeadlessRig } => {
  const world = new World({ x: 0, y: -18, z: 0 }); world.timestep = STEP; world.numSolverIterations = 8; world.numInternalPgsIterations = 2; world.maxCcdSubsteps = 2;
  const mat = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(0, 1.52, 0));
  world.createCollider(ColliderDesc.cuboid(venue ? VENUES[venue].halfWidth + 1 : 6, .325, venue ? VENUES[venue].halfDepth + 1 : 4.5).setFriction(1.1).setCollisionGroups(arenaCollisionGroups), mat);
  const runtime = new BodyWorksRuntime(); const model = createMatch(fighterId, opponentId, 'standard', 'normal', 1217);
  if (venue) configureCombatVenue(model, venue);
  model.physicsAuthority = true; model.labMode = true; model.aiThinkTimer = 999; model.aiControllers.opponent.thinkTimer = 999;
  model.player.position = { x: -.8, z: 0 }; model.opponent.position = { x: .8, z: 0 };
  model.player.facing = Math.PI / 2; model.opponent.facing = -Math.PI / 2;
  runtime.setJointData(JointData); runtime.registerLandingSurface('ring', venue && venue !== 'dome' ? 'floor' : 'ring', mat);
  const player = createHeadlessRig(world, fighterId, 'player', -.8); const opponent = createHeadlessRig(world, opponentId, 'opponent', .8);
  runtime.registerFighter('player', player.bodies, player.joints); runtime.registerFighter('opponent', opponent.bodies, opponent.joints);
  runtime.setFootContact('player', 'leftFoot', true); runtime.setFootContact('player', 'rightFoot', true);
  runtime.setFootContact('opponent', 'leftFoot', true); runtime.setFootContact('opponent', 'rightFoot', true);
  return { world, runtime, model, player, opponent };
};

const stepGrappleHarness = (world: World, runtime: BodyWorksRuntime, model: MatchModel): void => {
  const input = { move: STILL.move, run: false, block: false, commands: [] };
  advanceMatch(model, STEP, input); runtime.beforeFixedStep(STEP, model, world); world.step(); runtime.afterFixedStep(model);
  for (const contact of runtime.consumeContacts()) applyPhysicalContact(model, contact);
};

beforeAll(async () => { await init(); });

describe('Rapier-backed Bodyworks integration', () => {
  it.each(FIGHTERS)('keeps $id idle free of wrist flips and arm vibration', (fighter) => {
    const { world, runtime, model, rig } = makeHarness(fighter.id);
    try {
      model.labMode = true;
      for (let frame = 0; frame < 240; frame++) stepHarness(world, runtime, model);
      let peakSpeed = 0; let peakWristAngle = 0;
      for (let frame = 0; frame < 180; frame++) {
        stepHarness(world, runtime, model);
        for (const side of ['left', 'right'] as const) {
          for (const part of ['UpperArm', 'Forearm', 'Hand'] as const) {
            const spin = rig.bodies[`${side}${part}`].angvel();
            peakSpeed = Math.max(peakSpeed, Math.hypot(spin.x, spin.y, spin.z));
          }
          const error = shortestQuaternionError(rig.bodies[`${side}Hand`].rotation(), rig.bodies[`${side}Forearm`].rotation());
          peakWristAngle = Math.max(peakWristAngle, Math.hypot(error.x, error.y, error.z));
        }
      }
      expect(peakSpeed, `Idle arm angular speed: ${peakSpeed}; wrist error: ${peakWristAngle}`).toBeLessThan(1);
      expect(peakWristAngle).toBeLessThan(.35);
      expect(runtime.metrics.emergencyResetCount).toBe(0);
    } finally { runtime.reset(); world.free(); }
  });

  it.each(FIGHTERS)('raises $id hands toward the chin when guard is held', fighter => {
    const { world, runtime, model, rig } = makeHarness(fighter.id);
    try {
      model.labMode = true;
      for (let frame = 0; frame < 180; frame++) stepHarness(world, runtime, model);
      for (let frame = 0; frame < 60; frame++) stepHarness(world, runtime, model, STILL.move, false, true);
      expect(model.player.state).toBe('blocking');
      const head = rig.bodies.head.translation();
      for (const side of ['left', 'right'] as const) {
        expect(rig.bodies[`${side}Hand`].translation().y).toBeGreaterThan(head.y - .35);
      }
    } finally { runtime.reset(); world.free(); }
  });

  it('unwinds a bent torso when control returns instead of locking the hit pose', () => {
    const { world, runtime, model, rig } = makeHarness();
    try {
      model.labMode = true;
      for (let frame = 0; frame < 60; frame++) stepHarness(world, runtime, model);
      rig.bodies.chest.setRotation({ x: Math.sin(.55), y: 0, z: 0, w: Math.cos(.55) }, true);
      for (let frame = 0; frame < 180; frame++) stepHarness(world, runtime, model);
      const chest = rig.bodies.chest.rotation();
      expect(1 - 2 * (chest.x * chest.x + chest.z * chest.z)).toBeGreaterThan(.9);
      expect(runtime.fighterSnapshot('player').headY).toBeGreaterThan(runtime.fighterSnapshot('player').pelvisY + .65);
      expect(runtime.metrics.emergencyResetCount).toBe(0);
    } finally { runtime.reset(); world.free(); }
  });
  it.each(['back', 'front', 'left', 'right'] as const)('recovers from a %s fall to supported player control', (orientation) => {
    const { world, runtime, model } = makeHarness();
    try {
      model.labMode = true;
      for (let frame = 0; frame < 45; frame++) stepHarness(world, runtime, model);
      runtime.prepareLabFall('player', orientation, model.player.facing);
      model.player.state = 'downed'; model.player.stateElapsed = 0; model.player.downTimer = .75;
      model.player.recoveryOrientation = orientation;
      for (let frame = 0; frame < 300; frame++) stepHarness(world, runtime, model);
      const snapshot = runtime.fighterSnapshot('player');
      expect(model.player.state, JSON.stringify(snapshot)).toBe('idle');
      expect(snapshot.upright).toBeGreaterThan(.8);
      expect(snapshot.supportFeet).toBeGreaterThan(0);
      expect(runtime.metrics.emergencyResetCount).toBe(0);
      expect(requestCommand(model, 'player', 'heavy')).toBe(true);
    } finally { runtime.reset(); world.free(); }
  });

  it.each(['back', 'front', 'left', 'right'] as const)('Get Up stands from a %s fall with no stamina, even when pressed repeatedly', (orientation) => {
    const { world, runtime, model } = makeHarness();
    try {
      model.labMode = true;
      for (let frame = 0; frame < 60; frame++) stepHarness(world, runtime, model);
      runtime.prepareLabFall('player', orientation, model.player.facing);
      model.player.state = 'downed'; model.player.stateElapsed = 0; model.player.downTimer = 15;
      model.player.recoveryOrientation = orientation;
      for (let frame = 0; frame < 30; frame++) stepHarness(world, runtime, model);
      model.player.stamina = 0;
      expect(requestCommand(model, 'player', 'dodge')).toBe(true);
      let standing = false;
      for (let frame = 0; frame < 300; frame++) {
        if (String(model.player.state) === 'recovering' && frame % 6 === 0) expect(requestCommand(model, 'player', 'dodge')).toBe(true);
        stepHarness(world, runtime, model);
        if (String(model.player.state) === 'idle') {
          const snapshot = runtime.fighterSnapshot('player');
          expect(snapshot.upright).toBeGreaterThan(.9);
          expect(snapshot.headY).toBeGreaterThan(snapshot.pelvisY + .65);
          expect(snapshot.supportFeet).toBeGreaterThan(0);
          standing = true; break;
        }
      }
      expect(standing, JSON.stringify(runtime.fighterSnapshot('player'))).toBe(true);
      expect(runtime.metrics.emergencyResetCount).toBe(0);
    } finally { runtime.reset(); world.free(); }
  });

  it('holds a 16-body fighter upright without planar drift through a one-minute fixed-step soak', () => {
    const { world, runtime, model, rig } = makeHarness(); stepHarness(world, runtime, model);
    const initialPosition = { ...model.player.position };
    let minimumX = initialPosition.x; let maximumX = initialPosition.x; let minimumZ = initialPosition.z; let maximumZ = initialPosition.z;
    for (let frame = 1; frame < 3_600; frame += 1) {
      stepHarness(world, runtime, model);
      minimumX = Math.min(minimumX, model.player.position.x); maximumX = Math.max(maximumX, model.player.position.x);
      minimumZ = Math.min(minimumZ, model.player.position.z); maximumZ = Math.max(maximumZ, model.player.position.z);
    }
    const snapshot = runtime.fighterSnapshot('player');
    expect(Object.values(rig.bodies).every((body) => [body.translation().x, body.translation().y, body.translation().z, body.linvel().x, body.linvel().y, body.linvel().z].every(Number.isFinite))).toBe(true);
    expect(snapshot.pelvisY).toBeGreaterThan(2.65); expect(snapshot.pelvisY).toBeLessThan(3.35); expect(snapshot.upright).toBeGreaterThan(.72);
    expect(Math.hypot(model.player.position.x - initialPosition.x, model.player.position.z - initialPosition.z)).toBeLessThan(.08);
    expect(maximumX - minimumX).toBeLessThan(.09); expect(maximumZ - minimumZ).toBeLessThan(.09);
    expect(runtime.metrics.emergencyResetCount, JSON.stringify(runtime.metrics)).toBe(0); expect(runtime.metrics.invalidRegisteredBodyCount).toBe(0); expect(world.bodies.len()).toBe(17); expect(world.impulseJoints.len()).toBe(15);
    runtime.reset(); expect(runtime.metrics.bodyCount).toBe(0); expect(runtime.metrics.jointCount).toBe(0); expect(runtime.replay.size).toBe(0); world.free();
  }, 30_000);

  it('walks, stops, jumps, lands, and resets without leaking runtime state', () => {
    const { world, runtime, model } = makeHarness(); const startX = runtime.fighterSnapshot('player').pelvisY;
    for (let frame = 0; frame < 120; frame += 1) stepHarness(world, runtime, model, { x: 1, z: 0 });
    const travelled = model.player.position.x + 1.6; expect(travelled).toBeGreaterThan(.65);
    for (let frame = 0; frame < 90; frame += 1) stepHarness(world, runtime, model);
    expect(runtime.fighterSnapshot('player').speed).toBeLessThan(1.2);
    model.player.state = 'jumping'; model.player.stateElapsed = 0; runtime.requestJump('player'); let apex = runtime.fighterSnapshot('player').pelvisY;
    for (let frame = 0; frame < 150; frame += 1) { stepHarness(world, runtime, model); apex = Math.max(apex, runtime.fighterSnapshot('player').pelvisY); }
    const landed = runtime.fighterSnapshot('player');
    expect(apex).toBeGreaterThan(startX + .25); expect(landed.pelvisY, JSON.stringify({ state: model.player.state, position: model.player.position, verticalOffset: model.player.body.verticalOffset, verticalVelocity: model.player.body.verticalVelocity, supportFeet: landed.supportFeet, supportScore: runtime.metrics.supportScore })).toBeGreaterThan(2.65); expect(runtime.metrics.emergencyResetCount, JSON.stringify(runtime.metrics)).toBe(0);
    runtime.reset(); expect(runtime.pendingCommandCount()).toBe(0); expect(runtime.metrics.worldBodyCount).toBe(0); expect(runtime.metrics.worldJointCount).toBe(0); world.free();
  });

  it('keeps an impacted Battle Royale wrestler inside the ring instead of stranding the match at ringside', () => {
    const { world, runtime, model, rig } = makeHarness(); model.matchMode = 'battle_royale'; model.player.state = 'downed'; model.player.downTimer = 4;
    for (const body of Object.values(rig.bodies)) body.setLinvel({ x: 13, y: 1.2, z: 8 }, true);
    for (let frame = 0; frame < 240; frame += 1) stepHarness(world, runtime, model);
    expect(Math.abs(model.player.position.x), JSON.stringify({ position: model.player.position, containment: runtime.metrics.containmentCount })).toBeLessThan(5.82);
    expect(Math.abs(model.player.position.z), JSON.stringify({ position: model.player.position, containment: runtime.metrics.containmentCount })).toBeLessThan(4.32);
    expect(runtime.metrics.emergencyResetCount, JSON.stringify(runtime.metrics)).toBe(0);
    world.free();
  });

  it('returns a ring-height rope tunnel without dropping the wrestler through the apron', () => {
    const { world, runtime, model, rig } = makeHarness();
    for (let frame = 0; frame < 45; frame += 1) stepHarness(world, runtime, model);
    const shiftX = RINGSIDE_THRESHOLD.x + .14 - model.player.position.x;
    for (const body of Object.values(rig.bodies)) {
      const position = body.translation(); body.setTranslation({ x: position.x + shiftX, y: position.y, z: position.z }, true);
      body.setLinvel({ x: 5.2, y: 0, z: 0 }, true);
    }
    let minimumPelvisY = runtime.fighterSnapshot('player').pelvisY;
    for (let frame = 0; frame < 150; frame += 1) {
      stepHarness(world, runtime, model);
      minimumPelvisY = Math.min(minimumPelvisY, runtime.fighterSnapshot('player').pelvisY);
    }
    expect(Math.abs(model.player.position.x), JSON.stringify({ position: model.player.position, snapshot: runtime.fighterSnapshot('player'), metrics: runtime.metrics })).toBeLessThan(RINGSIDE_THRESHOLD.x);
    expect(minimumPelvisY).toBeGreaterThan(2.35);
    expect(runtime.metrics.emergencyResetCount, JSON.stringify(runtime.metrics)).toBe(0);
    world.free();
  });

  it('keeps a lifted ringside wrestler outside the ropes instead of springing them back into the ring', () => {
    const { world, runtime, model, rig } = makeHarness();
    try {
      model.labMode = true;
      const floor = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(0, .3, 0));
      world.createCollider(ColliderDesc.cuboid(14, .1, 12).setCollisionGroups(arenaCollisionGroups), floor);
      runtime.prepareLabPositions({ x: 0, z: -6.1 }, { x: 0, z: 2.4 });
      for (let frame = 0; frame < 60; frame++) stepHarness(world, runtime, model);
      // Perturb the connected rig vertically, as a ringside lift does. Raising
      // it to rope height must not change which side of the ropes it occupies.
      for (const body of Object.values(rig.bodies)) {
        const position = body.translation();
        body.setTranslation({ ...position, y: position.y + 1.5 }, true);
      }
      model.player.state = 'airborne'; model.player.stateElapsed = 0;
      for (let frame = 0; frame < 60; frame++) stepHarness(world, runtime, model);
      expect(model.player.position.z).toBeLessThan(-5.5);
      expect(runtime.metrics.emergencyResetCount).toBe(0);
    } finally { runtime.reset(); world.free(); }
  });

  it('climbs from the ringside floor over the solid apron before moving into the ring', () => {
    const { world, runtime, model } = makeHarness();
    try {
      model.labMode = true;
      const floor = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(0, -.1, 0));
      world.createCollider(ColliderDesc.cuboid(14, .1, 12).setCollisionGroups(arenaCollisionGroups), floor);
      for (let frame = 0; frame < 30; frame++) stepHarness(world, runtime, model);
      runtime.prepareLabPositions({ x: 6.52, z: 0 }, { x: 0, z: 2.4 });
      for (let frame = 0; frame < 60; frame++) stepHarness(world, runtime, model);
      expect(model.player.position.x).toBeGreaterThan(6);
      runtime.requestApronTransition('player', model.player.position);
      for (let frame = 0; frame < 240; frame++) stepHarness(world, runtime, model);
      expect(model.player.position.x).toBeLessThan(5.3);
      expect(runtime.fighterSnapshot('player').footY).toBeGreaterThan(1.75);
      expect(runtime.metrics.emergencyResetCount).toBe(0);
    } finally { runtime.reset(); world.free(); }
  });

  it('contains a singles wrestler before the articulated body can disappear below the mat', () => {
    const { world, runtime, model, rig } = makeHarness();
    for (let frame = 0; frame < 30; frame += 1) stepHarness(world, runtime, model);
    for (const body of Object.values(rig.bodies)) {
      const position = body.translation(); body.setTranslation({ x: position.x, y: position.y - 2.2, z: position.z }, true);
      body.setLinvel({ x: 0, y: -2, z: 0 }, true);
    }
    stepHarness(world, runtime, model);
    expect(runtime.fighterSnapshot('player').pelvisY).toBeGreaterThan(2.6);
    expect(runtime.metrics.emergencyResetCount).toBe(1);
    expect(runtime.metrics.lastNumericalFault).toBe('below-deck-safe-reset');
    world.free();
  });

  it('settles a physically supported airborne wrestler into the downed recovery path', () => {
    const { world, runtime, model, rig } = makeHarness();
    for (let frame = 0; frame < 30; frame += 1) stepHarness(world, runtime, model);
    model.player.state = 'airborne'; model.player.stateElapsed = 0; model.player.downTimer = 1.4;
    for (const body of Object.values(rig.bodies)) {
      const position = body.translation(); body.setTranslation({ x: position.x, y: position.y + .72, z: position.z }, true);
      body.setLinvel({ x: 0, y: -3.2, z: 0 }, true);
    }
    let downedFrame = -1;
    for (let frame = 0; frame < 180; frame += 1) {
      stepHarness(world, runtime, model);
      const currentState: string = model.player.state;
      if (currentState === 'downed') { downedFrame = frame; break; }
    }
    expect(downedFrame, JSON.stringify({ state: model.player.state, stateElapsed: model.player.stateElapsed, snapshot: runtime.fighterSnapshot('player'), metrics: runtime.metrics })).toBeGreaterThanOrEqual(0);
    expect(downedFrame).toBeLessThan(150);
    expect(runtime.metrics.emergencyResetCount, JSON.stringify(runtime.metrics)).toBe(0);
    world.free();
  });

  it('ends a low airborne state even when repeated impacts keep resetting state elapsed', () => {
    const { world, runtime, model } = makeHarness();
    for (let frame = 0; frame < 30; frame += 1) stepHarness(world, runtime, model);
    let downedFrame = -1;
    for (let frame = 0; frame < 190; frame += 1) {
      model.player.state = 'airborne'; model.player.stateElapsed = 0;
      stepHarness(world, runtime, model);
      const currentState: string = model.player.state;
      if (currentState === 'downed') { downedFrame = frame; break; }
    }
    expect(downedFrame, JSON.stringify({ state: model.player.state, snapshot: runtime.fighterSnapshot('player'), metrics: runtime.metrics })).toBeGreaterThanOrEqual(38);
    expect(downedFrame).toBeLessThan(55);
    expect(runtime.metrics.emergencyResetCount).toBe(0);
    world.free();
  });

  it('locks one physical recovery side instead of flickering between slanted downed poses', () => {
    const { world, runtime, model, rig } = makeHarness();
    model.player.state = 'downed'; model.player.stateElapsed = .3; model.player.downTimer = 20;
    runtime.prepareLabFall('player', 'back', model.player.facing);
    // Capture orientation from a settled contact before perturbing the torso.
    for (let frame = 0; frame < 60; frame++) stepHarness(world, runtime, model);
    const orientations: string[] = [];
    for (let frame = 0; frame < 16; frame += 1) {
      const angle = Math.PI / 2; const half = Math.sin(angle / 2); const w = Math.cos(angle / 2);
      rig.bodies.chest.setRotation(frame % 2 === 0 ? { x: half, y: 0, z: 0, w } : { x: 0, y: 0, z: half, w }, true);
      for (const body of Object.values(rig.bodies)) body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      stepHarness(world, runtime, model);
      orientations.push(model.player.recoveryOrientation);
    }
    expect(new Set(orientations.slice(1)).size).toBe(1);
    expect(runtime.fighterSnapshot('player').pelvisY).toBeGreaterThan(1.86);
    world.free();
  });

  it('completes a two-grip lift and scores only the solved torso-to-mat landing', () => {
    const { world, runtime, model } = makeGrappleHarness();
    for (let frame = 0; frame < 45; frame += 1) stepGrappleHarness(world, runtime, model);
    const restingPelvisY = runtime.fighterSnapshot('opponent').pelvisY;
    const positions = { player: model.player.position, opponent: model.opponent.position };
    expect(requestCommand(model, 'player', 'grapple'), JSON.stringify(positions)).toBe(true);
    expect(requestCommand(model, 'player', 'heavy')).toBe(true);
    stepGrappleHarness(world, runtime, model);
    let sawTwoGrips = false; let sawLift = false; let sawLanding = false; let peakPelvisY = restingPelvisY;
    const samples: unknown[] = [];
    for (let frame = 0; frame < 540 && model.opponent.health === 100; frame += 1) {
      stepGrappleHarness(world, runtime, model);
      peakPelvisY = Math.max(peakPelvisY, runtime.fighterSnapshot('opponent').pelvisY);
      if (frame % 30 === 0) samples.push({ frame, phase: model.grapple?.phase, position: { ...model.opponent.position }, pelvis: runtime.fighterSnapshot('opponent').pelvisY, pending: runtime.pendingLandingCount() });
      sawTwoGrips ||= runtime.metrics.gripCreateCount >= 2;
      sawLift ||= model.grapple?.phase === 'lift';
      sawLanding ||= runtime.metrics.lastContactPair === 'chest>ring';
    }
    expect(sawTwoGrips, JSON.stringify(runtime.metrics)).toBe(true);
    expect(sawLift, JSON.stringify({ grapple: model.grapple, player: model.player, metrics: runtime.metrics })).toBe(true);
    expect(peakPelvisY, JSON.stringify({ restingPelvisY, peakPelvisY, opponent: model.opponent, metrics: runtime.metrics })).toBeGreaterThan(restingPelvisY + .55);
    expect(peakPelvisY - restingPelvisY, 'a body slam lifts to shoulder height, not above the arena').toBeLessThan(1.8);
    expect(sawLanding, JSON.stringify({ samples, opponent: model.opponent, metrics: runtime.metrics })).toBe(true);
    expect(model.opponent.health).toBeLessThan(100);
    expect(model.playerStats.grapples).toBe(1);
    expect(runtime.pendingLandingCount()).toBe(0);
    expect(runtime.metrics.emergencyResetCount, JSON.stringify(runtime.metrics)).toBe(0);
    expect(runtime.metrics.numericalFaultCount, JSON.stringify(runtime.metrics)).toBe(0);
    expect(runtime.metrics.maximumJointSeparation, JSON.stringify(runtime.metrics)).toBeLessThan(1.35);
    world.free();
  }, 30_000);

  it('breaks a pre-lift grapple that collapses a wrestler onto the deck', () => {
    const { world, runtime, model, player } = makeGrappleHarness();
    for (let frame = 0; frame < 30; frame += 1) stepGrappleHarness(world, runtime, model);
    expect(requestCommand(model, 'player', 'grapple')).toBe(true);
    expect(model.grapple).not.toBeNull();
    if (!model.grapple) return;
    model.grapple.age = 1; model.grapple.phase = 'reach';
    const pelvisPosition = player.bodies.pelvis.translation();
    player.bodies.pelvis.setTranslation({ x: pelvisPosition.x, y: 2.25, z: pelvisPosition.z }, true);
    player.bodies.pelvis.setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }, true);
    stepGrappleHarness(world, runtime, model);
    expect(model.grapple).toBeNull();
    expect(model.player.state).toBe('downed');
    expect(model.player.moveId).toBeNull();
    expect(model.announcement).toContain('GROUND LOCK BROKEN');
    expect(runtime.metrics.gripCount).toBe(0);
    world.free();
  });

  it('answers directional input promptly without destabilizing the articulated rig', () => {
    const { world, runtime, model } = makeHarness(); const initialX = model.player.position.x;
    for (let frame = 0; frame < 33; frame += 1) stepHarness(world, runtime, model, { x: 1, z: 0 });
    expect(model.player.position.x - initialX).toBeGreaterThan(1.25);
    expect(runtime.fighterSnapshot('player').upright).toBeGreaterThan(.62);
    expect(runtime.metrics.emergencyResetCount).toBe(0); world.free();
  });

  it('traverses cardinal and diagonal directions with every wrestler and records zero unknown falls', () => {
    const directions = [
      { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 },
      { x: .707, z: .707 }, { x: -.707, z: -.707 }, { x: .707, z: -.707 }, { x: -.707, z: .707 },
    ];
    for (const fighter of FIGHTERS) {
      const { world, runtime, model } = makeHarness(fighter.id);
      for (let frame = 0; frame < 30; frame += 1) stepHarness(world, runtime, model);
      for (const direction of directions) {
        const before = { ...model.player.position };
        for (let frame = 0; frame < 30; frame += 1) stepHarness(world, runtime, model, direction);
        expect(Math.hypot(model.player.position.x - before.x, model.player.position.z - before.z), fighter.id).toBeGreaterThan(.55);
        for (let frame = 0; frame < 30; frame += 1) stepHarness(world, runtime, model);
        expect(runtime.fighterSnapshot('player').speed, fighter.id).toBeLessThan(1.2);
        expect(runtime.fighterSnapshot('player').upright, fighter.id).toBeGreaterThan(.6);
      }
      expect(model.falls.filter((fall) => fall.reason === FALL_REASONS.Unknown), fighter.id).toHaveLength(0);
      expect(model.unstableWithoutCauseSeconds, fighter.id).toBe(0);
      expect(runtime.metrics.emergencyResetCount, fighter.id).toBe(0);
      world.free();
    }
  }, 30_000);
});


describe('outdoor venue physical locomotion', () => {
  it('walks across the former rope line on a continuous floor without a ringside drop', () => {
    const { world, runtime, model } = makeHarness();
    try {
      configureCombatVenue(model, 'yard'); model.labMode = true;
      const ground = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(0, 1.645, 0));
      world.createCollider(ColliderDesc.cuboid(17, .2, 15).setFriction(1.1).setCollisionGroups(arenaCollisionGroups), ground);
      runtime.registerLandingSurface('yard-floor', 'floor', ground);
      for (let frame = 0; frame < 600; frame++) stepHarness(world, runtime, model, { x: 1, z: 0 });
      expect(model.player.position.x).toBeGreaterThan(6.2);
      expect(model.player.position.x).toBeLessThanOrEqual(8.8);
      expect(model.player.ropeRebound).toBe(0);
      expect(runtime.fighterSnapshot('player').pelvisY).toBeGreaterThan(2.5);
      expect(runtime.metrics.emergencyResetCount).toBe(0);
    } finally { runtime.reset(); world.free(); }
  });
});


it('lands an outdoor table spot on the registered wooden surface before breaking it', () => {
  const { world, runtime, model } = makeGrappleHarness('yard');
  try {
    const table = model.props.find(p => p.kind === 'table'); if (!table) throw new Error('Missing venue table');
    const body = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(table.position.x, VENUES.yard.floorY + .9, table.position.z));
    world.createCollider(ColliderDesc.cuboid(1.5, .065, .65).setCollisionGroups(arenaCollisionGroups), body);
    runtime.registerLandingSurface(table.id, 'table', body);
    for (let i = 0; i < 45; i++) stepGrappleHarness(world, runtime, model);
    model.player.position = { x: -.8, z: -1.7 }; model.opponent.position = { x: .8, z: -1.7 };
    runtime.prepareLabPositions(model.player.position, model.opponent.position);
    for (let i = 0; i < 30; i++) stepGrappleHarness(world, runtime, model);
    expect(requestCommand(model, 'player', 'grapple')).toBe(true);
    expect(requestCommand(model, 'player', 'context')).toBe(true);
    let landedOnTable = false;
    for (let i = 0; i < 540 && !table.broken; i++) {
      stepGrappleHarness(world, runtime, model);
      landedOnTable ||= runtime.metrics.lastContactPair === 'chest>table';
    }
    expect(landedOnTable).toBe(true); expect(table.broken, JSON.stringify({ table, impact: model.lastImpact, stats: model.playerStats, metrics: runtime.metrics })).toBe(true);
    expect(model.opponent.health).toBeLessThan(100); expect(model.playerStats.grapples).toBe(1);
    expect(runtime.pendingLandingCount()).toBe(0); expect(runtime.metrics.emergencyResetCount).toBe(0);
    expect(model.highlights.some(h => h.label === 'Wooden Table Crash')).toBe(true);
  } finally { runtime.reset(); world.free(); }
});

it.each(['back', 'front', 'left', 'right'] as const)('Get Up builds a stance above a backstage table after a %s fall', orientation => {
  const { world, runtime, model, player } = makeGrappleHarness('backstage', 'chad');
  try {
    const top = VENUES.backstage.floorY + .965;
    const table = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(0, top - .065, -3.6));
    world.createCollider(ColliderDesc.cuboid(1.5, .065, .65).setCollisionGroups(arenaCollisionGroups), table);
    runtime.registerLandingSurface('table-1', 'table', table);
    runtime.prepareLabPositions({ x: 0, z: -3.6 }, { x: 3, z: 0 });
    runtime.prepareLabFall('player', orientation, model.player.facing);
    for (const body of Object.values(player.bodies)) {
      const p = body.translation(); body.setTranslation({ x: p.x, y: p.y + .965, z: p.z }, true);
    }
    model.player.state = 'downed'; model.player.downTimer = 15; model.player.stamina = 0;
    model.player.recoveryOrientation = orientation;
    expect(requestCommand(model, 'player', 'dodge')).toBe(true);
    for (let frame = 0; frame < 600 && String(model.player.state) !== 'idle'; frame++) stepGrappleHarness(world, runtime, model);
    const snapshot = runtime.fighterSnapshot('player');
    expect(model.player.state, JSON.stringify(snapshot)).toBe('idle');
    expect(snapshot.upright).toBeGreaterThan(.9);
    expect(snapshot.pelvisY).toBeGreaterThan(top + .75);
    expect(snapshot.footY).toBeGreaterThan(top - .1);
    expect(snapshot.supportFeet).toBeGreaterThan(0);
    expect(runtime.metrics.emergencyResetCount).toBe(0);
  } finally { runtime.reset(); world.free(); }
});

it.each([
  { name: 'suplex', direction: { x: 1, z: 0 }, button: 'grapple' as const },
  { name: 'side_toss', direction: { x: 1, z: 0 }, button: 'quick' as const },
  { name: 'powerbomb', direction: { x: 0, z: -1 }, button: 'grapple' as const },
])('lands the distinct $name through real grips and a solved torso contact', ({ name, direction, button }) => {
  const { world, runtime, model } = makeGrappleHarness('yard');
  try {
    for (let frame = 0; frame < 45; frame++) stepGrappleHarness(world, runtime, model);
    expect(requestCommand(model, 'player', 'grapple')).toBe(true);
    expect(requestCommand(model, 'player', button, direction)).toBe(true);
    expect(model.player.moveId).toBe(name);
    let airborneBeforeDamage = false; const landingSamples: unknown[] = [];
    for (let frame = 0; frame < 540 && model.opponent.health === 100; frame++) {
      stepGrappleHarness(world, runtime, model);
      airborneBeforeDamage ||= runtime.pendingLandingCount() > 0 && model.opponent.health === 100;
      if (frame % 30 === 0) landingSamples.push({ frame, state: model.opponent.state, snapshot: runtime.fighterSnapshot('opponent'), pending: runtime.pendingLandingCount() });
    }
    expect(airborneBeforeDamage, JSON.stringify({state:model.player.state,grapple:model.grapple,metrics:runtime.metrics})).toBe(true);
    expect(runtime.metrics.gripCreateCount).toBeGreaterThanOrEqual(2);
    expect(model.playerStats.grapples, JSON.stringify({ state: model.opponent.state, metrics: runtime.metrics, landingSamples })).toBe(1);
    expect(model.opponent.health).toBeLessThan(100);
    expect(model.lastImpact?.contactPoint?.every(Number.isFinite)).toBe(true);
    expect(runtime.metrics.emergencyResetCount).toBe(0);
    expect(runtime.metrics.numericalFaultCount).toBe(0);
  } finally { runtime.reset(); world.free(); }
});


it('requires a real cross-body cover before counting a physical pin', () => {
  const {world,runtime,model,player,opponent}=makeGrappleHarness();
  try {
    for(let f=0;f<50;f++) stepGrappleHarness(world,runtime,model);
    runtime.prepareLabFall('opponent','back',model.opponent.facing);
    model.opponent.state='downed'; model.opponent.stateElapsed=0; model.opponent.health=10; model.opponent.stamina=5; model.opponent.downTimer=15;
    for(let f=0;f<60;f++) stepGrappleHarness(world,runtime,model);
    expect(requestCommand(model,'player','context')).toBe(true);
    expect(model.player.pinCount).toBe(0);
    let established=false; let maximumCount=0;
    for(let f=0;f<500 && !model.resolved;f++) {
      stepGrappleHarness(world,runtime,model);
      established ||= model.pinCover?.established===true;
      if(model.player.pinCount>maximumCount) {
        expect(model.pinCover?.established,JSON.stringify(model.pinCover)).toBe(true);
        maximumCount=model.player.pinCount;
      }
    }
    expect(established,JSON.stringify({cover:model.pinCover,p:player.bodies.chest.translation(),o:opponent.bodies.chest.translation(),state:model.player.state})).toBe(true);
    expect(maximumCount).toBeGreaterThanOrEqual(2);
    expect(runtime.metrics.emergencyResetCount).toBe(0);
  } finally {runtime.reset();world.free();}
});


it('connects an uppercut through the rising hand and preserves a standing base', () => {
  const {world,runtime,model}=makeGrappleHarness();
  try {
    for(let f=0;f<60;f++) stepGrappleHarness(world,runtime,model);
    expect(requestCommand(model,'player','quick',{x:0,z:-1})).toBe(true);
    expect(model.player.moveId).toBe('uppercut');
    for(let f=0;f<90;f++) stepGrappleHarness(world,runtime,model);
    expect(model.opponent.health,JSON.stringify(runtime.metrics)).toBeLessThan(100);
    expect(model.lastImpact?.moveId).toBe('uppercut');
    expect(runtime.fighterSnapshot('player').upright).toBeGreaterThan(.7);
    expect(runtime.metrics.emergencyResetCount).toBe(0);
  } finally {runtime.reset();world.free();}
});


it.each([
  ['jab', 'quick', { x: 0, z: 0 }],
  ['uppercut', 'quick', { x: 0, z: -1 }],
  ['high_punch', 'quick', { x: 1, z: 0 }],
  ['combo', 'quick', { x: -1, z: 0 }],
  ['low_kick', 'heavy', { x: 0, z: 1 }],
  ['front_kick', 'heavy', { x: 0, z: 0 }],
  ['high_kick', 'heavy', { x: 0, z: -1 }],
  ['roundhouse', 'heavy', { x: -1, z: 0 }],
] as const)('%s makes physical contact and returns the attacker to a standing stance', (moveId, command, direction) => {
  const { world, runtime, model } = makeGrappleHarness();
  try {
    for (let frame = 0; frame < 90; frame++) stepGrappleHarness(world, runtime, model);
    expect(requestCommand(model, 'player', command, direction)).toBe(true);
    expect(model.player.moveId).toBe(moveId);
    let hit = false; let minimumUpright = 1;
    for (let frame = 0; frame < 180; frame++) {
      stepGrappleHarness(world, runtime, model);
      hit ||= model.lastImpact?.moveId === moveId;
      minimumUpright = Math.min(minimumUpright, runtime.fighterSnapshot('player').upright);
    }
    expect(hit, JSON.stringify({ moveId, health: model.opponent.health, closest: runtime.metrics.minimumStrikeDistance, planar: runtime.metrics.minimumStrikePlanarDistance, vertical: runtime.metrics.minimumStrikeVerticalDistance })).toBe(true);
    expect(model.opponent.health).toBeLessThan(100);
    expect(minimumUpright, 'striking must not fold the attacker').toBeGreaterThan(.7);
    expect(runtime.fighterSnapshot('player').upright).toBeGreaterThan(.9);
    expect(model.player.state).toBe('idle');
    expect(runtime.metrics.emergencyResetCount).toBe(0);
    if (moveId === 'jab') {
      expect(model.opponent.lastFallReason, 'a healthy opponent should recoil from a jab while standing').toBeNull();
      expect(runtime.fighterSnapshot('opponent').upright).toBeGreaterThan(.9);
    }
  } finally { runtime.reset(); world.free(); }
});


it.each(FIGHTERS)('recovers $id from an actual slam at exhausted stamina', (fighter) => {
  const { world, runtime, model } = makeGrappleHarness(undefined, 'atlas', fighter.id);
  try {
    for (let frame = 0; frame < 60; frame++) stepGrappleHarness(world, runtime, model);
    expect(requestCommand(model, 'player', 'grapple')).toBe(true);
    expect(requestCommand(model, 'player', 'heavy')).toBe(true);
    for (let frame = 0; frame < 540 && model.opponent.health === 100; frame++) stepGrappleHarness(world, runtime, model);
    expect(model.lastImpact?.moveId, JSON.stringify(runtime.metrics)).toBe('slam');
    expect(model.opponent.state).toBe('downed');
    model.opponent.stamina = 0;
    expect(requestCommand(model, 'opponent', 'dodge')).toBe(true);
    for (let frame = 0; frame < 360 && model.opponent.state !== 'idle'; frame++) {
      if (frame % 8 === 0) requestCommand(model, 'opponent', 'dodge');
      stepGrappleHarness(world, runtime, model);
    }
    const snapshot = runtime.fighterSnapshot('opponent');
    expect(model.opponent.state, JSON.stringify(snapshot)).toBe('idle');
    expect(snapshot.upright).toBeGreaterThan(.9);
    expect(snapshot.supportFeet).toBeGreaterThan(0);
    expect(snapshot.headY).toBeGreaterThan(snapshot.pelvisY + .6);
    for (let frame = 0; frame < 180; frame++) stepGrappleHarness(world, runtime, model);
    expect(model.opponent.state).toBe('idle');
    expect(runtime.fighterSnapshot('opponent').headY).toBeGreaterThan(runtime.fighterSnapshot('opponent').pelvisY + .6);
    expect(runtime.metrics.emergencyResetCount).toBe(0);
  } finally { runtime.reset(); world.free(); }
});


it.each([
  ['jab', 'quick', { x: 0, z: 0 }],
  ['uppercut', 'quick', { x: 0, z: -1 }],
  ['front_kick', 'heavy', { x: 0, z: 0 }],
  ['high_kick', 'heavy', { x: 0, z: -1 }],
] as const)('%s has visible skin contact when physical damage registers', async (moveId, command, direction) => {
  const sourceSkin = await loadContactSkin('atlas'); const targetSkin = await loadContactSkin('nova');
  const { world, runtime, model, player, opponent } = makeGrappleHarness();
  try {
    for (let frame = 0; frame < 90; frame++) stepGrappleHarness(world, runtime, model);
    expect(requestCommand(model, 'player', command, direction)).toBe(true);
    for (let frame = 0; frame < 90 && !model.lastImpact; frame++) stepGrappleHarness(world, runtime, model);
    expect(model.lastImpact?.moveId).toBe(moveId);
    const profile = strikeDriveProfile(moveId); if (!profile) throw new Error(`Missing strike ${moveId}`);
    const gap = visibleSurfaceGap(sourceSkin.points(player.bodies, profile.source), targetSkin.triangles(opponent.bodies));
    expect(gap, `${moveId} skin gap at physical impact: ${gap.toFixed(3)} m (${runtime.metrics.lastContactPair})`).toBeLessThan(.12);
  } finally { sourceSkin.dispose(); targetSkin.dispose(); runtime.reset(); world.free(); }
}, 15_000);

it('does not score a predicted uppercut when constraints prevent the fist reaching the body', () => {
  const { world, runtime, model, player, opponent } = makeGrappleHarness();
  try {
    for (let frame = 0; frame < 60; frame++) stepGrappleHarness(world, runtime, model);
    expect(requestCommand(model, 'player', 'quick', { x: 0, z: -1 })).toBe(true);
    model.player.attackPhase = 'active'; model.player.phaseElapsed = .2;
    const head = opponent.bodies.head.translation();
    player.bodies.rightHand.setTranslation({ x: head.x - .48, y: head.y, z: head.z }, true);
    for (const body of [...Object.values(player.bodies), ...Object.values(opponent.bodies)]) {
      body.setEnabledTranslations(false, false, false, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    for (let frame = 0; frame < 5; frame++) stepGrappleHarness(world, runtime, model);
    expect(model.opponent.health).toBe(100);
    expect(model.lastImpact).toBeNull();
  } finally { runtime.reset(); world.free(); }
});


it('shows torso-to-canvas contact on the actual skin at a scored slam', async () => {
  const skin = await loadContactSkin('nova'); const { world, runtime, model, opponent } = makeGrappleHarness();
  try {
    for (let frame = 0; frame < 60; frame++) stepGrappleHarness(world, runtime, model);
    requestCommand(model, 'player', 'grapple'); requestCommand(model, 'player', 'heavy');
    for (let frame = 0; frame < 540 && !model.lastImpact; frame++) stepGrappleHarness(world, runtime, model);
    expect(model.lastImpact?.moveId).toBe('slam');
    const torso = [...skin.points(opponent.bodies, 'chest'), ...skin.points(opponent.bodies, 'abdomen')];
    const gap = Math.min(...torso.map(point => Math.abs(point.y - 1.845)));
    expect(gap, `visible torso floats ${gap.toFixed(3)} m above the canvas`).toBeLessThan(.12);
  } finally { skin.dispose(); runtime.reset(); world.free(); }
});
