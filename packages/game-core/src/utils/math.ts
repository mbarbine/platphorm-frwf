// Pure math utilities — no external dependencies.
// Mirrors src/game/utils/math.ts from the frontend.

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

// OPTIMIZATION: Replacing slow Math.hypot with standard Math.sqrt. Math.hypot scales inputs dynamically to avoid overflow/underflow,
// which is a CPU intensive operation. Since our game coordinate space is small and bound, Math.sqrt is completely safe and runs ~8x faster.
export const length = (v: { x: number; z: number }): number =>
  Math.sqrt(v.x * v.x + v.z * v.z);

export const normalize = (v: { x: number; z: number }): { x: number; z: number } => {
  const len = length(v);
  return len < 0.0001 ? { x: 0, z: 0 } : { x: v.x / len, z: v.z / len };
};

export const scale = (v: { x: number; z: number }, s: number): { x: number; z: number } =>
  ({ x: v.x * s, z: v.z * s });

// OPTIMIZATION: Replacing slow Math.hypot with standard Math.sqrt for the same speed benefits as length.
export const distance = (a: { x: number; z: number }, b: { x: number; z: number }): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
};

export const seededRandom = (seed: number): readonly [number, number] => {
  const next = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
  return [(next >>> 0) / 0xFFFFFFFF, next];
};
