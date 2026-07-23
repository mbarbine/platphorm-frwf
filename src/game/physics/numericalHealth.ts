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

const finite = (values: readonly number[]): boolean => values.every(Number.isFinite);

export const inspectNumericalBody = (sample: NumericalBodySample, arenaHalfWidth = 16, arenaHalfDepth = 13): NumericalFault | null => {
  const { position, rotation, linearVelocity, angularVelocity } = sample;
  if (!finite([position.x, position.y, position.z, rotation.x, rotation.y, rotation.z, rotation.w, linearVelocity.x, linearVelocity.y, linearVelocity.z, angularVelocity.x, angularVelocity.y, angularVelocity.z])) return { code: 'non-finite', segment: sample.segment, value: Number.NaN };
  // OPTIMIZATION: Use zero-allocation squared magnitude comparisons on hot paths to avoid calling Math.hypot or Math.sqrt.
  // Standard square root Math.sqrt is only extracted in the rare event of a physical runaway fault.
  const linearSpeedSq = linearVelocity.x * linearVelocity.x + linearVelocity.y * linearVelocity.y + linearVelocity.z * linearVelocity.z;
  if (linearSpeedSq > 576) return { code: 'linear-runaway', segment: sample.segment, value: Math.sqrt(linearSpeedSq) };
  const angularSpeedSq = angularVelocity.x * angularVelocity.x + angularVelocity.y * angularVelocity.y + angularVelocity.z * angularVelocity.z;
  if (angularSpeedSq > 1024) return { code: 'angular-runaway', segment: sample.segment, value: Math.sqrt(angularSpeedSq) };
  if (position.y < -3.5) return { code: 'below-world', segment: sample.segment, value: position.y };
  const arenaOverflow = Math.max(Math.abs(position.x) - arenaHalfWidth, Math.abs(position.z) - arenaHalfDepth);
  if (arenaOverflow > 2) return { code: 'outside-arena', segment: sample.segment, value: arenaOverflow };
  return null;
};

export const jointSeparationFault = (segment: BodySegmentId, expectedDistance: number, actualDistance: number): NumericalFault | null => {
  const excess = actualDistance - expectedDistance;
  return excess > .42 ? { code: 'joint-separation', segment, value: excess } : null;
};
