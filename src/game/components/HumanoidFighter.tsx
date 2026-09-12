import { useHumanoidAsset } from './useHumanoidAsset';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Quaternion } from 'three';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { FighterRuntime, FighterSlot } from '../types/game';
import { FighterAccessories } from './FighterAccessories';
import { applyPhysicalBonePose } from '../presentation/physicalSkinBinding';

/** A standard skinned glTF asset, driven by the same solved bones as contact. */
export function HumanoidFighter({ runtime, side }: { runtime: FighterRuntime; side: FighterSlot }) {
  const { scene, bones, fingers, modelScale } = useHumanoidAsset(runtime.definitionId);
  const parentRotation = useMemo(() => new Quaternion(), []);
  const curl = useMemo(() => new Quaternion(), []);
  const fingerTarget = useMemo(() => new Quaternion(), []);

  useFrame((_, dt) => {
    for (const [id, bone] of bones) {
      const transform = bodyWorksRuntime.segmentSnapshot(side, id);
      if (!transform) continue;
      applyPhysicalBonePose(bone, transform, parentRotation);
    }
    const gripping = ['grappling', 'grabbed', 'climbing'].includes(runtime.state);
    for (const finger of fingers) {
      curl.setFromAxisAngle(finger.curlAxis, finger.closedAngle * (gripping ? .55 : 1));
      fingerTarget.copy(finger.rest).multiply(curl);
      finger.bone.quaternion.slerp(fingerTarget, 1 - Math.exp(-16 * dt));
    }
    scene.updateMatrixWorld(true);
  });

  return <><primitive object={scene} dispose={null} /><FighterAccessories fighterId={runtime.definitionId} side={side} modelScale={modelScale} /></>;
}
