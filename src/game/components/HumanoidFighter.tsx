import { useHumanoidAsset } from './useHumanoidAsset';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { FighterRuntime, FighterSlot } from '../types/game';
import { FighterAccessories } from './FighterAccessories';

/** A standard skinned glTF asset, driven by the same solved bones as contact. */
export function HumanoidFighter({ runtime, side }: { runtime: FighterRuntime; side: FighterSlot }) {
  const { scene, bones, fingers, modelScale } = useHumanoidAsset(runtime.definitionId);
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

  return <><primitive object={scene} dispose={null} /><FighterAccessories fighterId={runtime.definitionId} side={side} modelScale={modelScale} /></>;
}
