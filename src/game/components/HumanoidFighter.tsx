import { useFrame, useLoader } from '@react-three/fiber';
import { useMemo } from 'react';
import { Bone, SkinnedMesh, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import assets from '../../../public/characters/manifest.json';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { BodySegmentId } from '../physics/bodySchema';
import type { FighterRuntime, FighterSlot } from '../types/game';
import { FighterAccessories } from './FighterAccessories';

/** A standard skinned glTF asset, driven by the same solved bones as contact. */
export function HumanoidFighter({ runtime, side }: { runtime: FighterRuntime; side: FighterSlot }) {
  const asset = assets.fighters.find((entry) => entry.id === runtime.definitionId);
  if (!asset) throw new Error(`Missing character asset: ${runtime.definitionId}`);
  const gltf = useLoader(GLTFLoader, asset.url);
  const { scene, bones, fingers } = useMemo(() => {
    const scene = clone(gltf.scene);
    const bones = new Map<BodySegmentId, Bone>();
    const fingers: { bone: Bone; rest: Quaternion }[] = [];
    scene.traverse((node) => {
      if (node instanceof Bone) {
        if (/Thumb|Index|Middle|Ring|Little/.test(node.name)) fingers.push({ bone: node, rest: node.quaternion.clone() });
        else bones.set(node.name as BodySegmentId, node);
      }
      if (node instanceof SkinnedMesh) { node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; }
    });
    return { scene, bones, fingers };
  }, [gltf]);
  const curl = useMemo(() => new Quaternion(), []);
  const curlAxis = useMemo(() => new Vector3(1, 0, 0), []);

  useFrame(() => {
    for (const [id, bone] of bones) {
      const transform = bodyWorksRuntime.segmentSnapshot(side, id);
      if (!transform) continue;
      bone.position.copy(transform.position);
      bone.quaternion.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
    }
    const gripping = ['grappling', 'grabbed', 'climbing'].includes(runtime.state);
    curl.setFromAxisAngle(curlAxis, gripping ? -.45 : -.95);
    for (const finger of fingers) finger.bone.quaternion.copy(finger.rest).multiply(curl);
    scene.updateMatrixWorld(true);
  });

  return <><primitive object={scene} dispose={null} /><FighterAccessories fighterId={runtime.definitionId} side={side} /></>;
}
