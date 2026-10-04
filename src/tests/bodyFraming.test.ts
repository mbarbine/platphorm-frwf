import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { bodyFramingDistance, placeBroadcastCamera } from '../game/camera/bodyFraming';

describe('body-aware broadcast framing', () => {
  for (const yaw of [0, Math.PI / 4]) for (const aspect of [16 / 9, 9 / 16]) {
    for (const [name, min, max] of [
      ['standing', [-2, 1.5, -1], [2, 3.9, 1]],
      ['lifted above a lagging target', [-1, 1.5, -1], [1, 7.2, 1]],
      ['ringside landing', [-5, 0, 6], [2, 2.2, 9]],
    ] as const) {
      it(`keeps ${name} inside the HUD inset at aspect ${aspect}, yaw ${yaw}`, () => {
        const bounds = { min: { x: min[0], y: min[1], z: min[2] }, max: { x: max[0], y: max[1], z: max[2] } };
        const target = new Vector3(0, 2.2, 0);
        const camera = new PerspectiveCamera(42, aspect, .1, 200);
        placeBroadcastCamera(camera.position, target, bodyFramingDistance(bounds, target, camera.fov, aspect, yaw), yaw);
        camera.lookAt(target); camera.updateMatrixWorld();
        for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
          const projected = new Vector3(x, y, z).project(camera);
          expect(Math.abs(projected.x)).toBeLessThanOrEqual(.720001);
          expect(Math.abs(projected.y)).toBeLessThanOrEqual(.720001);
          expect(projected.z).toBeGreaterThan(-1);
          expect(projected.z).toBeLessThan(1);
        }
      });
    }
  }

  it('clamps extreme bounding boxes so framing distance never exceeds far plane or becomes NaN/Infinity', () => {
    const extremeBounds = { min: { x: -1000, y: -1000, z: -1000 }, max: { x: 1000, y: 1000, z: 1000 } };
    const target = { x: 0, y: 2.2, z: 0 };
    const distance = bodyFramingDistance(extremeBounds, target, 48, 1.7778, 0);
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeLessThanOrEqual(68.0);
    expect(distance).toBeGreaterThanOrEqual(4.5);
  });

  it('handles NaN/Infinity bounds or targets gracefully', () => {
    const nanBounds = { min: { x: NaN, y: NaN, z: NaN }, max: { x: Infinity, y: Infinity, z: Infinity } };
    const target = { x: NaN, y: NaN, z: NaN };
    const distance = bodyFramingDistance(nanBounds, target, NaN, NaN, 0);
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeGreaterThanOrEqual(4.5);
    expect(distance).toBeLessThanOrEqual(68.0);

    const pos = new Vector3();
    placeBroadcastCamera(pos, target, distance, NaN);
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
    expect(Number.isFinite(pos.z)).toBe(true);
  });

  it('ensures far-side venue geometry remains inside far plane (250m) at max framing distance whereas 72m far plane clipped it', () => {
    const extremeBounds = { min: { x: -100, y: 0, z: -100 }, max: { x: 100, y: 10, z: 100 } };
    const target = new Vector3(0, 2.2, 0);
    const distance = bodyFramingDistance(extremeBounds, target, 48, 16 / 9, Math.PI / 4);
    expect(distance).toBeLessThanOrEqual(68.0);

    // Far-side venue points in front of the broadcast camera (camera at +X, +Z looking toward -X, -Z)
    const farVenuePointsInFront = [
      new Vector3(0, 0, 0),          // Ring center
      new Vector3(-30, 0, -30),      // Far arena floor
      new Vector3(-50, 0, -50),      // Far crowd seating
      new Vector3(-100, 0, -100),    // Outer stadium / sky dome boundary
      new Vector3(-50, 20, -50),     // Far stadium roof / canopy
    ];

    // With legacy 72m far plane:
    const oldCamera = new PerspectiveCamera(48, 16 / 9, 0.1, 72);
    placeBroadcastCamera(oldCamera.position, target, distance, Math.PI / 4);
    oldCamera.lookAt(target);
    oldCamera.updateMatrixWorld();

    // Outer stadium boundary at (-100, 0, -100) was clipped with 72m far plane
    const oldFarWallProjected = farVenuePointsInFront[3].project(oldCamera);
    expect(oldFarWallProjected.z).toBeGreaterThan(1); // Clipped!

    // With new 250m far plane:
    const newCamera = new PerspectiveCamera(48, 16 / 9, 0.1, 250);
    placeBroadcastCamera(newCamera.position, target, distance, Math.PI / 4);
    newCamera.lookAt(target);
    newCamera.updateMatrixWorld();

    for (const point of farVenuePointsInFront) {
      const projected = point.project(newCamera);
      expect(projected.z).toBeLessThan(1); // Not clipped!
    }
  });
});
