import { Bone, Quaternion, Vector3, type Object3D } from 'three';

export interface FingerPose {
  bone: Bone;
  rest: Quaternion;
  curlAxis: Vector3;
  closedAngle: number;
}

/** Resolve each finger's bend in its own palm plane before the live rig moves. */
export function bindFingerPoses(scene: Object3D): FingerPose[] {
  const fingers: FingerPose[] = [];
  scene.traverse(node => {
    if (!(node instanceof Bone) || !/Thumb|Index|Middle|Ring|Little/.test(node.name)) return;
    const side = node.name.startsWith('left') ? 'left' : 'right';
    const hand = scene.getObjectByName(`${side}Hand`);
    if (!hand) throw new Error(`Missing ${side} hand`);
    const orientation = node.getWorldQuaternion(new Quaternion());
    const palm = new Vector3(0, 0, 1).applyQuaternion(hand.getWorldQuaternion(new Quaternion()));
    const direction = new Vector3(0, -1, 0).applyQuaternion(orientation);
    const curlAxis = direction.cross(palm).normalize().applyQuaternion(orientation.invert());
    const link = Number(node.name.slice(-1)) - 1;
    const closedAngle = (node.name.includes('Thumb') ? [.65, .8, .5][link] : [1.1, 1.4, .85][link]) ?? .45;
    fingers.push({ bone: node, rest: node.quaternion.clone(), curlAxis, closedAngle });
  });
  return fingers;
}
