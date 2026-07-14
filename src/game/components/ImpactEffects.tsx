import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';

interface Burst { id: number; x: number; z: number; color: string; count: number; kind: 'body' | 'mat'; tier: 'light' | 'heavy' | 'major' | 'finisher'; intensity: number; lowFlash: boolean }

export function ImpactEffects() {
  const impact = useMatchStore((state) => state.model.lastImpact);
  const impactId = impact?.id ?? 0;
  const lowFlash = useSettings((state) => state.lowFlash);
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    if (!impact) return;
    const color = impact.kind === 'counter' || impact.kind === 'blocked' ? '#58f5ff' : impact.kind === 'finisher' || impact.kind === 'ko' ? '#fff13b' : impact.kind === 'weapon' ? '#ff4a88' : impact.kind === 'grapple' || impact.kind === 'table' ? '#dcff46' : '#ff8b3d';
    const kind = ['grapple', 'finisher', 'table', 'nearfall', 'ko'].includes(impact.kind) ? 'mat' : 'body';
    const tier = impact.kind === 'finisher' || impact.kind === 'ko' ? 'finisher' : impact.kind === 'grapple' || impact.kind === 'table' ? 'major' : impact.kind === 'heavy' || impact.kind === 'weapon' || impact.kind === 'counter' ? 'heavy' : 'light';
    const baseCount = tier === 'light' ? 4 : tier === 'heavy' ? 8 : tier === 'major' ? 12 : 16;
    const count = Math.min(22, Math.round(baseCount + impact.intensity * 3));
    setBursts((current) => current.some((burst) => burst.id === impact.id) ? current : [...current.slice(-3), { id: impact.id, x: impact.position.x, z: impact.position.z, color, kind, tier, intensity: impact.intensity, lowFlash, count: lowFlash ? Math.max(3, Math.ceil(count * .55)) : count }]);
  }, [impactId, lowFlash]);
  const player = useMatchStore((state) => state.model.player); const opponent = useMatchStore((state) => state.model.opponent);
  return <>{bursts.map((burst) => <BurstView key={burst.id} burst={burst} />)}
    {player.counterWindow > 0 && <CounterCue x={player.position.x} z={player.position.z} />}
    {opponent.counterWindow > 0 && <CounterCue x={opponent.position.x} z={opponent.position.z} hostile />}
    {player.state === 'blocking' && <GuardCue x={player.position.x} z={player.position.z} facing={player.facing} />}
    {opponent.state === 'blocking' && <GuardCue x={opponent.position.x} z={opponent.position.z} facing={opponent.facing} hostile />}
  </>;
}

function CounterCue({ x, z, hostile = false }: { x: number; z: number; hostile?: boolean }) {
  const root = useRef<Group>(null); const age = useRef(0);
  useFrame((_, dt) => { age.current += dt; if (root.current) { const pulse = 1 + Math.sin(age.current * 18) * .13; root.current.scale.set(pulse, pulse, pulse); root.current.rotation.y += dt * 1.8; } });
  const color = hostile ? '#ff4a88' : '#67f7ff';
  return <group ref={root} position={[x, 2.12, z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.72, .045, 6, 24]} /><meshBasicMaterial color={color} transparent opacity={.88} toneMapped={false} depthWrite={false} /></mesh>
    {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => <mesh key={angle} position={[Math.cos(angle) * .72, .08, Math.sin(angle) * .72]} rotation={[0, -angle, Math.PI / 2]}><coneGeometry args={[.1, .28, 4]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>)}
  </group>;
}

function GuardCue({ x, z, facing, hostile = false }: { x: number; z: number; facing: number; hostile?: boolean }) {
  const shield = useRef<Mesh>(null); const age = useRef(0);
  useFrame((_, dt) => { age.current += dt; if (shield.current) shield.current.scale.setScalar(.96 + Math.sin(age.current * 8) * .04); });
  const forwardX = Math.sin(facing); const forwardZ = Math.cos(facing);
  return <mesh ref={shield} position={[x + forwardX * .48, 3.12, z + forwardZ * .48]} rotation={[0, facing, 0]}>
    <circleGeometry args={[.58, 6]} /><meshBasicMaterial color={hostile ? '#ff6a9c' : '#55efff'} transparent opacity={.2} toneMapped={false} depthWrite={false} side={2} />
  </mesh>;
}

