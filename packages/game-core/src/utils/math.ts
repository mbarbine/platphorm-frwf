// Pure math utilities — no external dependencies.
// Mirrors src/game/utils/math.ts from the frontend.

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const length = (v: { x: number; z: number }): number =>
  Math.hypot(v.x, v.z);

export const normalize = (v: { x: number; z: number }): { x: number; z: number } => {
  const len = length(v);
  return len < 0.0001 ? { x: 0, z: 0 } : { x: v.x / len, z: v.z / len };
};

export const scale = (v: { x: number; z: number }, s: number): { x: number; z: number } =>
  ({ x: v.x * s, z: v.z * s });

export const distance = (a: { x: number; z: number }, b: { x: number; z: number }): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

export const seededRandom = (seed: number): readonly [number, number] => {
  const next = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
  return [(next >>> 0) / 0xFFFFFFFF, next];
};
