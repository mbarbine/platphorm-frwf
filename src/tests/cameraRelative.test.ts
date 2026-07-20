import { describe, expect, it } from 'vitest';
import { cameraInputBasis, transformCameraRelative, updateStableBasis } from '../game/input/cameraRelative';

describe('stable camera-relative input', () => {
  it('maps keyboard input through the broadcast camera basis', () => {
    const basis = cameraInputBasis({ x: 0, z: 10 }, { x: 0, z: 0 });
    expect(transformCameraRelative({ x: 0, z: -1 }, basis)).toEqual({ x: 0, z: -1 });
    expect(transformCameraRelative({ x: 1, z: 0 }, basis)).toEqual({ x: 1, z: 0 });
  });

  it('does not rotate a held direction when the cinematic camera moves', () => {
    const start = cameraInputBasis({ x: 0, z: 10 }, { x: 0, z: 0 }); const side = cameraInputBasis({ x: 10, z: 0 }, { x: 0, z: 0 });
    expect(updateStableBasis(start, side, true, false, 1 / 60)).toBe(start);
    expect(updateStableBasis(start, side, false, true, 1 / 60)).toBe(start);
  });

  it('smoothly accepts a new neutral camera axis after input release', () => {
    let basis = cameraInputBasis({ x: 0, z: 10 }, { x: 0, z: 0 }); const side = cameraInputBasis({ x: 10, z: 0 }, { x: 0, z: 0 });
    for (let frame = 0; frame < 90; frame += 1) basis = updateStableBasis(basis, side, false, false, 1 / 60);
    expect(basis.forward.x).toBeLessThan(-.99); expect(Math.abs(basis.forward.z)).toBeLessThan(.05);
  });
});
