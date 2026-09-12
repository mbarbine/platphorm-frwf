import { useState } from 'react';
import { WorldSign } from './ShowgroundEnvironment';
export const LAWNMOWER_ACTIVITY = { position: { x: 4, z: 15 }, url: 'https://lawnmower.platphormnews.com', radius: 2.6 } as const;
export const nearLawnmower = (p: { x: number; z: number }) => (p.x - 4) ** 2 + (p.z - 15) ** 2 <= LAWNMOWER_ACTIVITY.radius ** 2;
/** One original low-poly push mower, built from reusable primitive geometry. */
export function PushMower() {
  return <group position={[4, 0, 15]}>
    <mesh position={[0, .3, 0]} castShadow><boxGeometry args={[.72, .2, 1]} /><meshStandardMaterial color="#c33c2d" roughness={.65} /></mesh>
    <mesh position={[0, .52, -.06]} castShadow><cylinderGeometry args={[.23, .25, .3, 12]} /><meshStandardMaterial color="#272b2b" /></mesh>
    {[-.4, .4].flatMap(x => [-.32, .35].map(z => <mesh key={`${x}:${z}`} position={[x, .23, z]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[.21, .21, .12, 12]} /><meshStandardMaterial color="#151819" roughness={.95} /></mesh>))}
    {[-.3, .3].map(x => <mesh key={x} position={[x, .82, .82]} rotation={[.65, 0, 0]} castShadow><boxGeometry args={[.045, 1.3, .045]} /><meshStandardMaterial color="#999f9b" metalness={.7} roughness={.3} /></mesh>)}
    <mesh position={[0, 1.34, 1.2]}><boxGeometry args={[.66, .075, .075]} /><meshStandardMaterial color="#1b1e1c" /></mesh>
    <WorldSign text="MOW THE GROUNDS" position={[0, 1.9, -.7]} width={3.2} />
  </group>;
}
export function LawnmowerGame({ onClose }: { onClose: () => void }) {
  const [started, setStarted] = useState(false);
  return <div className="world-modal" role="dialog" aria-modal="true" aria-label="Lawnmower subgame"><article style={{ width: 'min(1300px, 96vw)', maxWidth: '96vw' }}>
    <button className="button button--quiet" onClick={onClose}>RETURN TO FRWF</button><h2>Mow the grounds</h2>
    <p>Your FRWF position is saved. Lawnmower runs its own game and progress.</p>
    {!started ? <button className="button button--hero" onClick={() => setStarted(true)}>PLAY LAWNMOWER HERE</button> : <iframe title="Lawnmower game" src={LAWNMOWER_ACTIVITY.url} style={{ width: '100%', height: '65vh', border: 0 }} allow="fullscreen; gamepad" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
    <p><a href={LAWNMOWER_ACTIVITY.url} target="_blank" rel="noopener noreferrer">Open Lawnmower in its own tab</a> if the embedded game cannot load or capture controls.</p>
  </article></div>;
}