function BurstView({ burst }: { burst: Burst }) {
  const root = useRef<Group>(null);
  const materials = useRef<MeshBasicMaterial[]>([]);
  const age = useRef(0);
  const directions = useMemo(() => Array.from({ length: burst.count }, (_, index) => ({
    x: Math.cos((index / burst.count) * Math.PI * 2 + index * .7), y: .3 + (index % 4) * .18, z: Math.sin((index / burst.count) * Math.PI * 2 + index * .7),
  })), [burst.count]);
  useFrame((_, dt) => {
    age.current += dt;
    const expansion = burst.tier === 'light' ? 5.8 : burst.tier === 'heavy' ? 4.2 : 3.2;
    if (root.current) root.current.scale.setScalar(1 + age.current * expansion);
    const fade = burst.tier === 'light' ? 4.6 : burst.tier === 'heavy' ? 3.1 : 2.25;
    for (const material of materials.current) material.opacity = Math.max(0, 1 - age.current * fade);
  });
  const register = (material: MeshBasicMaterial | null): void => { if (material && !materials.current.includes(material)) materials.current.push(material); };
  return <group ref={root} position={[burst.x, burst.kind === 'mat' ? 1.98 : 3.25, burst.z]}>
    {burst.tier !== 'light' && <mesh rotation={burst.kind === 'mat' ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <ringGeometry args={[.18, burst.tier === 'finisher' ? .34 : .26, 24]} /><meshBasicMaterial ref={register} color={burst.color} transparent depthWrite={false} opacity={.9} toneMapped={false} />
    </mesh>}
    <mesh scale={burst.kind === 'mat' ? [1.4, .08, 1.4] : [.7, .7, .18]}>
      <sphereGeometry args={[.19, 8, 6]} /><meshBasicMaterial ref={register} color="#ffffff" transparent depthWrite={false} opacity={burst.lowFlash ? .28 : .8} toneMapped={false} />
    </mesh>
    {(burst.tier === 'major' || burst.tier === 'finisher') && <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1.5, 1.5, 1]}><ringGeometry args={[.26, .32, 28]} /><meshBasicMaterial ref={register} color="#ffffff" transparent depthWrite={false} opacity={.58} toneMapped={false} /></mesh>
      <mesh position={[0, .035, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.2 + burst.intensity * .12, 1.2 + burst.intensity * .12, 1]}><circleGeometry args={[.26, 24]} /><meshBasicMaterial ref={register} color={burst.color} transparent depthWrite={false} opacity={.16} toneMapped={false} /></mesh>
    </>}
    {burst.tier === 'finisher' && !burst.lowFlash && Array.from({ length: 8 }, (_, index) => index / 8 * Math.PI * 2).map((angle) => <mesh key={angle} position={[Math.cos(angle) * .18, .26, Math.sin(angle) * .18]} rotation={[0, -angle, 0]}><boxGeometry args={[.025, .6, .025]} /><meshBasicMaterial ref={register} color={indexColor(angle, burst.color)} transparent depthWrite={false} opacity={.75} toneMapped={false} /></mesh>)}
    {directions.map((direction, index) => <mesh key={index} position={[direction.x * .18, direction.y * .18, direction.z * .18]} rotation={[direction.z, direction.x, direction.y]}>
      <tetrahedronGeometry args={[.08, 0]} /><meshBasicMaterial ref={register} color={burst.color} transparent depthWrite={false} opacity={1} toneMapped={false} />
    </mesh>)}
  </group>;
}

const indexColor = (angle: number, accent: string): string => Math.round(angle * 10) % 2 === 0 ? '#ffffff' : accent;
