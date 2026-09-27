import { describe, expect, it } from 'vitest';
import { Triangle, Vector3 } from 'three';
import { visibleSurfaceGap } from './skinnedContact';

describe('visibleSurfaceGap', () => {
  it('returns Infinity when source or target arrays are empty', () => {
    const triangle = new Triangle(new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(0, 1, 0));
    const point = new Vector3(0.2, 0.2, 0);

    expect(visibleSurfaceGap([], [triangle])).toBe(Infinity);
    expect(visibleSurfaceGap([point], [])).toBe(Infinity);
    expect(visibleSurfaceGap([], [])).toBe(Infinity);
  });

  it('returns 0 for a point lying on the surface of a triangle', () => {
    const triangle = new Triangle(new Vector3(0, 0, 0), new Vector3(2, 0, 0), new Vector3(0, 2, 0));
    const point = new Vector3(0.5, 0.5, 0);

    const gap = visibleSurfaceGap([point], [triangle]);
    expect(gap).toBeCloseTo(0, 6);
  });

  it('calculates exact perpendicular distance for a point directly above a triangle', () => {
    const triangle = new Triangle(new Vector3(0, 0, 0), new Vector3(2, 0, 0), new Vector3(0, 2, 0));
    const point = new Vector3(0.5, 0.5, 3.5);

    const gap = visibleSurfaceGap([point], [triangle]);
    expect(gap).toBeCloseTo(3.5, 6);
  });

  it('calculates closest distance to a triangle edge', () => {
    const triangle = new Triangle(new Vector3(0, 0, 0), new Vector3(2, 0, 0), new Vector3(0, 2, 0));
    const point = new Vector3(3, 0, 0); // Along line of edge AB (0,0,0) to (2,0,0)

    const gap = visibleSurfaceGap([point], [triangle]);
    expect(gap).toBeCloseTo(1.0, 6);
  });

  it('calculates closest distance to a triangle vertex', () => {
    const triangle = new Triangle(new Vector3(0, 0, 0), new Vector3(2, 0, 0), new Vector3(0, 2, 0));
    const point = new Vector3(-1, -1, 0); // Closest vertex is A (0,0,0)

    const gap = visibleSurfaceGap([point], [triangle]);
    expect(gap).toBeCloseTo(Math.sqrt(2), 6);
  });

  it('finds the global minimum surface gap across multiple source points and target triangles', () => {
    const t1 = new Triangle(new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(0, 1, 0));
    const t2 = new Triangle(new Vector3(10, 10, 0), new Vector3(11, 10, 0), new Vector3(10, 11, 0));

    const p1 = new Vector3(10, 10, 5); // Distance to t2 is 5
    const p2 = new Vector3(0.2, 0.2, 1.5); // Distance to t1 is 1.5

    const gap = visibleSurfaceGap([p1, p2], [t1, t2]);
    expect(gap).toBeCloseTo(1.5, 6);
  });

  it('handles triangle pruning correctly regardless of target triangle array ordering', () => {
    const tNear = new Triangle(new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(0, 1, 0));
    const tFar = new Triangle(new Vector3(100, 100, 100), new Vector3(101, 100, 100), new Vector3(100, 101, 100));
    const point = new Vector3(0, 0, 2); // Dist to tNear is 2, dist to tFar is ~173

    const gapNearFirst = visibleSurfaceGap([point], [tNear, tFar]);
    const gapFarFirst = visibleSurfaceGap([point], [tFar, tNear]);

    expect(gapNearFirst).toBeCloseTo(2.0, 6);
    expect(gapFarFirst).toBeCloseTo(2.0, 6);
    expect(gapNearFirst).toBe(gapFarFirst);
  });

  it('does not mutate input source points or target triangles', () => {
    const p = new Vector3(1, 2, 3);
    const pCopy = p.clone();
    const a = new Vector3(0, 0, 0);
    const b = new Vector3(1, 0, 0);
    const c = new Vector3(0, 1, 0);
    const tri = new Triangle(a, b, c);

    visibleSurfaceGap([p], [tri]);

    expect(p).toEqual(pCopy);
    expect(tri.a).toEqual(new Vector3(0, 0, 0));
    expect(tri.b).toEqual(new Vector3(1, 0, 0));
    expect(tri.c).toEqual(new Vector3(0, 1, 0));
  });
});
