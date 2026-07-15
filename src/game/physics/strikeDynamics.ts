import type { BodySegmentId } from './bodySchema';

export interface PhysicsVector3 { x: number; y: number; z: number }
export interface PhysicsVector2 { x: number; z: number }

export interface StrikeDriveProfile {
  source: BodySegmentId;
  target: BodySegmentId;
  speed: number;
  response: number;
  maximumAcceleration: number;
  pelvisAcceleration: number;
}

const HAND_STRIKE: StrikeDriveProfile = { source: 'rightHand', target: 'chest', speed: 18, response: 32, maximumAcceleration: 600, pelvisAcceleration: 5.4 };

export const strikeDriveProfile = (moveId: string): StrikeDriveProfile | null => {
  if (moveId === 'jab') return HAND_STRIKE;
  if (moveId === 'combo') return { source: 'leftHand', target: 'chest', speed: 13.5, response: 17, maximumAcceleration: 185, pelvisAcceleration: 2.2 };
  if (moveId === 'high_punch') return { source: 'rightHand', target: 'head', speed: 14.5, response: 18, maximumAcceleration: 195, pelvisAcceleration: 2.7 };
  if (moveId === 'heavy') return { source: 'rightHand', target: 'head', speed: 16.5, response: 18, maximumAcceleration: 225, pelvisAcceleration: 3.4 };
  if (moveId === 'uppercut') return { source: 'rightHand', target: 'head', speed: 17.2, response: 19, maximumAcceleration: 235, pelvisAcceleration: 3.8 };
  if (moveId === 'low_kick') return { source: 'rightFoot', target: 'leftShin', speed: 14.8, response: 18, maximumAcceleration: 205, pelvisAcceleration: 2.2 };
  if (moveId === 'high_kick') return { source: 'rightFoot', target: 'head', speed: 17.2, response: 19, maximumAcceleration: 240, pelvisAcceleration: 3.9 };
  if (moveId === 'roundhouse') return { source: 'rightFoot', target: 'head', speed: 18.5, response: 20, maximumAcceleration: 255, pelvisAcceleration: 4.5 };
  if (moveId === 'front_kick') return { source: 'rightFoot', target: 'chest', speed: 16.2, response: 18, maximumAcceleration: 230, pelvisAcceleration: 3.8 };
  if (moveId === 'piledriver') return { source: 'chest', target: 'head', speed: 20, response: 30, maximumAcceleration: 520, pelvisAcceleration: 18 };
  // A wrestling stiff-arm lands through the braced forearm/elbow line. The
  // rope rebound uses the opposite arm so the player can pick left or right.
  if (moveId === 'stiff_arm') return { source: 'rightForearm', target: 'chest', speed: 18.5, response: 24, maximumAcceleration: 340, pelvisAcceleration: 11 };
  if (moveId === 'rebound') return { source: 'leftForearm', target: 'chest', speed: 18.5, response: 24, maximumAcceleration: 340, pelvisAcceleration: 11 };
  if (moveId === 'spear') return { source: 'chest', target: 'pelvis', speed: 13.8, response: 19, maximumAcceleration: 245, pelvisAcceleration: 8.4 };
  if (moveId === 'prop') return { source: 'rightHand', target: 'head', speed: 15, response: 16, maximumAcceleration: 205, pelvisAcceleration: 3 };
  if (moveId === 'ground') return { source: 'rightFoot', target: 'chest', speed: 14.5, response: 16, maximumAcceleration: 210, pelvisAcceleration: 1.2 };
  if (moveId === 'aerial') return { source: 'chest', target: 'chest', speed: 16.2, response: 20, maximumAcceleration: 280, pelvisAcceleration: 18 };
  if (moveId === 'aerial_kick') return { source: 'rightFoot', target: 'chest', speed: 14.5, response: 16, maximumAcceleration: 210, pelvisAcceleration: 5.8 };
  if (moveId === 'aerial_elbow') return { source: 'rightForearm', target: 'chest', speed: 15.2, response: 18, maximumAcceleration: 230, pelvisAcceleration: 5.4 };
  if (moveId === 'counter') return { source: 'rightHand', target: 'chest', speed: 14, response: 18, maximumAcceleration: 195, pelvisAcceleration: 3.8 };
  return null;
};

/**
 * A raised guard supplies the reachable target in front of the defender's
 * torso. The striking limb still receives its full authored drive, but the
 * attacker's centre of mass must not charge through that target and collapse
 * two articulated rigs into the same solver space.
 */
export const strikePelvisAcceleration = (profile: StrikeDriveProfile, guardIntercept: boolean, strikeDistance = .2): number => {
  if (!guardIntercept) return profile.pelvisAcceleration;
  const clearance = Math.max(0, strikeDistance - .2);
  return Math.min(profile.pelvisAcceleration, .8 + clearance * 4.75);
};

/**
 * Guard limbs are a near-field target. Driving an already-adjacent glove at
 * the move's full open-space speed asks the constraint solver to tunnel one
 * articulated chain through another. Approach the contact surface at a speed
 * proportional to the remaining clearance while preserving the authored limb.
 */
export const guardInterceptDriveProfile = (profile: StrikeDriveProfile, strikeDistance: number): StrikeDriveProfile => {
  const clearance = Math.max(0, strikeDistance - .2);
  return {
    ...profile,
    // Articulated shoulders and elbows absorb part of the commanded hand
    // speed. Keep enough near-field authority to close the final few
    // centimetres into a real guard collider during a short jab window.
    speed: Math.min(profile.speed, 2.1 + clearance * 16),
    response: Math.min(profile.response, 18 + clearance * 22),
    maximumAcceleration: Math.min(profile.maximumAcceleration, 180 + clearance * 520),
  };
};

/** Returns the near surface of a raised guard limb, never its solid center. */
export const guardInterceptSurfaceTarget = (source: PhysicsVector3, target: PhysicsVector3, centerClearance = .08): PhysicsVector3 => {
  const dx = target.x - source.x; const dy = target.y - source.y; const dz = target.z - source.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance <= centerClearance || distance < 1e-7) return source;
  const scale = (distance - centerClearance) / distance;
  return { x: source.x + dx * scale, y: source.y + dy * scale, z: source.z + dz * scale };
};

const clampMagnitude = (vector: PhysicsVector3, maximum: number): PhysicsVector3 => {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  if (magnitude <= maximum || magnitude < 1e-7) return vector;
  const scale = maximum / magnitude;
  return { x: vector.x * scale, y: vector.y * scale, z: vector.z * scale };
};

/** Continuous planar reach for attacks that can cross a target in one phase. */
export const sweptPlanarPathHitsTarget = (start: PhysicsVector2, end: PhysicsVector2, target: PhysicsVector2, width: number): boolean => {
  const pathX = end.x - start.x; const pathZ = end.z - start.z; const pathLengthSquared = pathX * pathX + pathZ * pathZ;
  if (pathLengthSquared <= .0025) return false;
  const projection = ((target.x - start.x) * pathX + (target.z - start.z) * pathZ) / pathLengthSquared;
  if (projection < 0 || projection > 1) return false;
  const closestX = start.x + pathX * projection; const closestZ = start.z + pathZ * projection;
  return Math.hypot(target.x - closestX, target.z - closestZ) <= width;
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
