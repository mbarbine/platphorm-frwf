import { useLoader } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { fitHumanoid } from '../presentation/fitHumanoid';
import { Bone, SkinnedMesh, TextureLoader, SRGBColorSpace, MeshStandardMaterial } from 'three';
import { bindFingerPoses } from '../presentation/handPose';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import materials from '../../../public/characters/materials.json';
import assets from '../../../public/characters/manifest.json';
import type { BodySegmentId } from '../physics/bodySchema';
import type { FighterId } from '../types/game';

export function useHumanoidAsset(fighterId: FighterId) {
  const asset = assets.fighters.find((entry) => entry.id === fighterId);
  if (!asset) throw new Error(`Missing character asset: ${fighterId}`);
  const gltf = useLoader(GLTFLoader, asset.url);
  const [skin, hair] = useLoader(TextureLoader, [materials[fighterId].skinUrl, materials[fighterId].hairUrl ?? materials[fighterId].skinUrl]);
  if (!skin || !hair) throw new Error(`Missing character materials: ${fighterId}`);
  hair.colorSpace = SRGBColorSpace;
  skin.colorSpace = SRGBColorSpace; skin.anisotropy = 4;
  const instance = useMemo(() => {
    const scene = clone(gltf.scene);
    const fit = fitHumanoid(scene, fighterId);
    const bones = new Map<BodySegmentId, Bone>();
    const fingers = bindFingerPoses(scene);
    scene.traverse((node) => {
      if (node instanceof Bone) {
        if (!/Thumb|Index|Middle|Ring|Little/.test(node.name)) bones.set(node.name as BodySegmentId, node);
      }
      if (node instanceof SkinnedMesh) {
        if (node.material instanceof MeshStandardMaterial) { node.material = node.material.clone(); node.material.map = node.material.name === 'hair' ? hair : skin; node.material.roughness = node.material.name === 'hair' ? .92 : .7; }
        node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; }
    });
    return { scene, bones, fingers, modelScale: fit.scale, dispose: () => { fit.dispose(); scene.traverse(node => { if (node instanceof SkinnedMesh && node.material instanceof MeshStandardMaterial) node.material.dispose(); }); } };
  }, [gltf, fighterId, skin, hair]);
  useEffect(() => () => instance.dispose(), [instance]);
  return instance;
}
