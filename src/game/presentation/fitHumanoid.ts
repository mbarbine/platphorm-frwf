import { Bone, SkinnedMesh } from 'three';
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
  const nativeSpan = head.position.y - (left.position.y + right.position.y) / 2;
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
    mesh.skeleton.calculateInverses();
    mesh.bind(mesh.skeleton, mesh.matrixWorld);
  }
  return { scale, dispose: () => { for (const mesh of meshes) mesh.geometry.dispose(); } };
}
