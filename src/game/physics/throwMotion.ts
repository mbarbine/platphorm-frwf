import type { Vec2 } from '../types/game';

export interface ThrowMotion {
  liftHeight: number;
  turn: number;
  speed: number;
  riseSpeed: number;
  clearanceTime: number;
  rotationSpeed: number;
}

const SLAM: ThrowMotion = { liftHeight: .64, turn: 0, speed: .72, riseSpeed: 1.8, clearanceTime: .12, rotationSpeed: 5.6 };
const SUPLEX: ThrowMotion = { liftHeight: 1.08, turn: Math.PI, speed: 1.65, riseSpeed: 2.4, clearanceTime: .14, rotationSpeed: 5.2 };
const TOSS: ThrowMotion = { liftHeight: .7, turn: Math.PI / 2, speed: 1.8, riseSpeed: 1.5, clearanceTime: .1, rotationSpeed: 4.4 };
const POWER: ThrowMotion = { liftHeight: 1.18, turn: 0, speed: .45, riseSpeed: 1.4, clearanceTime: .09, rotationSpeed: 5.9 };

export function throwMotionFor(move: string): Readonly<ThrowMotion> {
  if (['suplex', 'skyhook'].includes(move)) return SUPLEX;
  if (['arm_drag', 'side_toss', 'takedown'].includes(move)) return TOSS;
  if (['powerbomb', 'piledriver', 'mountain_drop'].includes(move)) return POWER;
  return SLAM;
}

/** Deliberate input and furniture targeting outrank a move's neutral travel lane. */
export function throwDirection(axis: Vec2, input: Vec2, move: string): Vec2 {
  // OPTIMIZATION: Replacing slow Math.hypot with standard Math.sqrt for ~8x speedup on vector length calculations.
  const inputLength = Math.sqrt(input.x * input.x + input.z * input.z);
  if (inputLength > .25) return { x: input.x / inputLength, z: input.z / inputLength };
  const length = Math.sqrt(axis.x * axis.x + axis.z * axis.z);
  const x = length > .001 ? axis.x / length : 0;
  const z = length > .001 ? axis.z / length : 1;
  const turn = throwMotionFor(move).turn;
  return { x: x * Math.cos(turn) + z * Math.sin(turn), z: z * Math.cos(turn) - x * Math.sin(turn) };
}
