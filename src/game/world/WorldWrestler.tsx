import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { MutableRefObject } from 'react';
import type { BodySegmentId } from '../physics/bodySchema';
import type { FighterId } from '../types/game';
import { useHumanoidAsset } from '../components/useHumanoidAsset';
import { locomotionPose } from '../animation/locomotion';
import { FighterAccessories } from '../components/FighterAccessories';

export interface WalkingMotion { distance: number; speed: number }
/** Distance-driven exploration gait; bouts retain the articulated contact rig. */
export function WorldWrestler({ fighter, motion }: { fighter: FighterId; motion?: MutableRefObject<WalkingMotion> }) {
  const { scene, bones, fingers, modelScale } = useHumanoidAsset(fighter);
  const rest = useMemo(() => new Map([...bones].map(([id, bone]) => [id, bone.position.clone()])), [bones]);
  const rotation = useMemo(() => new Quaternion(), []);
  const axis = useMemo(() => new Vector3(1, 0, 0), []);
  const offset = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const speed = motion?.current.speed ?? 0;
    const phase = (motion?.current.distance ?? 0) * 4.2;
    const gait = locomotionPose({ x: 0, z: speed }, 0, phase, false);
    for (const [id, bone] of bones) { const p = rest.get(id); if (p) bone.position.copy(p); bone.quaternion.identity(); }
    const chain = (ids: BodySegmentId[], anchor: Vector3, angles: number[]) => {
      let joint = anchor;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]; if (!id) continue;
        const bone = bones.get(id); const original = rest.get(id); if (!bone || !original) continue;
        const nextId = ids[i + 1]; const next = nextId ? rest.get(nextId) : undefined;
        const previousId = ids[i - 1]; const previous = previousId ? rest.get(previousId) ?? anchor : anchor;
        const proximal = i === 0 ? anchor : previous.clone().add(original).multiplyScalar(.5);
        const distal = next ? original.clone().add(next).multiplyScalar(.5) : original.clone().add(new Vector3(0, -.07, 0));
        rotation.setFromAxisAngle(axis, angles[i] ?? 0);
        bone.position.copy(joint).add(offset.copy(original).sub(proximal).applyQuaternion(rotation));
        bone.quaternion.copy(rotation);
        joint = joint.clone().add(offset.copy(distal).sub(proximal).applyQuaternion(rotation));
      }
    };
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? 1 : -1;
      const leg = side === 'left' ? gait.leftLeg : gait.rightLeg;
      const shin = side === 'left' ? gait.leftShin : gait.rightShin;
      const armPose = side === 'left' ? gait.leftArm : gait.rightArm;
      const forearmPose = side === 'left' ? gait.leftForearm : gait.rightForearm;
      const thigh = rest.get(`${side}Thigh`); const pelvis = rest.get('pelvis');
      if (thigh && pelvis) chain([`${side}Thigh`, `${side}Shin`, `${side}Foot`], new Vector3(thigh.x, (pelvis.y + thigh.y) / 2, thigh.z), [leg[0], leg[0] + shin[0], 0]);
      const arm = rest.get(`${side}UpperArm`); const chest = rest.get('chest');
      if (arm && chest) {
        // The asset is bound in an A-pose. Place arm centres along an upright
        // shoulder/elbow chain instead of reusing its spread-out bind centres.
        const joint = new Vector3(-sign * .235 * modelScale, chest.y + .055 * modelScale, chest.z);
        const ids: BodySegmentId[] = [`${side}UpperArm`, `${side}Forearm`, `${side}Hand`];
        const lengths = [.285, .26, .15];
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i]; const bone = id ? bones.get(id) : undefined; if (!bone) continue;
          rotation.setFromAxisAngle(axis, armPose[0] + (i > 0 ? forearmPose[0] : 0));
          offset.set(0, -(lengths[i] ?? .15) * modelScale, 0).applyQuaternion(rotation);
          bone.position.copy(joint).addScaledVector(offset, .5); bone.quaternion.copy(rotation);
          joint.add(offset);
        }
      }
    }
    rotation.setFromAxisAngle(axis, -.35);
    for (const finger of fingers) finger.bone.quaternion.copy(finger.rest).multiply(rotation);
    scene.updateMatrixWorld(true);
  });
  return <><primitive object={scene} dispose={null} /><FighterAccessories fighterId={fighter} modelScale={modelScale} previewPose={segment => { const bone = bones.get(segment); return bone ? { position: bone.position, rotation: bone.quaternion } : undefined; }} /></>;
}
