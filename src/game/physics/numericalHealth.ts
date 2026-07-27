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
  const px = position.x, py = position.y, pz = position.z;
  const rx = rotation.x, ry = rotation.y, rz = rotation.z, rw = rotation.w;
  const lvx = linearVelocity.x, lvy = linearVelocity.y, lvz = linearVelocity.z;
  const avx = angularVelocity.x, avy = angularVelocity.y, avz = angularVelocity.z;

  if (
    !Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz) ||
    !Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(rz) || !Number.isFinite(rw) ||
    !Number.isFinite(lvx) || !Number.isFinite(lvy) || !Number.isFinite(lvz) ||
    !Number.isFinite(avx) || !Number.isFinite(avy) || !Number.isFinite(avz)
  ) {
    return { code: 'non-finite', segment: sample.segment, value: Number.NaN };
  }

  // OPTIMIZATION: Replacing slow Math.hypot with squared comparisons or standard Math.sqrt on high-frequency paths.
  const linearSpeedSq = lvx * lvx + lvy * lvy + lvz * lvz;
  if (linearSpeedSq > 576) { // 24 * 24
    return { code: 'linear-runaway', segment: sample.segment, value: Math.sqrt(linearSpeedSq) };
  }

  const angularSpeedSq = avx * avx + avy * avy + avz * avz;
  if (angularSpeedSq > 1024) { // 32 * 32
    return { code: 'angular-runaway', segment: sample.segment, value: Math.sqrt(angularSpeedSq) };
  }

  if (py < -3.5) return { code: 'below-world', segment: sample.segment, value: py };
  const arenaOverflow = Math.max(Math.abs(px) - arenaHalfWidth, Math.abs(pz) - arenaHalfDepth);
  if (arenaOverflow > 2) return { code: 'outside-arena', segment: sample.segment, value: arenaOverflow };
  return null;
};

export const jointSeparationFault = (segment: BodySegmentId, expectedDistance: number, actualDistance: number): NumericalFault | null => {
  const excess = actualDistance - expectedDistance;
  return excess > .42 ? { code: 'joint-separation', segment, value: excess } : null;
};
