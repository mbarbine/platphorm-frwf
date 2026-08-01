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

export const inspectNumericalBody = (sample: NumericalBodySample, arenaHalfWidth = 16, arenaHalfDepth = 13): NumericalFault | null => {
  const { position, rotation, linearVelocity, angularVelocity } = sample;
  // OPTIMIZATION: Replacing array-based finite checks to avoid temporary array allocation inside the high-frequency physics loop.
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

  // OPTIMIZATION: Comparing squared magnitude first to avoid Math.sqrt or Math.hypot entirely on the non-runaway hot path.
  const linearVelocitySq = linearVelocity.x * linearVelocity.x + linearVelocity.y * linearVelocity.y + linearVelocity.z * linearVelocity.z;
  if (linearVelocitySq > 24 * 24) {
    const linearSpeed = Math.sqrt(linearVelocitySq);
    return { code: 'linear-runaway', segment: sample.segment, value: linearSpeed };
  }

  const angularVelocitySq = angularVelocity.x * angularVelocity.x + angularVelocity.y * angularVelocity.y + angularVelocity.z * angularVelocity.z;
  if (angularVelocitySq > 32 * 32) {
    const angularSpeed = Math.sqrt(angularVelocitySq);
    return { code: 'angular-runaway', segment: sample.segment, value: angularSpeed };
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
