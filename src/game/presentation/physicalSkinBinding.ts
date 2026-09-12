import type { Bone, Quaternion } from 'three';

interface PhysicalBonePose {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
}

/** Apply a solved world-space pose to a bone in a flat or nested export rig.
 * Call in parent-before-child order. Scratch storage belongs to the instance.
 */
export function applyPhysicalBonePose(bone: Bone, pose: PhysicalBonePose, parentRotation: Quaternion): void {
  bone.position.set(pose.position.x, pose.position.y, pose.position.z);
  bone.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
  const parent = bone.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    parent.worldToLocal(bone.position);
    parent.getWorldQuaternion(parentRotation).invert();
    bone.quaternion.premultiply(parentRotation);
  }
  bone.updateMatrix();
}
