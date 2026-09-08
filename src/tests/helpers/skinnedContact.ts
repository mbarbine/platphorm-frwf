import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { type Bone, type SkinnedMesh, Quaternion, Triangle, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { RigidBody } from '@dimforge/rapier3d-compat';
import { fitHumanoid } from '../../game/presentation/fitHumanoid';
import { bindFingerPoses } from '../../game/presentation/handPose';
import type { BodySegmentId } from '../../game/physics/bodySchema';
import type { FighterId } from '../../game/types/game';
import manifest from '../../../public/characters/manifest.json';

/** Inspect the shipping skin at solved body transforms, not collider proxies. */
export async function loadContactSkin(id: FighterId) {
  const asset = manifest.fighters.find(fighter => fighter.id === id);
  if (!asset) throw new Error(`Missing character ${id}`);
  const bytes = readFileSync(resolve(import.meta.dirname, `../../../public${asset.url}`));
  const scene = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')).scene;
  const fitted = fitHumanoid(scene, id);
  const fingers = bindFingerPoses(scene);
  for (const finger of fingers) finger.bone.quaternion.copy(finger.rest).multiply(new Quaternion().setFromAxisAngle(finger.curlAxis, finger.closedAngle));
  const mesh = scene.getObjectByName(id) as SkinnedMesh;
  return {
    dispose: fitted.dispose,
    triangles(bodies: Record<BodySegmentId, RigidBody>): Triangle[] {
      const vertices = this.points(bodies);
      const indices = mesh.geometry.index;
      const result: Triangle[] = [];
      for (let i = 0; i < (indices?.count ?? vertices.length); i += 3) {
        const a = vertices[indices ? indices.getX(i) : i];
        const b = vertices[indices ? indices.getX(i + 1) : i + 1];
        const c = vertices[indices ? indices.getX(i + 2) : i + 2];
        if (a && b && c) result.push(new Triangle(a, b, c));
      }
      return result;
    },
    points(bodies: Record<BodySegmentId, RigidBody>, segment?: BodySegmentId): Vector3[] {
      for (const [name, body] of Object.entries(bodies)) {
        const bone = scene.getObjectByName(name) as Bone;
        bone.position.copy(body.translation()); bone.quaternion.copy(body.rotation());
      }
      scene.updateMatrixWorld(true); mesh.skeleton.update();
      const position = mesh.geometry.getAttribute('position');
      const weights = mesh.geometry.getAttribute('skinWeight'); const indices = mesh.geometry.getAttribute('skinIndex');
      const points: Vector3[] = [];
      for (let i = 0; i < position.count; i++) {
        let maximum = 0; let dominant = '';
        for (let j = 0; j < 4; j++) if (weights.getComponent(i, j) > maximum) {
          maximum = weights.getComponent(i, j); dominant = mesh.skeleton.bones[indices.getComponent(i, j)]?.name ?? '';
        }
        const handSide = segment?.includes('Hand') ? segment.replace('Hand', '') : null;
        if (segment && dominant !== segment && !(handSide && dominant.startsWith(handSide) && /Thumb|Index|Middle|Ring|Little/.test(dominant))) continue;
        points.push(mesh.applyBoneTransform(i, new Vector3().fromBufferAttribute(position, i)));
      }
      return points;
    },
  };
}

export function visibleSurfaceGap(source: readonly Vector3[], target: readonly Triangle[]): number {
  let squared = Infinity;
  const closest = new Vector3();
  for (const a of source) for (const triangle of target) {
    triangle.closestPointToPoint(a, closest);
    squared = Math.min(squared, a.distanceToSquared(closest));
  }
  return Math.sqrt(squared);
}
