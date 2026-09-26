import { Euler, Quaternion, Vector3, type Bone } from 'three';
import type { BodySegmentId } from '../physics/bodySchema';

const relaxed = new WeakSet<Map<BodySegmentId, Bone>>();

/** Relax the complete flat contact-bone chains about anatomical joints for the portrait. */
export function relaxPreviewStance(bones: Map<BodySegmentId, Bone>) {
  if (relaxed.has(bones)) return;
  relaxed.add(bones);
  const rotateChain = (ids: BodySegmentId[], pivot: Vector3, delta: Quaternion) => {
    for (const id of ids) {
      const bone = bones.get(id); if (!bone) continue;
      bone.position.sub(pivot).applyQuaternion(delta).add(pivot); bone.quaternion.premultiply(delta);
    }
  };
  for (const side of ['left', 'right'] as const) {
    const upper = bones.get(`${side}UpperArm`); const forearm = bones.get(`${side}Forearm`); const hand = bones.get(`${side}Hand`);
    if (!upper || !forearm || !hand) continue;
    const shoulder = new Vector3(0, upper.position.distanceTo(forearm.position) * .52, 0).applyQuaternion(upper.quaternion).add(upper.position);
    const target = new Quaternion().setFromEuler(new Euler(-.08, 0, side === 'left' ? -.12 : .12));
    rotateChain([`${side}UpperArm`, `${side}Forearm`, `${side}Hand`], shoulder, target.multiply(upper.quaternion.clone().invert()));
    const elbow = upper.position.clone().lerp(forearm.position, .5);
    const bend = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0).applyQuaternion(upper.quaternion), -.35);
    rotateChain([`${side}Forearm`, `${side}Hand`], elbow, bend);
  }
}
