import type { BodySegmentId } from './bodySchema';
import type { QuaternionValue, Vector3Value } from './motorController';

export interface NumericalBodySample {
  segment: BodySegmentId;
  position: Vector3Value;
  rotation: QuaternionValue;
  linearVelocity: Vector3Value;
  angularVelocity: Vector3Value;
}

export type NumericalFaultCode = 'non-finite' | 'linear-runaway' | 'angular-runaway' | 'below-world' | 'outside-arena' | 'joint-separation';
export interface NumericalFault { code: NumericalFaultCode; segment: BodySegmentId; value: number }

// OPTIMIZATION:
// 1. Eliminated the `finite` helper which allocated a temporary array `[position.x, ...]` and called `.every`
//    on every segment of every rig on every physics tick. This completely removes GC pressure for hot simulation paths.
// 2. Replaced expensive `Math.hypot` calls for linear and angular speed checks with squared-magnitude comparisons
//    (e.g., checking against pre-squared limits: 24^2 = 576, and 32^2 = 1024). We only execute `Math.sqrt` if a
//    runaway fault is actually triggered.
export const inspectNumericalBody = (sample: NumericalBodySample, arenaHalfWidth = 16, arenaHalfDepth = 13): NumericalFault | null => {
  const { position, rotation, linearVelocity, angularVelocity } = sample;

  // Inline individual Number.isFinite checks to avoid array allocations in high-frequency validation ticks
  if (
    !Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z) ||
    !Number.isFinite(rotation.x) || !Number.isFinite(rotation.y) || !Number.isFinite(rotation.z) || !Number.isFinite(rotation.w) ||
    !Number.isFinite(linearVelocity.x) || !Number.isFinite(linearVelocity.y) || !Number.isFinite(linearVelocity.z) ||
    !Number.isFinite(angularVelocity.x) || !Number.isFinite(angularVelocity.y) || !Number.isFinite(angularVelocity.z)
  ) {
    return { code: 'non-finite', segment: sample.segment, value: Number.NaN };
  }

  // Use squared magnitude check to completely avoid the slow Math.hypot/Math.sqrt extraction in non-runaway cases
  const linearSpeedSq = linearVelocity.x * linearVelocity.x + linearVelocity.y * linearVelocity.y + linearVelocity.z * linearVelocity.z;
  if (linearSpeedSq > 576) {
    return { code: 'linear-runaway', segment: sample.segment, value: Math.sqrt(linearSpeedSq) };
  }

  const angularSpeedSq = angularVelocity.x * angularVelocity.x + angularVelocity.y * angularVelocity.y + angularVelocity.z * angularVelocity.z;
  if (angularSpeedSq > 1024) {
    return { code: 'angular-runaway', segment: sample.segment, value: Math.sqrt(angularSpeedSq) };
  }

  if (position.y < -3.5) return { code: 'below-world', segment: sample.segment, value: position.y };
  const arenaOverflow = Math.max(Math.abs(position.x) - arenaHalfWidth, Math.abs(position.z) - arenaHalfDepth);
  if (arenaOverflow > 2) return { code: 'outside-arena', segment: sample.segment, value: arenaOverflow };
  return null;
};

export const jointSeparationFault = (segment: BodySegmentId, expectedDistance: number, actualDistance: number): NumericalFault | null => {
  const excess = actualDistance - expectedDistance;
  return excess > .42 ? { code: 'joint-separation', segment, value: excess } : null;
};
