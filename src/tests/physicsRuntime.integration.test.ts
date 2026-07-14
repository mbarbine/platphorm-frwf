import { ColliderDesc, JointData, RigidBodyDesc, World, init } from '@dimforge/rapier3d-compat';
import type { RigidBody } from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { fighterById } from '../game/data/fighters';
import { buildBodySchema } from '../game/physics/bodySchema';
import type { BodySegmentId, BodySegmentSchema } from '../game/physics/bodySchema';
import { arenaCollisionGroups, fighterCollisionGroups } from '../game/physics/collisionGroups';
import { BodyWorksRuntime } from '../game/physics/physicsRuntime';
import { advanceMatch, createMatch } from '../game/systems/combat';
import type { FighterId, MatchModel, Vec2 } from '../game/types/game';

const STEP = 1 / 60;
const STILL = { move: { x: 0, z: 0 }, run: false, block: false, commands: [] } as const;

interface HeadlessRig {
  bodies: Record<BodySegmentId, RigidBody>;
  joints: number;
}

const schemaById = (schema: readonly BodySegmentSchema[]): Map<BodySegmentId, BodySegmentSchema> => new Map(schema.map((entry) => [entry.id, entry]));

const createHeadlessRig = (world: World, fighterId: FighterId, x: number): HeadlessRig => {
  const schema = buildBodySchema(fighterById(fighterId));
  const byId = schemaById(schema); const bodies = {} as Record<BodySegmentId, RigidBody>;
  for (const segment of schema) {
    const body = world.createRigidBody(RigidBodyDesc.dynamic()
      .setTranslation(x + segment.localPosition[0], 1.92 + segment.localPosition[1], segment.localPosition[2])
      .setLinearDamping(.42).setAngularDamping(1.8).setCanSleep(false).setCcdEnabled(segment.attackEligible || segment.id === 'head'));
    const collider = segment.id === 'head' ? ColliderDesc.ball(segment.radius)
      : segment.id.includes('Foot') || segment.id.includes('Hand')
        ? ColliderDesc.cuboid(segment.radius, segment.id.includes('Foot') ? segment.radius * .5 : segment.halfLength, segment.id.includes('Foot') ? segment.halfLength * 1.35 : segment.radius)
        : ColliderDesc.capsule(segment.halfLength, segment.radius);
    world.createCollider(collider.setMass(segment.massKg).setFriction(segment.id.includes('Foot') ? 1.45 : .76).setRestitution(.015).setCollisionGroups(fighterCollisionGroups('player')), body);
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

const makeHarness = (): { world: World; runtime: BodyWorksRuntime; model: MatchModel; rig: HeadlessRig } => {
  const world = new World({ x: 0, y: -18, z: 0 }); world.timestep = STEP;
  const mat = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(0, 1.52, 0));
  world.createCollider(ColliderDesc.cuboid(6, .325, 4.5).setFriction(1.1).setCollisionGroups(arenaCollisionGroups), mat);
  const runtime = new BodyWorksRuntime(); const model = createMatch('atlas', 'nova', 'standard', 'normal', 913); model.physicsAuthority = true; model.aiThinkTimer = 999;
  runtime.setJointData(JointData);
  const rig = createHeadlessRig(world, 'atlas', -1.6); runtime.registerFighter('player', rig.bodies, rig.joints);
  runtime.setFootContact('player', 'leftFoot', true); runtime.setFootContact('player', 'rightFoot', true);
  return { world, runtime, model, rig };
};

const stepHarness = (world: World, runtime: BodyWorksRuntime, model: MatchModel, movement: Vec2 = STILL.move, run = false): void => {
  const input = { move: movement, run, block: false, commands: [] };
  runtime.captureInput('player', input, model.elapsed); advanceMatch(model, STEP, input); runtime.beforeFixedStep(STEP, model, world); world.step(); runtime.afterFixedStep(model);
};

beforeAll(async () => { await init(); });

describe('Rapier-backed Bodyworks integration', () => {
  it('holds a 16-body fighter upright through a ten-second fixed-step soak', () => {
    const { world, runtime, model, rig } = makeHarness();
    for (let frame = 0; frame < 600; frame += 1) stepHarness(world, runtime, model);
    const snapshot = runtime.fighterSnapshot('player');
    expect(Object.values(rig.bodies).every((body) => [body.translation().x, body.translation().y, body.translation().z, body.linvel().x, body.linvel().y, body.linvel().z].every(Number.isFinite))).toBe(true);
    expect(snapshot.pelvisY).toBeGreaterThan(2.65); expect(snapshot.pelvisY).toBeLessThan(3.35); expect(snapshot.upright).toBeGreaterThan(.72);
    expect(runtime.metrics.emergencyResetCount).toBe(0); expect(runtime.metrics.invalidRegisteredBodyCount).toBe(0); expect(world.bodies.len()).toBe(17); expect(world.impulseJoints.len()).toBe(15);
    runtime.reset(); expect(runtime.metrics.bodyCount).toBe(0); expect(runtime.metrics.jointCount).toBe(0); expect(runtime.replay.size).toBe(0); world.free();
  });

  it('walks, stops, jumps, lands, and resets without leaking runtime state', () => {
    const { world, runtime, model } = makeHarness(); const startX = runtime.fighterSnapshot('player').pelvisY;
    for (let frame = 0; frame < 120; frame += 1) stepHarness(world, runtime, model, { x: 1, z: 0 });
    const travelled = model.player.position.x + 1.6; expect(travelled).toBeGreaterThan(.65);
    for (let frame = 0; frame < 90; frame += 1) stepHarness(world, runtime, model);
    expect(runtime.fighterSnapshot('player').speed).toBeLessThan(1.2);
    model.player.state = 'jumping'; runtime.requestJump('player'); let apex = runtime.fighterSnapshot('player').pelvisY;
    for (let frame = 0; frame < 150; frame += 1) { stepHarness(world, runtime, model); apex = Math.max(apex, runtime.fighterSnapshot('player').pelvisY); }
    expect(apex).toBeGreaterThan(startX + .25); expect(runtime.fighterSnapshot('player').pelvisY).toBeGreaterThan(2.65); expect(runtime.metrics.emergencyResetCount).toBe(0);
    runtime.reset(); expect(runtime.pendingCommandCount()).toBe(0); expect(runtime.metrics.worldBodyCount).toBe(0); expect(runtime.metrics.worldJointCount).toBe(0); world.free();
  });

  it('answers directional input promptly without destabilizing the articulated rig', () => {
    const { world, runtime, model } = makeHarness(); const initialX = model.player.position.x;
    for (let frame = 0; frame < 33; frame += 1) stepHarness(world, runtime, model, { x: 1, z: 0 });
    expect(model.player.position.x - initialX).toBeGreaterThan(1.25);
    expect(runtime.fighterSnapshot('player').upright).toBeGreaterThan(.62);
    expect(runtime.metrics.emergencyResetCount).toBe(0); world.free();
  });
});
