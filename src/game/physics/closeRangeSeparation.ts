import { clamp } from '../utils/math';
import type { Vec2 } from '../types/game';

export interface SeparationBody {
  position: Vec2;
  velocity: Vec2;
  mass: number;
}

export interface SeparationSolution {
  direction: Vec2;
  force: number;
  separation: number;
}

export const CLOSE_RANGE_COMFORT_GAP = .56;

/** Bounded planar separation for two neutral wrestlers, including exact overlap. */
export const solveCloseRangeSeparation = (first: SeparationBody, second: SeparationBody, fallbackFacing: number, comfortGap = CLOSE_RANGE_COMFORT_GAP): SeparationSolution => {
  const dx = second.position.x - first.position.x; const dz = second.position.z - first.position.z;
  const separation = Math.hypot(dx, dz);
  const fallback = { x: Math.sin(fallbackFacing), z: Math.cos(fallbackFacing) };
  const direction = separation >= .01 ? { x: dx / separation, z: dz / separation } : fallback;
  if (separation >= comfortGap) return { direction, force: 0, separation };
  const relativeSpeed = (second.velocity.x - first.velocity.x) * direction.x + (second.velocity.z - first.velocity.z) * direction.z;
  const averageMass = (first.mass + second.mass) * .5;
  const force = clamp((comfortGap - separation) * averageMass * 28 - relativeSpeed * averageMass * 2.8, 0, 1_050);
  return { direction, force, separation };
};
