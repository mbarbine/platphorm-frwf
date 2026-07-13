import type { BodySegmentId } from './bodySchema';

export interface PhysicsVector3 { x: number; y: number; z: number }

export interface StrikeDriveProfile {
  source: BodySegmentId;
  target: BodySegmentId;
  speed: number;
  response: number;
  maximumAcceleration: number;
  pelvisAcceleration: number;
}

const HAND_STRIKE: StrikeDriveProfile = { source: 'rightHand', target: 'head', speed: 12.5, response: 15, maximumAcceleration: 165, pelvisAcceleration: 1.8 };

export const strikeDriveProfile = (moveId: string): StrikeDriveProfile | null => {
  if (moveId === 'jab') return HAND_STRIKE;
  if (moveId === 'combo') return { source: 'leftHand', target: 'chest', speed: 13.5, response: 17, maximumAcceleration: 185, pelvisAcceleration: 2.2 };
  if (moveId === 'heavy') return { source: 'rightHand', target: 'head', speed: 16.5, response: 18, maximumAcceleration: 225, pelvisAcceleration: 3.4 };
  if (moveId === 'stiff_arm' || moveId === 'rebound') return { source: 'rightHand', target: 'chest', speed: 15.5, response: 17, maximumAcceleration: 215, pelvisAcceleration: 7.2 };
  if (moveId === 'prop') return { source: 'rightHand', target: 'head', speed: 15, response: 16, maximumAcceleration: 205, pelvisAcceleration: 3 };
  if (moveId === 'ground' || moveId === 'aerial') return { source: 'rightFoot', target: 'chest', speed: 14.5, response: 16, maximumAcceleration: 210, pelvisAcceleration: moveId === 'aerial' ? 5.8 : 1.2 };
  if (moveId === 'counter') return { source: 'rightHand', target: 'chest', speed: 14, response: 18, maximumAcceleration: 195, pelvisAcceleration: 3.8 };
  return null;
};

const clampMagnitude = (vector: PhysicsVector3, maximum: number): PhysicsVector3 => {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  if (magnitude <= maximum || magnitude < 1e-7) return vector;
  const scale = maximum / magnitude;
  return { x: vector.x * scale, y: vector.y * scale, z: vector.z * scale };
};

/**
 * Converts a strike target into a bounded muscle force. The result only moves a
 * real rigid body; hit eligibility and damage remain owned by Rapier contacts.
 */
export const computeStrikeForce = (
  sourcePosition: PhysicsVector3,
  targetPosition: PhysicsVector3,
  sourceVelocity: PhysicsVector3,
  targetVelocity: PhysicsVector3,
  sourceMass: number,
  profile: StrikeDriveProfile,
): PhysicsVector3 => {
  const delta = { x: targetPosition.x - sourcePosition.x, y: targetPosition.y - sourcePosition.y, z: targetPosition.z - sourcePosition.z };
  const distance = Math.max(.001, Math.hypot(delta.x, delta.y, delta.z));
  const direction = { x: delta.x / distance, y: delta.y / distance, z: delta.z / distance };
  const desiredVelocity = {
    x: targetVelocity.x + direction.x * profile.speed,
    y: targetVelocity.y + direction.y * profile.speed,
    z: targetVelocity.z + direction.z * profile.speed,
  };
  const acceleration = clampMagnitude({
    x: (desiredVelocity.x - sourceVelocity.x) * profile.response,
    y: (desiredVelocity.y - sourceVelocity.y) * profile.response,
    z: (desiredVelocity.z - sourceVelocity.z) * profile.response,
  }, profile.maximumAcceleration);
  const mass = Math.max(.1, sourceMass);
  return { x: acceleration.x * mass, y: acceleration.y * mass, z: acceleration.z * mass };
};
