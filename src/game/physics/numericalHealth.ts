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

// OPTIMIZATION: Replacing array-based checks with individual inline Number.isFinite checks.
// This completely avoids allocating a temporary 13-element array on every segment inspection,
// which is executed thousands of times per second inside the physics tick loop.
// Additionally, replacing slow Math.hypot calls with standard Math.sqrt (only when a threshold is exceeded)
// completely avoids any square root or hypot calculation on healthy/normal simulation ticks.

export const inspectNumericalBody = (sample: NumericalBodySample, arenaHalfWidth = 16, arenaHalfDepth = 13): NumericalFault | null => {
  const { position, rotation, linearVelocity, angularVelocity } = sample;

  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z) ||
    !Number.isFinite(rotation.x) ||
    !Number.isFinite(rotation.y) ||
    !Number.isFinite(rotation.z) ||
    !Number.isFinite(rotation.w) ||
    !Number.isFinite(linearVelocity.x) ||
    !Number.isFinite(linearVelocity.y) ||
    !Number.isFinite(linearVelocity.z) ||
    !Number.isFinite(angularVelocity.x) ||
    !Number.isFinite(angularVelocity.y) ||
    !Number.isFinite(angularVelocity.z)
  ) {
    return { code: 'non-finite', segment: sample.segment, value: Number.NaN };
  }

  // OPTIMIZATION: Compare squared speed first. Since normal speeds are well below limits,
  // this avoids any square root calculations entirely on normal, healthy simulation paths.
  const linearSpeedSq = linearVelocity.x * linearVelocity.x + linearVelocity.y * linearVelocity.y + linearVelocity.z * linearVelocity.z;
  if (linearSpeedSq > 576) { // 24 * 24
    return { code: 'linear-runaway', segment: sample.segment, value: Math.sqrt(linearSpeedSq) };
  }

  const angularSpeedSq = angularVelocity.x * angularVelocity.x + angularVelocity.y * angularVelocity.y + angularVelocity.z * angularVelocity.z;
  if (angularSpeedSq > 1024) { // 32 * 32
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
