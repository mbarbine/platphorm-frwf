import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, Object3D } from 'three';
import type { Group, InstancedMesh, Mesh, MeshStandardMaterial } from 'three';
import { useMatchStore } from '../state/matchStore';

function Crowd() {
  const ref = useRef<InstancedMesh>(null); const dummy = useMemo(() => new Object3D(), []); const count = 180;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const hype = useMatchStore.getState().model.hype;
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / 36); const col = index % 36; const angle = (col / 36) * Math.PI * 2;
      const radius = 9.5 + row * 1.25; const bounce = Math.sin(clock.elapsedTime * (2 + hype / 30) + index * .71) * (.04 + hype / 700);
      dummy.position.set(Math.cos(angle) * radius, 1.3 + row * .55 + bounce, Math.sin(angle) * radius);
      dummy.rotation.y = -angle + Math.PI / 2; dummy.scale.set(.42, .7 + (index % 3) * .12, .32); dummy.updateMatrix(); ref.current.setMatrixAt(index, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow={false} receiveShadow={false}>
    <boxGeometry args={[.7, 1.6, .5]} /><meshStandardMaterial color="#342d5a" emissive="#6b42c9" emissiveIntensity={.13} roughness={.75} />
  </instancedMesh>;
}

function Ropes() {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const model = useMatchStore.getState().model; const overdrive = model.chaosEvent?.type === 'OVERDRIVE ROPES';
    const contactX = Math.max(Math.abs(model.player.position.x) / 5.65, Math.abs(model.opponent.position.x) / 5.65);
    const contactZ = Math.max(Math.abs(model.player.position.z) / 4.15, Math.abs(model.opponent.position.z) / 4.15);
    const contact = Math.max(contactX, contactZ); const pulse = Math.sin(clock.elapsedTime * (overdrive ? 25 : 19));
    group.current.scale.y = 1 + Math.max(0, contact - .86) * pulse * .07;
    group.current.scale.x = 1 + Math.max(0, contactZ - .84) * pulse * .018;
    group.current.scale.z = 1 + Math.max(0, contactX - .84) * pulse * .025;
    for (const child of group.current.children) {
      const mesh = child as Mesh; const material = mesh.material as MeshStandardMaterial;
      material.emissiveIntensity = overdrive ? 2.2 : .7;
    }
  });
  const ropes: React.ReactNode[] = [];
  for (const y of [2.5, 3.05, 3.6]) {
    ropes.push(<mesh key={`n-${y}`} position={[0, y, -4.25]}><boxGeometry args={[11.5, .055, .055]} /><meshStandardMaterial color="#5cf8ff" emissive="#39d8ff" emissiveIntensity={.7} /></mesh>);
    ropes.push(<mesh key={`s-${y}`} position={[0, y, 4.25]}><boxGeometry args={[11.5, .055, .055]} /><meshStandardMaterial color="#ff4fa3" emissive="#ff298d" emissiveIntensity={.7} /></mesh>);
    ropes.push(<mesh key={`w-${y}`} position={[-5.75, y, 0]}><boxGeometry args={[.055, .055, 8.5]} /><meshStandardMaterial color="#d9ff47" emissive="#a6ed2f" emissiveIntensity={.7} /></mesh>);
    ropes.push(<mesh key={`e-${y}`} position={[5.75, y, 0]}><boxGeometry args={[.055, .055, 8.5]} /><meshStandardMaterial color="#ff763b" emissive="#ff4b28" emissiveIntensity={.7} /></mesh>);
  }
  return <group ref={group}>{ropes}</group>;
}

function Post({ x, z }: { x: number; z: number }) {
  return <group position={[x, 2.2, z]}>
    <mesh castShadow><boxGeometry args={[.34, 3.5, .34]} /><meshStandardMaterial color="#161321" metalness={.85} roughness={.2} /></mesh>
    {[.3, .85, 1.4].map((y) => <mesh key={y} position={[x > 0 ? -.22 : .22, y, z > 0 ? -.18 : .18]}><boxGeometry args={[.52, .28, .28]} /><meshStandardMaterial color="#8c38ff" emissive="#5220c7" emissiveIntensity={.5} /></mesh>)}
  </group>;
}

