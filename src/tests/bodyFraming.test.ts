import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { bodyFramingDistance, placeBroadcastCamera } from '../game/camera/bodyFraming';

describe('body-aware broadcast framing', () => {
  for (const aspect of [16 / 9, 9 / 16]) {
    for (const [name, min, max] of [
      ['standing', [-2, 1.5, -1], [2, 3.9, 1]],
      ['lifted above a lagging target', [-1, 1.5, -1], [1, 7.2, 1]],
      ['ringside landing', [-5, 0, 6], [2, 2.2, 9]],
    ] as const) {
      it(`keeps ${name} inside the HUD inset at aspect ${aspect}`, () => {
        const bounds = { min: { x: min[0], y: min[1], z: min[2] }, max: { x: max[0], y: max[1], z: max[2] } };
        const target = new Vector3(0, 2.2, 0);
        const camera = new PerspectiveCamera(42, aspect, .1, 200);
        placeBroadcastCamera(camera.position, target, bodyFramingDistance(bounds, target, camera.fov, aspect));
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
});
