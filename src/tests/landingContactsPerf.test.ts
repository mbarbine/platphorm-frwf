// @vitest-environment node
import { describe, it, beforeAll, expect } from 'vitest';
import { World, init, RigidBodyDesc, type RigidBody } from '@dimforge/rapier3d-compat';
import { BodyWorksRuntime } from '../game/physics/physicsRuntime';
import { createMatch } from '../game/systems/combat';
import type { MatchModel } from '../game/types/game';

interface RuntimePrivateAccess {
  world: World | null;
  pendingLandings: Map<string, unknown>;
  refreshPendingLandingContacts: (model: MatchModel) => void;
}

describe('landing contacts performance', () => {
  beforeAll(async () => {
    await init();
  });

  it('benchmark refreshPendingLandingContacts', () => {
    const world = new World({ x: 0, y: -9.81, z: 0 });
    const runtime = new BodyWorksRuntime();
    const runtimePrivate = runtime as unknown as RuntimePrivateAccess;
    const model = createMatch('atlas', 'vex', 'standard', 'easy');

    // Attach world
    runtimePrivate.world = world;

    // Create rigid bodies for surfaces
    const ringBody = world.createRigidBody(RigidBodyDesc.fixed());
    const floorBody = world.createRigidBody(RigidBodyDesc.fixed());
    const tableBody = world.createRigidBody(RigidBodyDesc.fixed());

    runtime.registerLandingSurface('ring-1', 'ring', ringBody as unknown as RigidBody);
    runtime.registerLandingSurface('floor-1', 'floor', floorBody as unknown as RigidBody);
    runtime.registerLandingSurface('table-1', 'table', tableBody as unknown as RigidBody);

    // Set up pendingLandings
    runtimePrivate.pendingLandings.set('player', {
      attacker: 'opponent',
      defender: 'player',
      attackInstanceId: 'attack-1',
      moveId: 'suplex',
      releasedAt: 0,
      expiresAt: 2,
      targetSurface: null,
      targetPosition: null,
    });

    runtimePrivate.pendingLandings.set('opponent', {
      attacker: 'player',
      defender: 'opponent',
      attackInstanceId: 'attack-2',
      moveId: 'slam',
      releasedAt: 0,
      expiresAt: 2,
      targetSurface: 'table',
      targetPosition: null,
    });

    // Warm up
    for (let i = 0; i < 1000; i++) {
      runtimePrivate.refreshPendingLandingContacts(model);
    }

    const ITERATIONS = 100000;
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      runtimePrivate.refreshPendingLandingContacts(model);
    }
    const elapsed = performance.now() - start;

    console.log(`[BENCHMARK] ${ITERATIONS} iterations took ${elapsed.toFixed(2)} ms (${(elapsed / ITERATIONS * 1000).toFixed(4)} us/op)`);
    expect(elapsed).toBeGreaterThan(0);
  });
});
