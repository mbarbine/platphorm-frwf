import { describe, expect, it } from 'vitest';
import { CLOSE_RANGE_COMFORT_GAP, solveCloseRangeSeparation } from '../game/physics/closeRangeSeparation';

const body = (x: number, z: number, velocityX = 0, velocityZ = 0) => ({ position: { x, z }, velocity: { x: velocityX, z: velocityZ }, mass: 100 });

describe('neutral soft separation', () => {
  it('produces a bounded fallback force when pelvis centers exactly overlap', () => {
    const solution = solveCloseRangeSeparation(body(0, 0), body(0, 0), Math.PI / 2);
    expect(solution.separation).toBe(0);
    expect(solution.force).toBeGreaterThan(0);
    expect(solution.force).toBeLessThanOrEqual(1_050);
    expect(solution.direction.x).toBeCloseTo(1); expect(solution.direction.z).toBeCloseTo(0);
  });

  it('does not create a force outside the comfort gap', () => {
    expect(solveCloseRangeSeparation(body(0, 0), body(CLOSE_RANGE_COMFORT_GAP, 0), 0).force).toBe(0);
  });

  it('pushes closing wrestlers more strongly than wrestlers already separating', () => {
    const closing = solveCloseRangeSeparation(body(0, 0, 1, 0), body(.3, 0, -1, 0), 0);
    const separating = solveCloseRangeSeparation(body(0, 0, -1, 0), body(.3, 0, 1, 0), 0);
    expect(closing.force).toBeGreaterThan(separating.force);
  });
});
