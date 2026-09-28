import { describe, expect, it } from 'vitest';
import { clamp, distance, length, normalize, scale, seededRandom } from '../utils/math.js';

describe('deterministic game-core math', () => {
  it('normalizes movement input without creating invalid zero-vector values', () => {
    expect(normalize({ x: 0, z: 0 })).toEqual({ x: 0, z: 0 });
    const direction = normalize({ x: 3, z: 4 });
    expect(length(direction)).toBeCloseTo(1, 10);
    expect(distance({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5);
    expect(clamp(12, 0, 10)).toBe(10);
  });

  it('scales 2D vectors accurately across positive, negative, fractional, and zero factors', () => {
    expect(scale({ x: 3, z: 4 }, 2)).toEqual({ x: 6, z: 8 });
    expect(scale({ x: 3, z: -4 }, -0.5)).toEqual({ x: -1.5, z: 2 });
    expect(scale({ x: 5, z: 10 }, 0)).toEqual({ x: 0, z: 0 });
    expect(scale({ x: 0, z: 0 }, 10)).toEqual({ x: 0, z: 0 });
  });

  it('replays seeded choices identically and keeps rolls bounded', () => {
    const first = seededRandom(1337);
    const repeated = seededRandom(1337);

    expect(first).toEqual(repeated);
    expect(first[0]).toBeGreaterThanOrEqual(0);
    expect(first[0]).toBeLessThanOrEqual(1);
    expect(first[1]).not.toBe(1337);
  });
});
