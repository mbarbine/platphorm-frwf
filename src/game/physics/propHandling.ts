import type { Vec2 } from '../types/game';
export function propReleaseVelocity(throwing: boolean, facing: number, velocity: { x: number; y: number; z: number }, direction?: Vec2) {
  if (!throwing) return { x: Math.max(-2, Math.min(2, velocity.x)), y: Math.min(0, velocity.y), z: Math.max(-2, Math.min(2, velocity.z)) };
  const length = direction ? Math.hypot(direction.x, direction.z) : 0;
  const aim = direction && length > .01 ? { x: direction.x / length, z: direction.z / length } : { x: Math.sin(facing), z: Math.cos(facing) };
  return { x: velocity.x * .3 + aim.x * 7.2, y: 2.1, z: velocity.z * .3 + aim.z * 7.2 };
}
