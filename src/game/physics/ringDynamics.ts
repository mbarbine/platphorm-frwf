import type { Vec2 } from '../types/game';

export const RING_ROPE_LIMIT = { x: 5.2, z: 3.7 } as const;
export const RING_HARD_LIMIT = { x: 5.72, z: 4.22 } as const;

export interface RopeResponse {
  engaged: boolean;
  axis: 'x' | 'z';
  side: -1 | 1;
  compression: number;
  outwardSpeed: number;
  force: Vec2;
}

export const solveRopeResponse = (position: Vec2, velocity: Vec2, overdrive = false): RopeResponse => {
  const xCompression = Math.max(0, Math.abs(position.x) - RING_ROPE_LIMIT.x);
  const zCompression = Math.max(0, Math.abs(position.z) - RING_ROPE_LIMIT.z);
  const xRatio = xCompression / Math.max(.001, RING_HARD_LIMIT.x - RING_ROPE_LIMIT.x);
  const zRatio = zCompression / Math.max(.001, RING_HARD_LIMIT.z - RING_ROPE_LIMIT.z);
  const axis = xRatio >= zRatio ? 'x' : 'z';
  const compression = axis === 'x' ? xCompression : zCompression;
  const side = (Math.sign(axis === 'x' ? position.x : position.z) || 1) as -1 | 1;
  const outwardSpeed = Math.max(0, (axis === 'x' ? velocity.x : velocity.z) * side);
  if (compression <= 0) return { engaged: false, axis, side, compression: 0, outwardSpeed: 0, force: { x: 0, z: 0 } };
  const spring = (overdrive ? 5_400 : 4_250) * compression;
  const damping = (overdrive ? 380 : 455) * outwardSpeed;
  const magnitude = Math.min(overdrive ? 5_600 : 4_600, spring + damping);
  return { engaged: true, axis, side, compression, outwardSpeed, force: axis === 'x' ? { x: -side * magnitude, z: 0 } : { x: 0, z: -side * magnitude } };
};