function Props() {
  const props = useMatchStore((state) => state.model.props);
  const player = useMatchStore((state) => state.model.player);
  const opponent = useMatchStore((state) => state.model.opponent);
  return <>{props.filter((prop) => !prop.broken).map((prop) => {
    const owner = prop.heldBy === 'player' ? player : prop.heldBy === 'opponent' ? opponent : null;
    const position: [number, number, number] = owner ? [owner.position.x + .5, 2.4, owner.position.z] : [prop.position.x, prop.kind === 'table' ? .72 : .55, prop.position.z];
    if (prop.kind === 'table') return <RigidBody key={prop.id} type="fixed" position={position} colliders={false}><CuboidCollider args={[1.7, .55, .65]} /><group>
      <mesh castShadow><boxGeometry args={[3.4, .2, 1.3]} /><meshStandardMaterial color="#2a3140" metalness={.6} roughness={.3} /></mesh>
      {[-1.35, 1.35].flatMap((x) => [-.45, .45].map((z) => <mesh key={`${x}-${z}`} position={[x, -.58, z]}><boxGeometry args={[.12, 1.1, .12]} /><meshStandardMaterial color="#11141b" /></mesh>))}
      <mesh position={[0, .13, 0]}><boxGeometry args={[2.2, .05, .75]} /><meshStandardMaterial color="#27d8ff" emissive="#27d8ff" emissiveIntensity={.8} /></mesh>
    </group></RigidBody>;
    if (prop.kind === 'chair') return <RigidBody key={prop.id} type={owner ? 'kinematicPosition' : 'dynamic'} position={position} colliders="cuboid" mass={1.8} linearDamping={3} angularDamping={3} restitution={.24}><group rotation={[0, 0, owner ? -.35 : 0]}>
      <mesh><boxGeometry args={[.9, .12, .85]} /><meshStandardMaterial color="#9099aa" metalness={.82} roughness={.2} /></mesh>
      <mesh position={[0, .7, .36]}><boxGeometry args={[.9, 1.2, .12]} /><meshStandardMaterial color="#4cdcff" emissive="#157c8c" emissiveIntensity={.4} /></mesh>
    </group></RigidBody>;
    return <RigidBody key={prop.id} type={owner ? 'kinematicPosition' : 'dynamic'} position={position} colliders="cuboid" mass={.55} linearDamping={2.5} angularDamping={2.5} restitution={.38}><group rotation={[0, 0, owner ? -.4 : .1]}><mesh><boxGeometry args={[1.35, .85, .1]} /><meshStandardMaterial color="#ff3c91" emissive="#951654" emissiveIntensity={.4} /></mesh><mesh position={[0, -.82, 0]}><boxGeometry args={[.08, .85, .08]} /><meshStandardMaterial color="#d8e3eb" /></mesh></group></RigidBody>;
  })}</>;
}

