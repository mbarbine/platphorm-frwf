import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useRef, useEffect, useState } from 'react';
import { relaxPreviewStance } from '../game/presentation/previewStance';
import { PerspectiveCamera, type Group } from 'three';
import type { FighterId } from '../game/types/game';
import { useHumanoidAsset } from '../game/components/useHumanoidAsset';
import { FighterAccessories } from '../game/components/FighterAccessories';
import { useSettings } from '../game/state/settings';

function Portrait({ fighterId, onReady }: { fighterId: FighterId; onReady: (id: FighterId) => void }) {
  const { scene, bones, modelScale } = useHumanoidAsset(fighterId);
  const root = useRef<Group>(null);
  const { camera, size } = useThree();
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const halfFov = Math.tan(camera.fov * Math.PI / 360);
    camera.position.z = Math.max(2.7 / (2 * halfFov), 1.3 / (2 * halfFov * Math.max(.2, size.width / size.height)));
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  useEffect(() => { relaxPreviewStance(bones); scene.updateMatrixWorld(true); onReady(fighterId); }, [bones, scene, fighterId, onReady]);
  const reduced = useSettings((s) => s.reducedMotion);
  useFrame(({ clock }) => {
    if (root.current) root.current.rotation.y = reduced ? -.18 : -.18 + Math.sin(clock.elapsedTime * .35) * .22;
  });
  return <group ref={root} position={[0, -1.15, 0]}>
    <primitive object={scene} dispose={null} />
    <FighterAccessories fighterId={fighterId} modelScale={modelScale} previewPose={(segment) => {
      const bone = bones.get(segment);
      return bone ? { position: bone.position, rotation: bone.quaternion } : undefined;
    }} />
  </group>;
}

export function FighterPreview({ fighterId }: { fighterId: FighterId }) {
  const [loaded, setLoaded] = useState<FighterId | null>(null);
  return <div className="fighter-preview" data-fighter-ready={loaded === fighterId ? fighterId : 'loading'} aria-hidden="true">{loaded !== fighterId && <span className="fighter-preview-loading">LOADING WRESTLER…</span>}<Canvas camera={{ position: [0, .15, 4.6], fov: 34 }} dpr={[1, 1.5]}>
    <color attach="background" args={['#0b1010']} />
    <ambientLight intensity={.45} />
    <directionalLight position={[2, 4, 4]} intensity={2.5} color="#fff0dd" />
    <directionalLight position={[-3, 2, 2]} intensity={.7} color="#8bd9ff" />
    <directionalLight position={[1, 2, -2]} intensity={3} color="#dce5c9" />
    <Suspense fallback={null}><Portrait key={fighterId} fighterId={fighterId} onReady={setLoaded} /></Suspense>
    <mesh position={[0, -1.16, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.75, 48]} /><meshStandardMaterial color="#202835" roughness={.45} metalness={.4} /></mesh>
  </Canvas></div>;
}
