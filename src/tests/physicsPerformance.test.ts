// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { init, World, RigidBodyDesc, ColliderDesc, JointData } from '@dimforge/rapier3d-compat';
import { BodyWorksRuntime } from '../game/physics/physicsRuntime';
import { fighterById } from '../game/data/fighters';
import { buildBodySchema, torsoColliderArgs, HEAD_COLLIDER_OFFSET, extremityColliderShape } from '../game/physics/bodySchema';
import type { BodySegmentId, BodySegmentSchema } from '../game/physics/bodySchema';
import { fighterCollisionGroups } from '../game/physics/collisionGroups';
import { createMatch } from '../game/systems/combat';

beforeAll(async () => { await init(); });

const schemaById = (schema: readonly BodySegmentSchema[]): Map<BodySegmentId, BodySegmentSchema> => new Map(schema.map((entry) => [entry.id, entry]));

const createHeadlessRig = (world: World, fighterId: string, slot: any, x: number) => {
  const schema = buildBodySchema(fighterById(fighterId as any));
  const byId = schemaById(schema); const bodies = {} as Record<BodySegmentId, any>;
  for (const segment of schema) {
    const body = world.createRigidBody(RigidBodyDesc.dynamic()
      .setTranslation(x + segment.localPosition[0], 1.8 + segment.localPosition[1], segment.localPosition[2])
      .setLinearDamping(.55).setAngularDamping(2.2));
    const torsoArgs = torsoColliderArgs(segment);
    const extremity = extremityColliderShape(segment);
    const collider = torsoArgs ? ColliderDesc.roundCuboid(...torsoArgs) : segment.id === 'head' ? ColliderDesc.ball(segment.radius).setTranslation(...HEAD_COLLIDER_OFFSET)
      : extremity
        ? ColliderDesc.cuboid(...extremity.args).setTranslation(...extremity.position)
        : ColliderDesc.capsule(segment.halfLength, segment.radius);
    world.createCollider(collider.setMass(segment.massKg).setCollisionGroups(fighterCollisionGroups(slot)), body);
    bodies[segment.id] = body;
  }
  return bodies;
};

describe('Physics Runtime Performance Benchmark', () => {
  it('benchmarks physics JS loops performance over 5,000 steps', () => {
    const world = new World({ x: 0, y: -18, z: 0 });
    const runtime = new BodyWorksRuntime();
    const model = createMatch('atlas', 'nova', 'standard', 'normal', 913);
    model.physicsAuthority = true;
    runtime.setJointData(JointData);

    const playerBodies = createHeadlessRig(world, 'atlas', 'player', -1.6);
    const opponentBodies = createHeadlessRig(world, 'nova', 'opponent', 1.6);

    runtime.registerFighter('player', playerBodies, 15);
    runtime.registerFighter('opponent', opponentBodies, 15);

    const ITERATIONS = 5000;
    const startTime = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      runtime.beforeFixedStep(1 / 60, model, world);
      runtime.afterFixedStep(model);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`[BENCHMARK] Executed ${ITERATIONS} JS physicsRuntime ticks in ${duration.toFixed(2)}ms (${(duration / ITERATIONS).toFixed(5)}ms/tick)`);

    expect(duration).toBeGreaterThan(0);
    runtime.reset();
    world.free();
  }, 30000);
});
