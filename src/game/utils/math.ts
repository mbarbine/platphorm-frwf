import type { Vec2 } from '../types/game';

export const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));
// Optimized: Math.hypot is computationally expensive in hot paths.
// Replacing with Math.sqrt and simple multiplication dramatically improves performance.
export const length = (value: Vec2): number => Math.sqrt(value.x * value.x + value.z * value.z);
export const distance = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
};
export const normalize = (value: Vec2): Vec2 => {
  const magnitude = length(value);
  return magnitude > 0.0001 ? { x: value.x / magnitude, z: value.z / magnitude } : { x: 0, z: 0 };
};
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
export const scale = (value: Vec2, factor: number): Vec2 => ({ x: value.x * factor, z: value.z * factor });
export const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

export const seededRandom = (seed: number): [number, number] => {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return [((value >>> 0) % 10_000) / 10_000, (seed + 0x6d2b79f5) | 0];
};
