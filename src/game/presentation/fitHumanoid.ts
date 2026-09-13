import { Bone, Matrix4, SkinnedMesh, Vector3 } from 'three';
import { bodyVolume } from './bodyVolume';
import type { Object3D } from 'three';
import { buildBodySchema } from '../physics/bodySchema';
import { fighterById } from '../data/fighters';
import type { FighterId } from '../types/game';

/** Fit the authored human to the contact skeleton before binding live poses. */
export function fitHumanoid(scene: Object3D, fighterId: FighterId): { scale: number; dispose: () => void } {
  const head = scene.getObjectByName('head');
  const left = scene.getObjectByName('leftFoot');
  const right = scene.getObjectByName('rightFoot');
  if (!head || !left || !right) throw new Error('Character is missing its head or foot landmarks');
  scene.updateMatrixWorld(true);
  const nativeSpan = head.getWorldPosition(new Vector3()).y - (left.getWorldPosition(new Vector3()).y + right.getWorldPosition(new Vector3()).y) / 2;
  const schema = buildBodySchema(fighterById(fighterId));
  const targetHead = schema.find(segment => segment.id === 'head');
  const targetFoot = schema.find(segment => segment.id === 'leftFoot');
  if (!targetHead || !targetFoot || nativeSpan <= 0) throw new Error('Character has invalid standing landmarks');
  const scale = (targetHead.localPosition[1] - targetFoot.localPosition[1]) / nativeSpan;
  const meshes: SkinnedMesh[] = [];
  scene.traverse(node => {
    if (node instanceof Bone) node.position.multiplyScalar(scale);
    if (node instanceof SkinnedMesh) {
      // GLTF instances share cached geometry. Only this instance owns the fit.
      node.geometry = node.geometry.clone();
      node.geometry.scale(scale, scale, scale);
      meshes.push(node);
    }
  });
  scene.updateMatrixWorld(true);
  for (const mesh of meshes) {
    fitBodyVolume(mesh, fighterId);
    mesh.skeleton.calculateInverses();
    mesh.bind(mesh.skeleton, mesh.matrixWorld);
  }
  return { scale, dispose: () => { for (const mesh of meshes) mesh.geometry.dispose(); } };
}

/** Inflate in each bone's anatomical frame, blended by the authored skin weights.
 * A world-X scale would stretch bent arms sideways and pull wrists off their joints. */
export function fitBodyVolume(mesh: SkinnedMesh, fighterId: FighterId): void {
  const position = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.getAttribute('skinIndex');
  const weights = mesh.geometry.getAttribute('skinWeight');
  if (!position || !indices || !weights) return;
  const inverseMesh = new Matrix4().copy(mesh.matrixWorld).invert();
  const transforms = mesh.skeleton.bones.map(bone => {
    const [width, depth] = bodyVolume(fighterId, bone.name);
    const boneToMesh = new Matrix4().multiplyMatrices(inverseMesh, bone.matrixWorld);
    return new Matrix4().copy(boneToMesh).multiply(new Matrix4().makeScale(width, 1, depth)).multiply(boneToMesh.clone().invert());
  });
  const source = new Vector3(); const transformed = new Vector3(); const sum = new Vector3();
  for (let vertex = 0; vertex < position.count; vertex++) {
    source.fromBufferAttribute(position, vertex); sum.set(0, 0, 0);
    let total = 0;
    for (let influence = 0; influence < 4; influence++) {
      const weight = weights.getComponent(vertex, influence);
      const transform = transforms[indices.getComponent(vertex, influence)];
      if (!transform || weight <= 0) continue;
      sum.addScaledVector(transformed.copy(source).applyMatrix4(transform), weight); total += weight;
    }
    if (total > 0) { sum.divideScalar(total); position.setXYZ(vertex, sum.x, sum.y, sum.z); }
  }
  position.needsUpdate = true;
  mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
}
