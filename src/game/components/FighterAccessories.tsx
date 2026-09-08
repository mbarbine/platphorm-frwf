import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Group, Vector3, Quaternion } from 'three';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { useMatchStore } from '../state/matchStore';
import { fighterById } from '../data/fighters';
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
export function FighterAccessories({ fighterId, side, previewPose }: { fighterId: FighterId; side?: FighterSlot; previewPose?: (segment: 'head' | 'pelvis' | 'chest') => { position: Vector3; rotation: Quaternion } | undefined }) {
  const head = useRef<Group>(null); const waist = useRef<Group>(null); const chest = useRef<Group>(null);
  const fighter = fighterById(fighterId);
  useFrame(() => {
    for (const [ref, segment] of [[head, 'head'], [waist, 'pelvis'], [chest, 'chest']] as const) {
      const pose = previewPose ? previewPose(segment) : side ? bodyWorksRuntime.segmentSnapshot(side, segment) : undefined; if (!pose || !ref.current) continue;
      ref.current.position.copy(pose.position); ref.current.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
    }
    if (waist.current) { const model = useMatchStore.getState().model; waist.current.visible = Boolean(previewPose) || model.elapsed < 2 || Boolean(side && model[side].state === 'victorious'); }
  });
  return <>
    <group ref={head}>
      {fighterId === 'chad' ? <>
        <mesh position={[0, .09, 0]}><sphereGeometry args={[.115, 24, 12, 0, Math.PI * 2, 0, Math.PI * .53]} /><meshStandardMaterial color="#141820" roughness={.92} /></mesh>
        <mesh position={[0, .115, .11]} scale={[1, .12, 1]}><sphereGeometry args={[.12, 24, 8]} /><meshStandardMaterial color="#191c24" roughness={.85} /></mesh>
        {[-1, 1].map((s) => <group key={s} position={[s * .048, .028, .107]} rotation={[0, s * -.13, s * -.08]}>
          <mesh scale={[1, 1.1, .22]}><sphereGeometry args={[.043, 20, 12]} /><meshStandardMaterial color="#137381" metalness={.88} roughness={.13} emissive="#124c5a" emissiveIntensity={.25} /></mesh>
          <mesh scale={[1, 1.1, 1]}><torusGeometry args={[.043, .003, 6, 24]} /><meshStandardMaterial color="#202128" metalness={.75} roughness={.22} /></mesh>
        </group>)}
        <mesh position={[0, .038, .117]}><boxGeometry args={[.025, .005, .006]} /><meshStandardMaterial color="#22242a" metalness={.7} roughness={.2} /></mesh>
        <mesh position={[0, -.015, .009]} scale={[1, .76, 1.05]}><sphereGeometry args={[.106, 24, 12, 0, Math.PI, Math.PI * .49, Math.PI * .45]} /><meshStandardMaterial color="#38251e" roughness={.97} /></mesh>
      </> : fighterId === 'atlas' ? <group position={[0, .13, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.102, .009, 8, 28]} /><meshStandardMaterial color="#c99b40" metalness={.8} roughness={.3} /></mesh>
        {[-.072, 0, .072].map((x) => <mesh key={x} position={[x, .026, .067]}><coneGeometry args={[.018, .064, 5]} /><meshStandardMaterial color="#e7bc57" metalness={.75} roughness={.28} /></mesh>)}
      </group> : fighterId === 'vex' ? <mesh position={[0, .13, -.005]} scale={[.2, 1, 1]}><capsuleGeometry args={[.06, .11, 8, 16]} /><meshStandardMaterial color="#17323b" roughness={.86} /></mesh>
        : <mesh position={[0, fighterId === 'nova' ? .025 : .11, fighterId === 'nova' ? .105 : 0]} scale={fighterId === 'nova' ? [1, .35, .15] : [1, .28, 1]}><sphereGeometry args={[.112, 24, 12]} /><meshStandardMaterial color={fighter.palette.primary} roughness={.78} /></mesh>}
    </group>
    {fighterId === 'chad' && <>
      <group ref={waist}><mesh scale={[1.35, 1, .8]}><cylinderGeometry args={[.21, .21, .3, 32, 1, true]} /><meshStandardMaterial color="#14151a" roughness={.76} /></mesh><ChampionshipPlate /></group>
      <group ref={chest}><group position={[-.11, .025, .16]} rotation={[0, -.2, 0]}>
        <mesh scale={[1.5, .65, 1]}><torusGeometry args={[.032, .004, 5, 24]} /><meshStandardMaterial color="#28312e" roughness={1} /></mesh>
        <mesh><sphereGeometry args={[.011, 10, 8]} /><meshStandardMaterial color="#28312e" roughness={1} /></mesh>
        <mesh position={[0, -.045, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[.01, .045, 3]} /><meshStandardMaterial color="#28312e" roughness={1} /></mesh>
      </group></group>
    </>}
  </>;
}
