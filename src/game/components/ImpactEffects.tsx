import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import { useMatchStore } from '../state/matchStore';

interface Burst { id: number; x: number; z: number; age: number; color: string; count: number }

export function ImpactEffects() {
  const impact = useMatchStore((state) => state.model.lastImpact);
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    if (!impact) return;
    const color = impact.kind === 'counter' ? '#58f5ff' : impact.kind === 'finisher' || impact.kind === 'ko' ? '#fff13b' : impact.kind === 'weapon' ? '#ff4a88' : '#ff8b3d';
    setBursts((current) => [...current.slice(-3), { id: impact.id, x: impact.position.x, z: impact.position.z, age: 0, color, count: Math.min(16, Math.round(7 + impact.intensity * 4)) }]);
  }, [impact]);
  useFrame((_, dt) => setBursts((current) => current.map((burst) => ({ ...burst, age: burst.age + dt })).filter((burst) => burst.age < .55)));
  return <>{bursts.map((burst) => <BurstView key={burst.id} burst={burst} />)}</>;
}

function BurstView({ burst }: { burst: Burst }) {
  const root = useRef<Group>(null);
  const directions = useMemo(() => Array.from({ length: burst.count }, (_, index) => ({
    x: Math.cos((index / burst.count) * Math.PI * 2 + index * .7), y: .3 + (index % 4) * .18, z: Math.sin((index / burst.count) * Math.PI * 2 + index * .7),
  })), [burst.count]);
  useFrame(() => { if (root.current) root.current.scale.setScalar(1 + burst.age * 4); });
  return <group ref={root} position={[burst.x, 2.3, burst.z]}>{directions.map((direction, index) => <mesh key={index} position={[direction.x * .18, direction.y * .18, direction.z * .18]} rotation={[direction.z, direction.x, direction.y]}>
    <tetrahedronGeometry args={[.08, 0]} /><meshBasicMaterial color={burst.color} transparent opacity={Math.max(0, 1 - burst.age * 1.8)} toneMapped={false} />
  </mesh>)}</group>;
}
