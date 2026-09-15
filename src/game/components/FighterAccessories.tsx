import { OriginalFaceDetails } from './OriginalFaceDetails';
import { fighterById } from '../data/fighters';
import { segmentSchema } from '../physics/bodySchema';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Group, Vector3, Quaternion } from 'three';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { useMatchStore } from '../state/matchStore';
import type { BodySegmentId } from '../physics/bodySchema';
import type { FighterId, FighterSlot } from '../types/game';

function ChampionshipPlate() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 384;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#b9b6a9'; context.fillRect(0, 0, 512, 384);
      context.strokeStyle = '#55554c'; context.lineWidth = 12; context.strokeRect(10, 10, 492, 364);
      context.textAlign = 'center'; context.fillStyle = '#a72222'; context.font = '900 112px sans-serif'; context.fillText('FRWF', 256, 142);
      context.fillStyle = '#202426'; context.font = '900 34px sans-serif'; context.fillText('THE CLAW', 256, 232);
      context.font = '900 46px sans-serif'; context.fillText('CHAMPION', 256, 322);
    }
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; return texture;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={[0, .06, .2]}>
    <mesh><boxGeometry args={[.4, .29, .025]} /><meshStandardMaterial map={texture} metalness={.7} roughness={.36} /></mesh>
    {[-1, 1].flatMap((side) => [-.1, .1].map((y) => <mesh key={`${side}-${y}`} position={[side * .18, y, .019]}><sphereGeometry args={[.012, 8, 6]} /><meshStandardMaterial color="#dad9d2" metalness={.8} roughness={.28} /></mesh>))}
  </group>;
}

/** Identity details remain attached to solved anatomy throughout a throw. */
export function FighterAccessories({ fighterId, side, previewPose, modelScale = 1 }: { modelScale?: number; fighterId: FighterId; side?: FighterSlot; previewPose?: (segment: 'head' | 'pelvis' | 'chest') => { position: Vector3; rotation: Quaternion } | undefined }) {
  const head = useRef<Group>(null); const waist = useRef<Group>(null);
  // OPTIMIZATION: Update head and waist segment transforms directly to avoid per-frame array allocations in useFrame
  useFrame(() => {
    if (head.current) {
      const pose = previewPose ? previewPose('head') : side ? bodyWorksRuntime.segmentSnapshot(side, 'head') : undefined;
      if (pose) {
        head.current.position.copy(pose.position);
        head.current.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
      }
      if (fighterId === 'atlas') {
        const model = useMatchStore.getState().model;
        head.current.visible = Boolean(side && model[side].state === 'victorious');
      }
    }
    if (waist.current) {
      const pose = previewPose ? previewPose('pelvis') : side ? bodyWorksRuntime.segmentSnapshot(side, 'pelvis') : undefined;
      if (pose) {
        waist.current.position.copy(pose.position);
        waist.current.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
      }
      const model = useMatchStore.getState().model;
      waist.current.visible = Boolean(side && model[side].state === 'victorious');
    }
  });
  return <>
    {side && <RingGear side={side} fighterId={fighterId} />}
    <group ref={head} scale={modelScale}>
      <OriginalFaceDetails fighterId={fighterId} />
      {fighterId === 'atlas' ? <group position={[0, .13, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.102, .009, 8, 28]} /><meshStandardMaterial color="#c99b40" metalness={.8} roughness={.3} /></mesh>
        {[-.072, 0, .072].map((x) => <mesh key={x} position={[x, .026, .067]}><coneGeometry args={[.018, .064, 5]} /><meshStandardMaterial color="#e7bc57" metalness={.75} roughness={.28} /></mesh>)}
      </group> : fighterId === 'vex' ? <mesh position={[0, .13, -.005]} scale={[.2, 1, 1]}><capsuleGeometry args={[.06, .11, 8, 16]} /><meshStandardMaterial color="#17323b" roughness={.86} /></mesh>
        : null}
    </group>
    {fighterId === 'chad' && <>
      <group ref={waist}><mesh scale={[1.35, 1, .8]}><cylinderGeometry args={[.21, .21, .3, 32, 1, true]} /><meshStandardMaterial color="#14151a" roughness={.76} /></mesh><ChampionshipPlate /></group>
    </>}
  </>;
}


const GEAR_SEGMENTS: readonly BodySegmentId[] = ['leftForearm', 'rightForearm', 'leftFoot', 'rightFoot'];

/** Ring equipment follows solved joints, including throughout falls and covers. */
function RingGear({ side, fighterId }: { side: FighterSlot; fighterId: FighterId }) {
  const refs = useRef<Partial<Record<BodySegmentId, Group | null>>>({});
  // OPTIMIZATION: Iterate static GEAR_SEGMENTS over object dictionary to avoid Map iterator allocations in useFrame
  useFrame(() => {
    for (let i = 0; i < GEAR_SEGMENTS.length; i++) {
      const segment = GEAR_SEGMENTS[i];
      if (!segment) continue;
      const group = refs.current[segment];
      if (!group) continue;
      const pose = bodyWorksRuntime.segmentSnapshot(side, segment);
      if (pose) {
        group.position.copy(pose.position);
        group.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
      }
    }
  });
  const definition = fighterById(fighterId);
  return <>{(['leftForearm', 'rightForearm'] as const).map(segment => {
    const radius = segmentSchema(definition, segment).radius + .004;
    return <group key={segment} ref={group => { refs.current[segment] = group; }}>
      <mesh position={[0, -.12, 0]}><cylinderGeometry args={[radius, radius * .93, .105, 12]} /><meshStandardMaterial color="#e4ddc9" roughness={.94} /></mesh>
      {[-.15, -.095].map(y => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[radius + .001, radius + .001, .012, 12]} /><meshStandardMaterial color={definition.palette.primary} roughness={.78} /></mesh>)}
    </group>;
  })}{(['leftFoot', 'rightFoot'] as const).map(segment => <group key={segment} ref={group => { refs.current[segment] = group; }}>
    {<group position={[0, .048, .1]}>{[-.035, 0, .035].map(z => <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, Math.PI / 2]}><cylinderGeometry args={[.005, .005, .11, 5]} /><meshStandardMaterial color="#b3aa97" roughness={1} /></mesh>)}</group>}
  </group>)}</>;
}
