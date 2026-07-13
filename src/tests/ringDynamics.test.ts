import { describe, expect, it } from 'vitest';
import { RING_HARD_LIMIT, RING_ROPE_LIMIT, solveRopeResponse } from '../game/physics/ringDynamics';

describe('elastic ring boundary', () => {
  it('stays passive in the playable center', () => {
    expect(solveRopeResponse({ x: 2, z: -1 }, { x: 5, z: 0 })).toMatchObject({ engaged: false, compression: 0, force: { x: 0, z: 0 } });
  });

  it('pushes an outbound wrestler back toward the ring', () => {
    const response = solveRopeResponse({ x: RING_ROPE_LIMIT.x + .32, z: 0 }, { x: 4.8, z: 0 });
    expect(response).toMatchObject({ engaged: true, axis: 'x', side: 1 });
    expect(response.force.x).toBeLessThan(-1_000);
    expect(response.outwardSpeed).toBeCloseTo(4.8);
  });

  it('selects the dominant corner rope and gives overdrive more spring', () => {
    const position = { x: RING_HARD_LIMIT.x - .08, z: RING_ROPE_LIMIT.z + .08 };
    const standard = solveRopeResponse(position, { x: 3.2, z: 1 });
    const overdrive = solveRopeResponse(position, { x: 3.2, z: 1 }, true);
    expect(standard.axis).toBe('x'); expect(overdrive.force.x).toBeLessThan(standard.force.x);
  });
});
