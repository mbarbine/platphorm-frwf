import { ColliderDesc, JointData, RigidBodyDesc, World, init } from '@dimforge/rapier3d-compat';
import type { RigidBody } from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIGHTERS, fighterById } from '../game/data/fighters';
import { buildBodySchema } from '../game/physics/bodySchema';
import type { BodySegmentId, BodySegmentSchema } from '../game/physics/bodySchema';
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
      .setLinearDamping(.55).setAngularDamping(2.2).setCanSleep(true).setCcdEnabled(segment.attackEligible || segment.id === 'head'));
    const collider = segment.id === 'head' ? ColliderDesc.ball(segment.radius)
      : segment.id.includes('Foot') || segment.id.includes('Hand')
        ? ColliderDesc.cuboid(segment.radius, segment.id.includes('Foot') ? segment.radius * .5 : segment.halfLength, segment.id.includes('Foot') ? segment.halfLength * 1.35 : segment.radius)
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
    const [a, b] = anchors(parent, child); const data = JointData.revolute(a, b, { x: 1, y: 0, z: 0 }); data.limitsEnabled = true; data.limits = [...limits];
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
  const world = new World({ x: 0, y: -18, z: 0 }); world.timestep = STEP;
  const mat = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(0, 1.52, 0));
  world.createCollider(ColliderDesc.cuboid(6, .325, 4.5).setFriction(1.1).setCollisionGroups(arenaCollisionGroups), mat);
  const runtime = new BodyWorksRuntime(); const model = createMatch(fighterId, fighterId === 'nova' ? 'atlas' : 'nova', 'standard', 'normal', 913); model.physicsAuthority = true; model.aiThinkTimer = 999; model.aiControllers.opponent.thinkTimer = 999;
  runtime.setJointData(JointData);
  runtime.registerLandingSurface('ring', 'ring', mat);
  const rig = createHeadlessRig(world, fighterId, 'player', -1.6); runtime.registerFighter('player', rig.bodies, rig.joints);
  runtime.setFootContact('player', 'leftFoot', true); runtime.setFootContact('player', 'rightFoot', true);
  return { world, runtime, model, rig };
};

const stepHarness = (world: World, runtime: BodyWorksRuntime, model: MatchModel, movement: Vec2 = STILL.move, run = false): void => {
  const input = { move: movement, run, block: false, commands: [] };
  runtime.captureInput('player', input, model.elapsed); advanceMatch(model, STEP, input); runtime.beforeFixedStep(STEP, model, world); world.step(); runtime.afterFixedStep(model);
  for (const contact of runtime.consumeContacts()) applyPhysicalContact(model, contact);
};

const makeGrappleHarness = (): { world: World; runtime: BodyWorksRuntime; model: MatchModel } => {
  const world = new World({ x: 0, y: -18, z: 0 }); world.timestep = STEP;
  const mat = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(0, 1.52, 0));
  world.createCollider(ColliderDesc.cuboid(6, .325, 4.5).setFriction(1.1).setCollisionGroups(arenaCollisionGroups), mat);
  const runtime = new BodyWorksRuntime(); const model = createMatch('atlas', 'nova', 'standard', 'normal', 1217);
  model.physicsAuthority = true; model.labMode = true; model.aiThinkTimer = 999; model.aiControllers.opponent.thinkTimer = 999;
  model.player.position = { x: -.8, z: 0 }; model.opponent.position = { x: .8, z: 0 };
  model.player.facing = Math.PI / 2; model.opponent.facing = -Math.PI / 2;
  runtime.setJointData(JointData); runtime.registerLandingSurface('ring', 'ring', mat);
  const player = createHeadlessRig(world, 'atlas', 'player', -.8); const opponent = createHeadlessRig(world, 'nova', 'opponent', .8);
  runtime.registerFighter('player', player.bodies, player.joints); runtime.registerFighter('opponent', opponent.bodies, opponent.joints);
  runtime.setFootContact('player', 'leftFoot', true); runtime.setFootContact('player', 'rightFoot', true);
  runtime.setFootContact('opponent', 'leftFoot', true); runtime.setFootContact('opponent', 'rightFoot', true);
  return { world, runtime, model };
};

const stepGrappleHarness = (world: World, runtime: BodyWorksRuntime, model: MatchModel): void => {
  const input = { move: STILL.move, run: false, block: false, commands: [] };
  advanceMatch(model, STEP, input); runtime.beforeFixedStep(STEP, model, world); world.step(); runtime.afterFixedStep(model);
  for (const contact of runtime.consumeContacts()) applyPhysicalContact(model, contact);
};

beforeAll(async () => { await init(); });

describe('Rapier-backed Bodyworks integration', () => {
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

  it('completes a two-grip lift and scores only the solved torso-to-mat landing', () => {
    const { world, runtime, model } = makeGrappleHarness();
    for (let frame = 0; frame < 45; frame += 1) stepGrappleHarness(world, runtime, model);
    const restingPelvisY = runtime.fighterSnapshot('opponent').pelvisY;
    const positions = { player: model.player.position, opponent: model.opponent.position };
    expect(requestCommand(model, 'player', 'grapple'), JSON.stringify(positions)).toBe(true);
    expect(requestCommand(model, 'player', 'heavy')).toBe(true);
    stepGrappleHarness(world, runtime, model);
    let sawTwoGrips = false; let sawLift = false; let sawLanding = false; let peakPelvisY = restingPelvisY;
    for (let frame = 0; frame < 540 && model.opponent.health === 100; frame += 1) {
      stepGrappleHarness(world, runtime, model);
      peakPelvisY = Math.max(peakPelvisY, runtime.fighterSnapshot('opponent').pelvisY);
      sawTwoGrips ||= runtime.metrics.gripCreateCount >= 2;
      sawLift ||= model.grapple?.phase === 'lift';
      sawLanding ||= runtime.metrics.lastContactPair === 'chest>ring';
    }
    expect(sawTwoGrips, JSON.stringify(runtime.metrics)).toBe(true);
    expect(sawLift, JSON.stringify({ grapple: model.grapple, player: model.player, metrics: runtime.metrics })).toBe(true);
    expect(peakPelvisY, JSON.stringify({ restingPelvisY, peakPelvisY, opponent: model.opponent, metrics: runtime.metrics })).toBeGreaterThan(restingPelvisY + .55);
    expect(sawLanding, JSON.stringify({ opponent: model.opponent, metrics: runtime.metrics })).toBe(true);
    expect(model.opponent.health).toBeLessThan(100);
    expect(model.playerStats.grapples).toBe(1);
    expect(runtime.pendingLandingCount()).toBe(0);
    expect(runtime.metrics.emergencyResetCount, JSON.stringify(runtime.metrics)).toBe(0);
    expect(runtime.metrics.numericalFaultCount, JSON.stringify(runtime.metrics)).toBe(0);
    expect(runtime.metrics.maximumJointSeparation, JSON.stringify(runtime.metrics)).toBeLessThan(1.35);
    world.free();
  }, 30_000);

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
