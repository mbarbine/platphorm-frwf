import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group, MeshBasicMaterial } from 'three';
import { useMatchStore } from '../state/matchStore';

interface Burst { id: number; x: number; z: number; color: string; count: number; kind: 'body' | 'mat' }

export function ImpactEffects() {
  const impact = useMatchStore((state) => state.model.lastImpact);
  const impactId = impact?.id ?? 0;
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    if (!impact) return;
    const color = impact.kind === 'counter' || impact.kind === 'blocked' ? '#58f5ff' : impact.kind === 'finisher' || impact.kind === 'ko' ? '#fff13b' : impact.kind === 'weapon' ? '#ff4a88' : impact.kind === 'grapple' || impact.kind === 'table' ? '#dcff46' : '#ff8b3d';
    const kind = ['grapple', 'finisher', 'table', 'nearfall', 'ko'].includes(impact.kind) ? 'mat' : 'body';
    setBursts((current) => current.some((burst) => burst.id === impact.id) ? current : [...current.slice(-3), { id: impact.id, x: impact.position.x, z: impact.position.z, color, kind, count: Math.min(18, Math.round(7 + impact.intensity * 4)) }]);
  }, [impactId]);
  return <>{bursts.map((burst) => <BurstView key={burst.id} burst={burst} />)}</>;
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
    if (root.current) root.current.scale.setScalar(1 + age.current * 4);
    for (const material of materials.current) material.opacity = Math.max(0, 1 - age.current * 1.8);
  });
  const register = (material: MeshBasicMaterial | null): void => { if (material && !materials.current.includes(material)) materials.current.push(material); };
  return <group ref={root} position={[burst.x, burst.kind === 'mat' ? 1.98 : 3.25, burst.z]}>
    <mesh rotation={burst.kind === 'mat' ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <ringGeometry args={[.18, .26, 20]} /><meshBasicMaterial ref={register} color={burst.color} transparent depthWrite={false} opacity={.9} toneMapped={false} />
    </mesh>
    <mesh scale={burst.kind === 'mat' ? [1.4, .08, 1.4] : [.7, .7, .18]}>
      <sphereGeometry args={[.19, 8, 6]} /><meshBasicMaterial ref={register} color="#ffffff" transparent depthWrite={false} opacity={.8} toneMapped={false} />
    </mesh>
    {directions.map((direction, index) => <mesh key={index} position={[direction.x * .18, direction.y * .18, direction.z * .18]} rotation={[direction.z, direction.x, direction.y]}>
      <tetrahedronGeometry args={[.08, 0]} /><meshBasicMaterial ref={register} color={burst.color} transparent depthWrite={false} opacity={1} toneMapped={false} />
    </mesh>)}
  </group>;
}
