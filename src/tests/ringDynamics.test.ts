import { describe, expect, it } from 'vitest';
import { apronTransitionTarget, isRingside, RING_HARD_LIMIT, RING_ROPE_LIMIT, shouldReleaseRopeRebound, solveRopeReleaseDirection, solveRopeResponse } from '../game/physics/ringDynamics';

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

  it('releases a fully loaded rebound only after outward travel is arrested', () => {
    expect(shouldReleaseRopeRebound({ compression: .5, outwardSpeed: .9 }, .5, 5.4, .9)).toBe(false);
    expect(shouldReleaseRopeRebound({ compression: .5, outwardSpeed: .08 }, .5, 5.4, .08)).toBe(true);
    expect(shouldReleaseRopeRebound({ compression: .5, outwardSpeed: .08 }, .5, .8, .08)).toBe(false);
    expect(shouldReleaseRopeRebound({ compression: .5, outwardSpeed: .08 }, .5, 1.2, .08)).toBe(true);
    expect(shouldReleaseRopeRebound({ compression: .24, outwardSpeed: 3.2 }, .24, 5.4, 3.2)).toBe(false);
    expect(shouldReleaseRopeRebound({ compression: .31, outwardSpeed: 0 }, .4, 4.2, -.8)).toBe(true);
  });

  it('aims an in-ring rebound lane without ever steering toward a ringside target', () => {
    expect(solveRopeReleaseDirection({ x: -.6, z: -.8 }, { x: -5.4, z: .4 }, 'x', 1, false).x).toBeLessThan(-.9);
    const ringside = solveRopeReleaseDirection({ x: -1, z: 0 }, { x: 1, z: 0 }, 'x', 1, true);
    expect(ringside).toEqual({ x: -1, z: 0 });
    const tangential = solveRopeReleaseDirection({ x: -1, z: 0 }, { x: 0, z: 2 }, 'x', 1, false);
    expect(tangential).toEqual({ x: -1, z: 0 });
  });
});

describe('physical apron transitions', () => {
  it('targets ringside from inside without mutating the source position', () => {
    const source = { x: 5.3, z: .4 }; const target = apronTransitionTarget(source);
    expect(target.inside).toBe(false); expect(target.target.x).toBeGreaterThan(RING_HARD_LIMIT.x + 1); expect(source).toEqual({ x: 5.3, z: .4 });
  });

  it('targets the raised mat when a fighter is ringside', () => {
    expect(isRingside({ x: 6.4, z: 0 })).toBe(true);
    const target = apronTransitionTarget({ x: 6.4, z: 0 });
    expect(target.inside).toBe(true); expect(target.target.x).toBeLessThan(RING_ROPE_LIMIT.x);
  });
});
