import type { Vec2 } from '../types/game';

export interface CameraInputBasis { forward: Vec2; right: Vec2 }

export const cameraInputBasis = (camera: Vec2, focus: Vec2): CameraInputBasis => {
  const dx = focus.x - camera.x; const dz = focus.z - camera.z; const magnitude = Math.max(.001, Math.hypot(dx, dz));
  const forward = { x: dx / magnitude, z: dz / magnitude };
  return { forward, right: { x: -forward.z, z: forward.x } };
};

export const updateStableBasis = (current: CameraInputBasis, candidate: CameraInputBasis, inputHeld: boolean, cinematic: boolean, dt: number): CameraInputBasis => {
  if (inputHeld || cinematic) return current;
  const amount = 1 - Math.exp(-dt * 5.2);
  const x = current.forward.x + (candidate.forward.x - current.forward.x) * amount; const z = current.forward.z + (candidate.forward.z - current.forward.z) * amount;
  const magnitude = Math.max(.001, Math.hypot(x, z)); const forward = { x: x / magnitude, z: z / magnitude };
  return { forward, right: { x: -forward.z, z: forward.x } };
};

export const transformCameraRelative = (input: Vec2, basis: CameraInputBasis): Vec2 => ({
  x: basis.right.x * input.x - basis.forward.x * input.z,
  z: basis.right.z * input.x - basis.forward.z * input.z,
});
