import { useLoader } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { fitHumanoid } from '../presentation/fitHumanoid';
import { Bone, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import assets from '../../../public/characters/manifest.json';
import type { BodySegmentId } from '../physics/bodySchema';
import type { FighterId } from '../types/game';

export function useHumanoidAsset(fighterId: FighterId) {
  const asset = assets.fighters.find((entry) => entry.id === fighterId);
  if (!asset) throw new Error(`Missing character asset: ${fighterId}`);
  const gltf = useLoader(GLTFLoader, asset.url);
  const instance = useMemo(() => {
    const scene = clone(gltf.scene);
    const fit = fitHumanoid(scene, fighterId);
    const bones = new Map<BodySegmentId, Bone>();
    const fingers: { bone: Bone; rest: Bone['quaternion']; curlAxis: Vector3; closedAngle: number }[] = [];
    scene.traverse((node) => {
      if (node instanceof Bone) {
        if (/Thumb|Index|Middle|Ring|Little/.test(node.name)) {
          const side = node.name.startsWith('left') ? 'left' : 'right';
          const hand = scene.getObjectByName(`${side}Hand`);
          if (!hand) throw new Error(`Missing ${side} hand`);
          const orientation = node.getWorldQuaternion(new Quaternion());
          const palm = new Vector3(0, 0, 1).applyQuaternion(hand.getWorldQuaternion(new Quaternion()));
          const direction = new Vector3(0, -1, 0).applyQuaternion(orientation);
          const curlAxis = direction.cross(palm).normalize().applyQuaternion(orientation.invert());
          const link = Number(node.name.slice(-1)) - 1;
          const closedAngle = (node.name.includes('Thumb') ? [.3, .45, .35][link] : [.7, 1.05, .7][link]) ?? .45;
          fingers.push({ bone: node, rest: node.quaternion.clone(), curlAxis, closedAngle });
        }
        else bones.set(node.name as BodySegmentId, node);
      }
      if (node instanceof SkinnedMesh) { node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; }
    });
    return { scene, bones, fingers, modelScale: fit.scale, dispose: fit.dispose };
  }, [gltf, fighterId]);
  useEffect(() => () => instance.dispose(), [instance]);
  return instance;
}
