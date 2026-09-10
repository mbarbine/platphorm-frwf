import { describe, expect, it } from 'vitest';
import { Group, Quaternion, Vector3 } from 'three';
import { PhysicalPoseBinding } from '../game/presentation/physicalPoseBinding';

const expectPoint = (actual: Vector3, expected: Vector3) => expect(actual.distanceTo(expected)).toBeLessThan(.000001);

describe('solved anatomy drives the rendered wrestler', () => {
  it('places a landmark exactly under a translated, rotated presentation shell', () => {
    const shell = new Group(); shell.position.set(4, 2, -7); shell.rotation.set(.2, 1.8, -.3);
    const root = new Group(); shell.add(root);
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 1.2);
    const pelvis = new Vector3(-2, 3.1, 1);
    new PhysicalPoseBinding().landmark(root, { position: pelvis, rotation }, [0, 1.02, 0]);
    root.updateWorldMatrix(true, false);
    expectPoint(root.localToWorld(new Vector3(0, 1.02, 0)), pelvis);
  });

  it.each([.65, .75, 1.05])('keeps both elbow and fist on solved joints through nested scales (%s)', (scale) => {
    const root = new Group(); root.scale.setScalar(scale); root.rotation.y = -1.3; root.position.set(2, 3, -4);
    const arm = new Group(); const forearm = new Group(); root.add(arm); arm.add(forearm);
    const shoulder = new Vector3(1, 3.7, -2);
    const elbow = new Vector3(1.3, 3.6, -1.7);
    const fist = new Vector3(1.6, 3.8, -1.3);
    const fit = new PhysicalPoseBinding(); const reference = { position: shoulder, rotation: new Quaternion() };
    fit.limb(arm, shoulder, elbow, [0, -.64, 0], reference);
    fit.limb(forearm, elbow, fist, [0, -.58, .035], reference);
    root.updateWorldMatrix(true, true);
    expectPoint(arm.localToWorld(new Vector3()), shoulder);
    expectPoint(arm.localToWorld(new Vector3(0, -.64, 0)), elbow);
    expectPoint(forearm.localToWorld(new Vector3()), elbow);
    expectPoint(forearm.localToWorld(new Vector3(0, -.58, .035)), fist);
  });
});
