import { describe, expect, it } from 'vitest';
import { Bone, Group, Quaternion, Vector3 } from 'three';
import { applyPhysicalBonePose } from '../game/presentation/physicalSkinBinding';

const position = { x: 2, y: 3, z: -1 };
const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), .7);
const pose = { position, rotation };

function expectSolvedPose(bone: Bone) {
  expect(bone.getWorldPosition(new Vector3()).distanceTo(new Vector3(position.x, position.y, position.z))).toBeLessThan(1e-6);
  expect(bone.getWorldQuaternion(new Quaternion()).angleTo(rotation)).toBeLessThan(1e-6);
}

describe('physical pose to skin hierarchy', () => {
  it('preserves flat shipping-rig world poses', () => {
    const scene = new Group(); const bone = new Bone(); scene.add(bone);
    applyPhysicalBonePose(bone, pose, new Quaternion());
    expectSolvedPose(bone);
  });

  it('converts a nested bone through a translated, rotated, uniformly scaled parent', () => {
    const scene = new Group(); const chest = new Bone(); const arm = new Bone();
    scene.add(chest); chest.add(arm);
    scene.position.set(4, 1, -2); scene.rotation.y = -.8; scene.scale.setScalar(1.2);
    chest.position.set(0, 2, 0); chest.rotation.z = .4;
    applyPhysicalBonePose(arm, pose, new Quaternion());
    expectSolvedPose(arm);
  });

  it('uses the updated parent when both physical segments change in the same frame', () => {
    const scene = new Group(); const chest = new Bone(); const arm = new Bone();
    scene.add(chest); chest.add(arm); const scratch = new Quaternion();
    for (let frame = 0; frame < 30; frame++) {
      applyPhysicalBonePose(chest, { position: { x: frame * .1, y: 2, z: 1 }, rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), frame * .1) }, scratch);
      applyPhysicalBonePose(arm, pose, scratch);
      expectSolvedPose(arm);
    }
  });
});
