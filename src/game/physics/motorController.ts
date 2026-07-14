import { clamp } from '../utils/math';

export interface QuaternionValue { x: number; y: number; z: number; w: number }
export interface Vector3Value { x: number; y: number; z: number }
export interface MotorParameters { stiffness: number; damping: number; maxTorque: number; strength: number; fatigue: number }

const magnitude = (value: Vector3Value): number => Math.hypot(value.x, value.y, value.z);

export const shortestQuaternionError = (current: QuaternionValue, target: QuaternionValue): Vector3Value => {
  const inverse = { x: -current.x, y: -current.y, z: -current.z, w: current.w };
  let error = {
    x: target.w * inverse.x + target.x * inverse.w + target.y * inverse.z - target.z * inverse.y,
    y: target.w * inverse.y - target.x * inverse.z + target.y * inverse.w + target.z * inverse.x,
    z: target.w * inverse.z + target.x * inverse.y - target.y * inverse.x + target.z * inverse.w,
    w: target.w * inverse.w - target.x * inverse.x - target.y * inverse.y - target.z * inverse.z,
  };
  if (error.w < 0) error = { x: -error.x, y: -error.y, z: -error.z, w: -error.w };
  const vectorLength = Math.hypot(error.x, error.y, error.z);
  if (vectorLength < 1e-7) return { x: 0, y: 0, z: 0 };
  const angle = 2 * Math.atan2(vectorLength, clamp(error.w, -1, 1));
  return { x: error.x / vectorLength * angle, y: error.y / vectorLength * angle, z: error.z / vectorLength * angle };
};

export const availableMotorStrength = (strength: number, fatigue: number, damageMultiplier = 1): number => clamp(strength * (1 - clamp(fatigue, 0, 1) * .78) * damageMultiplier, 0, 1);

export const computeMotorTorque = (current: QuaternionValue, target: QuaternionValue, angularVelocity: Vector3Value, targetAngularVelocity: Vector3Value, parameters: MotorParameters): Vector3Value => {
  const error = shortestQuaternionError(current, target);
  const velocityError = { x: targetAngularVelocity.x - angularVelocity.x, y: targetAngularVelocity.y - angularVelocity.y, z: targetAngularVelocity.z - angularVelocity.z };
  // A small physical dead band lets settled bodies sleep instead of receiving
  // alternating sub-degree corrections that render as constant vibration.
  if (magnitude(error) < .006 && magnitude(velocityError) < .035) return { x: 0, y: 0, z: 0 };
  const strength = availableMotorStrength(parameters.strength, parameters.fatigue);
  const torque = {
    x: (error.x * parameters.stiffness + velocityError.x * parameters.damping) * strength,
    y: (error.y * parameters.stiffness + velocityError.y * parameters.damping) * strength,
    z: (error.z * parameters.stiffness + velocityError.z * parameters.damping) * strength,
  };
  const length = magnitude(torque);
  if (length <= parameters.maxTorque || length < 1e-8) return torque;
  const scale = parameters.maxTorque / length;
  return { x: torque.x * scale, y: torque.y * scale, z: torque.z * scale };
};

export interface JointAngularLimits { x: readonly [number, number]; y: readonly [number, number]; z: readonly [number, number] }
export const sanitizeEulerTarget = (target: Vector3Value, limits: JointAngularLimits): Vector3Value => ({
  x: clamp(target.x, limits.x[0], limits.x[1]),
  y: clamp(target.y, limits.y[0], limits.y[1]),
  z: clamp(target.z, limits.z[0], limits.z[1]),
});
