import { Canvas } from '@react-three/fiber';
import type { FighterId } from '../game/types/game';
import { FighterModel } from '../game/components/FighterModel';

export function FighterPreview({ fighterId }: { fighterId: FighterId }) {
  return <div className="fighter-preview" aria-hidden="true"><Canvas camera={{ position: [0, .8, 9], fov: 36 }} dpr={[.75, 1.25]}>
    <color attach="background" args={['#090712']} /><ambientLight intensity={1.2} /><spotLight position={[3, 8, 5]} intensity={12} color="#ffffff" angle={.45} /><spotLight position={[-4, 4, 2]} intensity={8} color="#7f3dff" angle={.5} />
    <group position={[0, -.7, 0]} rotation={[0, Math.PI, 0]}><FighterModel fighterId={fighterId} preview /></group>
    <mesh position={[0, -1.9, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.1, 32]} /><meshStandardMaterial color="#1e1732" emissive="#702eff" emissiveIntensity={.5} /></mesh>
  </Canvas></div>;
}
