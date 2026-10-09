import { useRosterPresentation } from '../presentation/rosterReadiness';
import { useMatchStore } from '../state/matchStore';
import { useHumanoidAsset } from './useHumanoidAsset';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { PhysicsReplayFrame } from '../physics/replayBuffer';
import { Quaternion } from 'three';
import { BODY_SEGMENT_COUNT } from '../physics/bodySchema';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { FighterRuntime, FighterSlot } from '../types/game';
import { FighterAccessories } from './FighterAccessories';
import { applyPhysicalBonePose } from '../presentation/physicalSkinBinding';
import { fighterVisual } from '../presentation/fighterVisuals';
import { skinRoughnessForEffort } from '../presentation/skinFinish';

// OPTIMIZATION: Extract inline state arrays to static constants to eliminate per-frame GC allocations in useFrame.
const GRIPPING_STATES = new Set(['grappling', 'grabbed', 'climbing']);
const ACTIVE_EFFORT_STATES = new Set(['attacking', 'grappling', 'grabbed', 'recovering']);

/** A standard skinned glTF asset, driven by the same solved bones as contact. */
export function HumanoidFighter({ runtime, side, replayFrame }: { runtime: FighterRuntime; side: FighterSlot; replayFrame?: RefObject<PhysicsReplayFrame | null> }) {
  const { scene, boneEntries, fingers, skinMaterials, modelScale } = useHumanoidAsset(runtime.definitionId);
  const parentRotation = useMemo(() => new Quaternion(), []);
  const curl = useMemo(() => new Quaternion(), []);
  const fingerTarget = useMemo(() => new Quaternion(), []);
  const finishTimer = useRef(0);
  const baseSkinRoughness = fighterVisual(runtime.definitionId).skinRoughness;

  // OPTIMIZATION: Indexed for loops over pre-allocated boneEntries, fingers, and skinMaterials arrays eliminate Map iterator and for...of allocations inside 60Hz useFrame loop
  useFrame((_, dt) => {
    let posedBones = 0;
    for (let i = 0; i < boneEntries.length; i++) {
      const entry = boneEntries[i];
      if (!entry) continue;
      const [id, bone] = entry;
      const transform = replayFrame ? replayFrame.current?.fighters[side]?.[id] : bodyWorksRuntime.segmentSnapshot(side, id);
      if (!transform) continue;
      applyPhysicalBonePose(bone, transform, parentRotation);
      posedBones += 1;
    }
    if (replayFrame) scene.visible = posedBones > 0;
    const gripping = GRIPPING_STATES.has(runtime.state);
    for (let i = 0; i < fingers.length; i++) {
      const finger = fingers[i];
      if (!finger) continue;
      curl.setFromAxisAngle(finger.curlAxis, finger.closedAngle * (gripping ? .55 : 1));
      fingerTarget.copy(finger.rest).multiply(curl);
      finger.bone.quaternion.slerp(fingerTarget, 1 - Math.exp(-16 * dt));
    }
    finishTimer.current += dt;
    if (finishTimer.current >= .12) {
      finishTimer.current %= .12;
      const active = Boolean(runtime.moveId) || ACTIVE_EFFORT_STATES.has(runtime.state);
      const roughness = skinRoughnessForEffort(baseSkinRoughness, runtime.stamina, runtime.staminaCap, active);
      for (let i = 0; i < skinMaterials.length; i++) {
        const material = skinMaterials[i];
        if (material) material.roughness = roughness;
      }
    }
    scene.updateMatrixWorld(true);
    if (!replayFrame) useRosterPresentation.getState().mark(useMatchStore.getState().model.runtimeId, side);
    if (!replayFrame && side === 'player' && posedBones === BODY_SEGMENT_COUNT && runtime.moveId && runtime.attackPhase) {
      bodyWorksRuntime.recordPlayerAttackPose({ moveId: runtime.moveId, instanceId: runtime.attackInstanceId });
    }
  });

  return <><primitive object={scene} dispose={null} /><FighterAccessories fighterId={runtime.definitionId} side={side} modelScale={modelScale} recordedPose={replayFrame ? segment => replayFrame.current?.fighters[side]?.[segment] : undefined} /></>;
}
