import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import type { Group } from 'three';
import type { FighterId } from '../game/types/game';
import { useHumanoidAsset } from '../game/components/useHumanoidAsset';
import { FighterAccessories } from '../game/components/FighterAccessories';
import { useSettings } from '../game/state/settings';

function Portrait({ fighterId }: { fighterId: FighterId }) {
  const { scene, bones } = useHumanoidAsset(fighterId);
  const root = useRef<Group>(null);
  const reduced = useSettings((s) => s.reducedMotion);
  useFrame(({ clock }) => {
    if (root.current) root.current.rotation.y = reduced ? -.18 : -.18 + Math.sin(clock.elapsedTime * .35) * .22;
  });
  return <group ref={root} position={[0, -.85, 0]}>
    <primitive object={scene} dispose={null} />
    <FighterAccessories fighterId={fighterId} previewPose={(segment) => {
      const bone = bones.get(segment);
      return bone ? { position: bone.position, rotation: bone.quaternion } : undefined;
    }} />
  </group>;
}

export function FighterPreview({ fighterId }: { fighterId: FighterId }) {
  return <div className="fighter-preview" aria-hidden="true"><Canvas camera={{ position: [0, .15, 3.65], fov: 34 }} dpr={[1, 1.5]}>
    <color attach="background" args={['#090c14']} />
    <ambientLight intensity={.8} />
    <directionalLight position={[2, 4, 4]} intensity={3.2} color="#fff0dd" />
    <directionalLight position={[-3, 2, 2]} intensity={1.4} color="#8bd9ff" />
    <directionalLight position={[1, 2, -2]} intensity={3} color="#a77aff" />
    <Suspense fallback={null}><Portrait key={fighterId} fighterId={fighterId} /></Suspense>
    <mesh position={[0, -.86, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.75, 48]} /><meshStandardMaterial color="#202835" roughness={.45} metalness={.4} /></mesh>
  </Canvas></div>;
}
