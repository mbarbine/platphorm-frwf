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

const SIDES = ['left', 'right'] as const;
const LEFT_LEG_IDS: readonly BodySegmentId[] = ['leftThigh', 'leftShin', 'leftFoot'];
const RIGHT_LEG_IDS: readonly BodySegmentId[] = ['rightThigh', 'rightShin', 'rightFoot'];
const LEFT_ARM_IDS: readonly BodySegmentId[] = ['leftUpperArm', 'leftForearm', 'leftHand'];
const RIGHT_ARM_IDS: readonly BodySegmentId[] = ['rightUpperArm', 'rightForearm', 'rightHand'];
const ARM_LENGTHS = [0.285, 0.26, 0.15] as const;

/** Distance-driven exploration gait; bouts retain the articulated contact rig. */
export function WorldWrestler({ fighter, motion }: { fighter: FighterId; motion?: MutableRefObject<WalkingMotion> }) {
  const { scene, bones, fingers, modelScale } = useHumanoidAsset(fighter);
  const rest = useMemo(() => new Map([...bones].map(([id, bone]) => [id, bone.position.clone()])), [bones]);
  const rotation = useMemo(() => new Quaternion(), []);
  const axis = useMemo(() => new Vector3(1, 0, 0), []);
  const offset = useMemo(() => new Vector3(), []);
  // OPTIMIZATION: Pre-allocated reusable vectors and arrays eliminate GC churn inside useFrame.
  const proximalVec = useMemo(() => new Vector3(), []);
  const distalVec = useMemo(() => new Vector3(), []);
  const jointVec = useMemo(() => new Vector3(), []);
  const legAnchorVec = useMemo(() => new Vector3(), []);
  const armJointVec = useMemo(() => new Vector3(), []);
  const handOffsetVec = useMemo(() => new Vector3(0, -0.07, 0), []);
  const legAngles = useMemo(() => [0, 0, 0] as [number, number, number], []);

  useFrame(() => {
    const speed = motion?.current.speed ?? 0;
    const phase = (motion?.current.distance ?? 0) * 4.2;
    const gait = locomotionPose({ x: 0, z: speed }, 0, phase, false, fighter);
    for (const [id, bone] of bones) { const p = rest.get(id); if (p) bone.position.copy(p); bone.quaternion.identity(); }
    const chain = (ids: readonly BodySegmentId[], anchor: Vector3, angles: readonly number[]) => {
      jointVec.copy(anchor);
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]; if (!id) continue;
        const bone = bones.get(id); const original = rest.get(id); if (!bone || !original) continue;
        const nextId = ids[i + 1]; const next = nextId ? rest.get(nextId) : undefined;
        const previousId = ids[i - 1]; const previous = previousId ? rest.get(previousId) ?? anchor : anchor;
        if (i === 0) {
          proximalVec.copy(anchor);
        } else {
          proximalVec.copy(previous).add(original).multiplyScalar(0.5);
        }
        if (next) {
          distalVec.copy(original).add(next).multiplyScalar(0.5);
        } else {
          distalVec.copy(original).add(handOffsetVec);
        }
        rotation.setFromAxisAngle(axis, angles[i] ?? 0);
        bone.position.copy(jointVec).add(offset.copy(original).sub(proximalVec).applyQuaternion(rotation));
        bone.quaternion.copy(rotation);
        jointVec.add(offset.copy(distalVec).sub(proximalVec).applyQuaternion(rotation));
      }
    };
    for (const side of SIDES) {
      const sign = side === 'left' ? 1 : -1;
      const leg = side === 'left' ? gait.leftLeg : gait.rightLeg;
      const shin = side === 'left' ? gait.leftShin : gait.rightShin;
      const armPose = side === 'left' ? gait.leftArm : gait.rightArm;
      const forearmPose = side === 'left' ? gait.leftForearm : gait.rightForearm;
      const thigh = rest.get(`${side}Thigh`); const pelvis = rest.get('pelvis');
      if (thigh && pelvis) {
        legAnchorVec.set(thigh.x, (pelvis.y + thigh.y) * 0.5, thigh.z);
        legAngles[0] = leg[0]; legAngles[1] = leg[0] + shin[0]; legAngles[2] = 0;
        chain(side === 'left' ? LEFT_LEG_IDS : RIGHT_LEG_IDS, legAnchorVec, legAngles);
      }
      const arm = rest.get(`${side}UpperArm`); const chest = rest.get('chest');
      if (arm && chest) {
        // The asset is bound in an A-pose. Place arm centres along an upright
        // shoulder/elbow chain instead of reusing its spread-out bind centres.
        armJointVec.set(-sign * 0.235 * modelScale, chest.y + 0.055 * modelScale, chest.z);
        const ids = side === 'left' ? LEFT_ARM_IDS : RIGHT_ARM_IDS;
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i]; const bone = id ? bones.get(id) : undefined; if (!bone) continue;
          rotation.setFromAxisAngle(axis, armPose[0] + (i > 0 ? forearmPose[0] : 0));
          offset.set(0, -(ARM_LENGTHS[i] ?? 0.15) * modelScale, 0).applyQuaternion(rotation);
          bone.position.copy(armJointVec).addScaledVector(offset, 0.5); bone.quaternion.copy(rotation);
          armJointVec.add(offset);
        }
      }
    }
    rotation.setFromAxisAngle(axis, -0.35);
    for (const finger of fingers) finger.bone.quaternion.copy(finger.rest).multiply(rotation);
    scene.updateMatrixWorld(true);
  });
  return <><primitive object={scene} dispose={null} /><FighterAccessories fighterId={fighter} modelScale={modelScale} previewPose={segment => { const bone = bones.get(segment); return bone ? { position: bone.position, rotation: bone.quaternion } : undefined; }} /></>;
}
