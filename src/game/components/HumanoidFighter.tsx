import { useRosterPresentation } from '../presentation/rosterReadiness';
import { useMatchStore } from '../state/matchStore';
import { useHumanoidAsset } from './useHumanoidAsset';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Quaternion } from 'three';
import { BODY_SEGMENT_COUNT } from '../physics/bodySchema';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { FighterRuntime, FighterSlot } from '../types/game';
import { FighterAccessories } from './FighterAccessories';
import { applyPhysicalBonePose } from '../presentation/physicalSkinBinding';
import { fighterVisual } from '../presentation/fighterVisuals';
import { skinRoughnessForEffort } from '../presentation/skinFinish';

// OPTIMIZATION: Extract inline gripping state array to static constant to eliminate per-frame GC allocations in useFrame.
const GRIPPING_STATES = new Set(['grappling', 'grabbed', 'climbing']);

/** A standard skinned glTF asset, driven by the same solved bones as contact. */
export function HumanoidFighter({ runtime, side }: { runtime: FighterRuntime; side: FighterSlot }) {
  const { scene, bones, fingers, skinMaterials, modelScale } = useHumanoidAsset(runtime.definitionId);
  const parentRotation = useMemo(() => new Quaternion(), []);
  const curl = useMemo(() => new Quaternion(), []);
  const fingerTarget = useMemo(() => new Quaternion(), []);
  const finishTimer = useRef(0);
  const baseSkinRoughness = fighterVisual(runtime.definitionId).skinRoughness;

  useFrame((_, dt) => {
    let posedBones = 0;
    for (const [id, bone] of bones) {
      const transform = bodyWorksRuntime.segmentSnapshot(side, id);
      if (!transform) continue;
      applyPhysicalBonePose(bone, transform, parentRotation);
      posedBones += 1;
    }
    const gripping = GRIPPING_STATES.has(runtime.state);
    for (const finger of fingers) {
      curl.setFromAxisAngle(finger.curlAxis, finger.closedAngle * (gripping ? .55 : 1));
      fingerTarget.copy(finger.rest).multiply(curl);
      finger.bone.quaternion.slerp(fingerTarget, 1 - Math.exp(-16 * dt));
    }
    finishTimer.current += dt;
    if (finishTimer.current >= .12) {
      finishTimer.current %= .12;
      const active = Boolean(runtime.moveId) || ['attacking', 'grappling', 'grabbed', 'recovering'].includes(runtime.state);
      const roughness = skinRoughnessForEffort(baseSkinRoughness, runtime.stamina, runtime.staminaCap, active);
      for (const material of skinMaterials) material.roughness = roughness;
    }
    scene.updateMatrixWorld(true);
    if (posedBones === BODY_SEGMENT_COUNT) useRosterPresentation.getState().mark(useMatchStore.getState().model.runtimeId, side);
    if (side === 'player' && posedBones === BODY_SEGMENT_COUNT && runtime.moveId && runtime.attackPhase) {
      bodyWorksRuntime.recordPlayerAttackPose({ moveId: runtime.moveId, instanceId: runtime.attackInstanceId });
    }
  });

  return <><primitive object={scene} dispose={null} /><FighterAccessories fighterId={runtime.definitionId} side={side} modelScale={modelScale} /></>;
}