export function Arena() {
  const spotlight = useMatchStore((state) => state.model.chaosEvent?.type === 'SPOTLIGHT SHOWDOWN');
  return <>
    <color attach="background" args={[spotlight ? '#020106' : '#070611']} />
    <fog attach="fog" args={[new Color('#090715'), 15, 30]} />
    <ambientLight intensity={spotlight ? .12 : .45} color="#786dff" />
    <directionalLight castShadow position={[4, 12, 6]} intensity={spotlight ? .35 : 2.2} color="#f0f6ff" shadow-mapSize={[1024, 1024]} />
    <spotLight position={[-7, 11, -5]} intensity={spotlight ? 8 : 3} color="#4be7ff" angle={.42} penumbra={.65} castShadow />
    <spotLight position={[7, 10, 4]} intensity={spotlight ? 8 : 3} color="#ff3a95" angle={.42} penumbra={.7} />
    <RigidBody type="fixed" colliders="cuboid" position={[0, 1.52, 0]}><mesh receiveShadow><boxGeometry args={[12, .65, 9]} /><meshStandardMaterial color="#202437" roughness={.68} /></mesh></RigidBody>
    <mesh position={[0, 1.86, 0]} receiveShadow><boxGeometry args={[11.3, .08, 8.3]} /><meshStandardMaterial color="#dde2ec" roughness={.8} /></mesh>
    <mesh position={[0, 1.89, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[2.1, .06, 8, 48]} /><meshStandardMaterial color="#662bff" emissive="#662bff" emissiveIntensity={1.2} /></mesh>
    <mesh position={[0, 1.9, 0]} rotation={[-Math.PI / 2, 0, -.18]}><boxGeometry args={[3.1, .12, .025]} /><meshStandardMaterial color="#ff3d93" emissive="#ff3d93" emissiveIntensity={1} /></mesh>
    <group>
      <mesh position={[0, 1.46, -4.55]}><boxGeometry args={[11.7, .78, .18]} /><meshStandardMaterial color="#11101c" metalness={.35} roughness={.44} /></mesh>
      <mesh position={[0, 1.46, 4.55]}><boxGeometry args={[11.7, .78, .18]} /><meshStandardMaterial color="#11101c" metalness={.35} roughness={.44} /></mesh>
      <mesh position={[-6.15, 1.46, 0]}><boxGeometry args={[.18, .78, 8.8]} /><meshStandardMaterial color="#11101c" metalness={.35} roughness={.44} /></mesh>
      <mesh position={[6.15, 1.46, 0]}><boxGeometry args={[.18, .78, 8.8]} /><meshStandardMaterial color="#11101c" metalness={.35} roughness={.44} /></mesh>
      <mesh position={[0, 1.48, -4.66]}><boxGeometry args={[5.4, .2, .03]} /><meshStandardMaterial color="#6a35ff" emissive="#6a35ff" emissiveIntensity={1.7} /></mesh>
      <mesh position={[0, 1.48, 4.66]}><boxGeometry args={[5.4, .2, .03]} /><meshStandardMaterial color="#ff388b" emissive="#ff388b" emissiveIntensity={1.7} /></mesh>
    </group>
    <Ropes /><Post x={-5.75} z={-4.25} /><Post x={5.75} z={-4.25} /><Post x={-5.75} z={4.25} /><Post x={5.75} z={4.25} />
    <group position={[6.65, .36, 4.65]}>{[0, .28, .56].map((y, index) => <mesh key={y} position={[index * .18, y, 0]}><boxGeometry args={[1.15 - index * .12, .22, 1.2]} /><meshStandardMaterial color="#394151" metalness={.75} roughness={.24} /></mesh>)}</group>
    <RigidBody type="fixed" colliders="hull" position={[0, .2, 0]}><mesh receiveShadow><cylinderGeometry args={[15, 15, .4, 48]} /><meshStandardMaterial color="#100d1c" roughness={.8} /></mesh></RigidBody>
    <Crowd /><Props />
    <group position={[0, 9.8, 0]}>
      <mesh><torusGeometry args={[7.8, .13, 6, 48]} /><meshStandardMaterial color="#242638" metalness={.9} roughness={.18} /></mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => <group key={angle} rotation={[0, angle, 0]}>
        <mesh position={[0, -.65, -7.75]} rotation={[.15, 0, 0]}><cylinderGeometry args={[.18, .36, .65, 10]} /><meshStandardMaterial color="#8eeeff" emissive="#41dcff" emissiveIntensity={2.4} /></mesh>
        <spotLight position={[0, -.8, -7.65]} intensity={4} color={angle % Math.PI === 0 ? '#4be7ff' : '#ff3a95'} angle={.3} penumbra={.8} />
      </group>)}
    </group>
    <group position={[0, 4, 12]}><mesh><boxGeometry args={[5.8, 2.5, .4]} /><meshStandardMaterial color="#121323" emissive="#22175d" emissiveIntensity={.5} /></mesh><mesh position={[0, .2, -.24]}><boxGeometry args={[4.8, .18, .04]} /><meshStandardMaterial color="#ff397f" emissive="#ff397f" emissiveIntensity={2} /></mesh><mesh position={[0, -.35, -.24]}><boxGeometry args={[3.2, .12, .04]} /><meshStandardMaterial color="#48e9ff" emissive="#48e9ff" emissiveIntensity={2} /></mesh></group>
    <group position={[0, 1.5, 15]}><mesh><boxGeometry args={[6, 3.8, 1]} /><meshStandardMaterial color="#0c0b17" /></mesh>{[-2, -1, 0, 1, 2].map((x) => <mesh key={x} position={[x, .1, -.55]}><boxGeometry args={[.3, 2.8, .08]} /><meshStandardMaterial color="#7b37ff" emissive="#7b37ff" emissiveIntensity={1.5} /></mesh>)}</group>
    <mesh position={[0, .52, 10.3]} rotation={[-.045, 0, 0]} receiveShadow><boxGeometry args={[5.6, .22, 9.5]} /><meshStandardMaterial color="#171424" metalness={.45} roughness={.5} emissive="#32136f" emissiveIntensity={.12} /></mesh>
    <group position={[-8, .6, -5]}><mesh><boxGeometry args={[4.2, 1.1, .18]} /><meshStandardMaterial color="#272334" /></mesh></group>
    <group position={[8, .6, 4]}><mesh><boxGeometry args={[4.2, 1.1, .18]} /><meshStandardMaterial color="#272334" /></mesh></group>
    <mesh position={[5.3, 2.3, -5.3]}><cylinderGeometry args={[.22, .3, .26, 16]} /><meshStandardMaterial color="#d7a940" metalness={.8} roughness={.22} /></mesh>
  </>;
}
