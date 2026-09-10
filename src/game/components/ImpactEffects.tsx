import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Object3D, type InstancedMesh, type Mesh, type MeshBasicMaterial } from 'three';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';
import { venueFor } from '../data/venues';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { impactPresentation, type ImpactPresentation } from '../presentation/impactPresentation';

interface Burst { id: number; presentation: ImpactPresentation }

export function ImpactEffects() {
  const impact = useMatchStore(state => state.model.lastImpact);
  const lowFlash = useSettings(state => state.lowFlash);
  const reducedMotion = useSettings(state => state.reducedMotion);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const seen = useRef(0);
  useEffect(() => {
    if (!impact) { seen.current = 0; setBursts([]); return; }
    if (seen.current === impact.id) return;
    seen.current = impact.id;
    const model = useMatchStore.getState().model;
    const profile = venueFor(model);
    const ringside = profile.hasRing && (Math.abs(impact.position.x) > 5.82 || Math.abs(impact.position.z) > 4.32);
    const presentation = impactPresentation(impact, ringside ? .4 : profile.floorY, reducedMotion, lowFlash);
    setBursts(current => [...current.slice(-5), { id: impact.id, presentation }]);
  }, [impact, lowFlash, reducedMotion]);
  const expire = useCallback((id: number) => setBursts(current => current.filter(burst => burst.id !== id)), []);
  const player = useMatchStore(state => state.model.player);
  const opponent = useMatchStore(state => state.model.opponent);
  return <>
    {bursts.map(burst => <ContactBurst key={burst.id} burst={burst} expire={expire} reducedMotion={reducedMotion} lowFlash={lowFlash} />)}
    {player.counterWindow > 0 && <DefenseCue fighter="player" counter reducedMotion={reducedMotion} />}
    {opponent.counterWindow > 0 && <DefenseCue fighter="opponent" counter reducedMotion={reducedMotion} />}
    {player.state === 'blocking' && <DefenseCue fighter="player" reducedMotion={reducedMotion} />}
    {opponent.state === 'blocking' && <DefenseCue fighter="opponent" reducedMotion={reducedMotion} />}
  </>;
}

function ContactBurst({ burst, expire, reducedMotion, lowFlash }: { burst: Burst; expire: (id: number) => void; reducedMotion: boolean; lowFlash: boolean }) {
  const particles = useRef<InstancedMesh>(null); const ring = useRef<Mesh>(null);
  const age = useRef(0); const expired = useRef(false);
  const dummy = useMemo(() => new Object3D(), []); const p = burst.presentation;
  useFrame(({ camera }, dt) => {
    if (useMatchStore.getState().model.paused || expired.current) return;
    age.current += Math.min(dt, .05);
    const progress = Math.min(1, age.current / p.duration);
    if (progress >= 1) { expired.current = true; expire(burst.id); return; }
    if (ring.current) {
      if (!p.ground) ring.current.quaternion.copy(camera.quaternion);
      ring.current.scale.setScalar(reducedMotion ? 1 : 1 + progress * (p.ground ? 2.5 : 1));
      (ring.current.material as MeshBasicMaterial).opacity = (1 - progress) * (lowFlash ? .16 : .38);
    }
    if (!particles.current) return;
    for (let i = 0; i < p.particles; i++) {
      const angle = i * 2.39996 + burst.id; const speed = .8 + (i % 5) * .22;
      const travel = reducedMotion ? 0 : age.current * speed;
      dummy.position.set(Math.cos(angle) * travel, Math.max(-.04, travel * (.5 + (i % 3) * .2) - 2.6 * age.current ** 2), Math.sin(angle) * travel);
      dummy.rotation.set(0, angle, 0); dummy.scale.setScalar((p.ground ? .032 : .018) * (1 - progress));
      dummy.updateMatrix(); particles.current.setMatrixAt(i, dummy.matrix);
    }
    particles.current.instanceMatrix.needsUpdate = true;
    (particles.current.material as MeshBasicMaterial).opacity = (1 - progress) * .65;
  });
  return <group position={p.position}>
    <mesh ref={ring} rotation={p.ground ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <ringGeometry args={[p.radius * .8, p.radius, 24]} /><meshBasicMaterial color={p.color} transparent opacity={.35} depthWrite={false} side={2} />
    </mesh>
    {p.particles > 0 && <instancedMesh ref={particles} args={[undefined, undefined, p.particles]} frustumCulled={false}>
      <sphereGeometry args={[1, 5, 4]} /><meshBasicMaterial color={p.color} transparent opacity={0} depthWrite={false} />
    </instancedMesh>}
  </group>;
}

function DefenseCue({ fighter, counter = false, reducedMotion }: { fighter: 'player' | 'opponent'; counter?: boolean; reducedMotion: boolean }) {
  const ref = useRef<Mesh>(null); const age = useRef(0);
  useFrame((_, dt) => {
    const body = bodyWorksRuntime.segmentSnapshot(fighter, counter ? 'pelvis' : 'chest');
    if (!ref.current || !body) return;
    const model = useMatchStore.getState().model; const actor = model[fighter];
    if (!model.paused) age.current += dt;
    ref.current.position.copy(body.position);
    if (counter) { ref.current.position.y += .3; ref.current.rotation.set(0, actor.facing, 0); }
    else { ref.current.position.x += Math.sin(actor.facing) * .38; ref.current.position.z += Math.cos(actor.facing) * .38; ref.current.rotation.set(0, actor.facing, 0); }
    ref.current.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(age.current * 9) * .035);
  });
  return <mesh ref={ref}>
    <ringGeometry args={counter ? [.34, .39, 4] : [.34, .36, 32, 1, .3, Math.PI * .8]} />
    <meshBasicMaterial color={fighter === 'player' ? '#68e2ed' : '#f2a273'} transparent opacity={counter ? .72 : .35} depthWrite={false} side={2} />
  </mesh>;
}
