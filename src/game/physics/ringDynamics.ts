import type { Vec2 } from '../types/game';

export const RING_ROPE_LIMIT = { x: 5.2, z: 3.7 } as const;
export const RING_HARD_LIMIT = { x: 5.72, z: 4.22 } as const;
export const RINGSIDE_THRESHOLD = { x: 5.82, z: 4.32 } as const;

export interface RopeResponse {
  engaged: boolean;
  axis: 'x' | 'z';
  side: -1 | 1;
  compression: number;
  outwardSpeed: number;
  force: Vec2;
}

export interface ApronTransitionTarget {
  target: Vec2;
  /** True when this transition finishes on the raised ring mat. */
  inside: boolean;
}

export const isRingside = (position: Vec2): boolean => Math.abs(position.x) > RINGSIDE_THRESHOLD.x || Math.abs(position.z) > RINGSIDE_THRESHOLD.z;

/** Select the nearest rope opening. The runtime reaches it with forces. */
export const apronTransitionTarget = (position: Vec2): ApronTransitionTarget => {
  const inside = isRingside(position);
  const useX = Math.abs(position.x) / RING_ROPE_LIMIT.x >= Math.abs(position.z) / RING_ROPE_LIMIT.z;
  if (useX) {
    const side = Math.sign(position.x) || 1;
    return { target: { x: side * (inside ? 4.72 : 6.42), z: Math.max(-3.3, Math.min(3.3, position.z)) }, inside };
  }
  const side = Math.sign(position.z) || 1;
  return { target: { x: Math.max(-4.65, Math.min(4.65, position.x)), z: side * (inside ? 3.28 : 4.96) }, inside };
};

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
  const spring = (overdrive ? 6_050 : 4_850) * compression;
  const damping = (overdrive ? 330 : 390) * outwardSpeed;
  const magnitude = Math.min(overdrive ? 6_300 : 5_250, spring + damping);
  return { engaged: true, axis, side, compression, outwardSpeed, force: axis === 'x' ? { x: -side * magnitude, z: 0 } : { x: 0, z: -side * magnitude } };
};
