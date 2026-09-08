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
    const index = scene.getObjectByName(`${side}Index1`);
    const middle = scene.getObjectByName(`${side}Middle1`);
    const little = scene.getObjectByName(`${side}Little1`);
    if (!index || !middle || !little) throw new Error(`Missing ${side} finger landmarks`);
    const indexPoint = index.getWorldPosition(new Vector3());
    const middlePoint = middle.getWorldPosition(new Vector3());
    const across = indexPoint.clone().sub(little.getWorldPosition(new Vector3()));
    const down = middlePoint.clone().sub(hand.getWorldPosition(new Vector3()));
    // Bone roll is arbitrary: local +Z can run across the knuckles instead
    // of out of the palm. Derive the anatomical plane from the actual hand.
    const palm = across.cross(down).normalize().multiplyScalar(side === 'left' ? 1 : -1);
    const direction = new Vector3(0, -1, 0).applyQuaternion(orientation);
    const link = Number(node.name.slice(-1)) - 1;
    let closedAngle = (node.name.includes('Thumb') ? [.65, .8, .5][link] : [1.1, 1.4, .85][link]) ?? .45;
    let target = palm;
    if (node.name.includes('Thumb') && link === 0) {
      // Oppose the thumb across the folded fingers instead of pointing it
      // away from the fist like a raised claw.
      target = indexPoint.clone().lerp(middlePoint, .6).addScaledVector(palm, .025).sub(node.getWorldPosition(new Vector3())).normalize();
      closedAngle = Math.min(1.5, direction.angleTo(target));
    }
    const curlAxis = direction.cross(target).normalize().applyQuaternion(orientation.invert());
    fingers.push({ bone: node, rest: node.quaternion.clone(), curlAxis, closedAngle });
  });
  return fingers;
}
