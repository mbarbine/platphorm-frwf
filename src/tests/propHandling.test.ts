import { describe, expect, it } from 'vitest';
import { propReleaseVelocity } from '../game/physics/propHandling';

describe('propReleaseVelocity', () => {
  describe('non-throwing release (dropping/releasing)', () => {
    it('clamps horizontal velocity components between -2 and 2 and caps upward vertical velocity to 0', () => {
      const inputVelocity = { x: 5, y: 3, z: -4 };
      const releaseVelocity = propReleaseVelocity(false, 0, inputVelocity);

      expect(releaseVelocity).toEqual({ x: 2, y: 0, z: -2 });
    });

    it('retains downward vertical velocity and in-bounds horizontal velocity when non-throwing', () => {
      const inputVelocity = { x: -1.5, y: -2.5, z: 0.8 };
      const releaseVelocity = propReleaseVelocity(false, 0, inputVelocity);

      expect(releaseVelocity).toEqual({ x: -1.5, y: -2.5, z: 0.8 });
    });
  });

  describe('throwing release', () => {
    it('calculates throw velocity along the aiming direction when direction length exceeds threshold', () => {
      // Direction vector (3, 4) with length 5 (> 0.01)
      const direction = { x: 3, z: 4 };
      const facing = 0;
      const inputVelocity = { x: 10, y: 5, z: -10 };

      // aim = (3/5, 4/5) = (0.6, 0.8)
      // expected x = 10 * 0.3 + 0.6 * 7.2 = 3 + 4.32 = 7.32
      // expected y = 2.1
      // expected z = -10 * 0.3 + 0.8 * 7.2 = -3 + 5.76 = 2.76
      const releaseVelocity = propReleaseVelocity(true, facing, inputVelocity, direction);

      expect(releaseVelocity.x).toBeCloseTo(7.32);
      expect(releaseVelocity.y).toBe(2.1);
      expect(releaseVelocity.z).toBeCloseTo(2.76);
    });

    it('falls back to facing angle direction when direction is omitted', () => {
      const facing = Math.PI / 2; // sin(PI/2) = 1, cos(PI/2) = 0
      const inputVelocity = { x: 2, y: 0, z: 4 };

      // aim = (sin(PI/2), cos(PI/2)) = (1, 0)
      // expected x = 2 * 0.3 + 1 * 7.2 = 0.6 + 7.2 = 7.8
      // expected y = 2.1
      // expected z = 4 * 0.3 + 0 * 7.2 = 1.2
      const releaseVelocity = propReleaseVelocity(true, facing, inputVelocity);

      expect(releaseVelocity.x).toBeCloseTo(7.8);
      expect(releaseVelocity.y).toBe(2.1);
      expect(releaseVelocity.z).toBeCloseTo(1.2);
    });

    it('falls back to facing angle direction when direction vector magnitude is <= 0.01', () => {
      const direction = { x: 0.005, z: 0.005 }; // length ≈ 0.007 < 0.01
      const facing = Math.PI; // sin(PI) = 0, cos(PI) = -1
      const inputVelocity = { x: 0, y: 0, z: 0 };

      // aim = (sin(PI), cos(PI)) = (0, -1)
      // expected x = 0 * 0.3 + 0 * 7.2 = 0
      // expected y = 2.1
      // expected z = 0 * 0.3 + (-1) * 7.2 = -7.2
      const releaseVelocity = propReleaseVelocity(true, facing, inputVelocity, direction);

      expect(releaseVelocity.x).toBeCloseTo(0);
      expect(releaseVelocity.y).toBe(2.1);
      expect(releaseVelocity.z).toBeCloseTo(-7.2);
    });
  });
});
