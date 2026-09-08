import type { Vec2 } from '../types/game';

export type PlayerCameraMode = 'broadcast' | 'third_person' | 'first_person';
export const PLAYER_CAMERA_MODES: readonly { id: PlayerCameraMode; label: string }[] = [
  { id: 'broadcast', label: 'Broadcast' }, { id: 'third_person', label: 'Chase' }, { id: 'first_person', label: 'First person' },
];

/** Keep the horizon level; ragdoll head rotation must never roll the camera. */
export function followCameraFrame(position: { x: number; y: number; z: number }, facing: number, mode: 'first_person' | 'third_person', aspect: number) {
  const forward = { x: Math.sin(facing), z: Math.cos(facing) };
  const right = { x: forward.z, z: -forward.x };
  const eye = mode === 'first_person';
  const distance = eye ? -.28 : 4.4 * Math.max(1, .85 / Math.max(.4, aspect));
  const shoulder = eye ? 0 : .65;
  return {
    position: { x: position.x - forward.x * distance + right.x * shoulder, y: position.y + (eye ? .02 : 1.45), z: position.z - forward.z * distance + right.z * shoulder },
    target: { x: position.x + forward.x * 4, y: position.y - (eye ? .08 : .45), z: position.z + forward.z * 4 },
    fov: eye ? 78 : 58,
  };
}

export function viewInputBasis(mode: PlayerCameraMode, facing: number, broadcast: { forward: Vec2; right: Vec2 }) {
  if (mode === 'broadcast') return broadcast;
  const forward = { x: Math.sin(facing), z: Math.cos(facing) };
  return { forward, right: { x: -forward.z, z: forward.x } };
}
