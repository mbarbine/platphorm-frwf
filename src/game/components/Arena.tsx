import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { ContactForcePayload, RapierRigidBody } from '@react-three/rapier';
import { RigidBodyType } from '@dimforge/rapier3d-compat';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, Euler, Object3D, Quaternion } from 'three';
import type { Group, InstancedMesh, Mesh, MeshStandardMaterial } from 'three';
import { useMatchStore } from '../state/matchStore';
import { arenaCollisionGroups, propCollisionGroups } from '../physics/collisionGroups';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { FighterKey } from '../physics/physicsRuntime';
import type { BodySegmentId } from '../physics/bodySchema';
import type { PropRuntime } from '../types/game';

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

function RopeSide({ axis, side, color, emissive }: { axis: 'x' | 'z'; side: -1 | 1; color: string; emissive: string }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const model = useMatchStore.getState().model; const overdrive = model.chaosEvent?.type === 'OVERDRIVE ROPES';
    const edge = axis === 'x' ? 5.2 : 3.7; const visualEdge = axis === 'x' ? 5.75 : 4.25;
    const playerEdge = (axis === 'x' ? model.player.position.x : model.player.position.z) * side;
    const opponentEdge = (axis === 'x' ? model.opponent.position.x : model.opponent.position.z) * side;
    const compression = Math.max(0, Math.min(1, (Math.max(playerEdge, opponentEdge) - edge) / .54));
    const rebound = Math.max(playerEdge > edge - .6 ? model.player.ropeRebound : 0, opponentEdge > edge - .6 ? model.opponent.ropeRebound : 0);
    const pulse = Math.sin(clock.elapsedTime * (overdrive ? 26 : 18)) * compression;
    if (axis === 'x') { group.current.position.x = side * (visualEdge + compression * (.035 + pulse * .045)); group.current.scale.z = 1 + compression * .035; }
    else { group.current.position.z = side * (visualEdge + compression * (.035 + pulse * .045)); group.current.scale.x = 1 + compression * .035; }
    group.current.scale.y = 1 + pulse * .035 + rebound * .012;
    for (const child of group.current.children) {
      const mesh = child as Mesh; const material = mesh.material as MeshStandardMaterial;
      material.emissiveIntensity = overdrive ? 2.6 : .78 + compression * 1.2;
    }
  });
  return <group ref={group} position={axis === 'x' ? [side * 5.75, 0, 0] : [0, 0, side * 4.25]}>{[2.5, 3.05, 3.6].map((y) => <mesh key={y} position={[0, y, 0]} castShadow><boxGeometry args={axis === 'x' ? [.07, .07, 8.5] : [11.5, .07, .07]} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={.78} roughness={.3} metalness={.28} /></mesh>)}</group>;
}

function Ropes() {
  return <><RopeSide axis="z" side={-1} color="#5cf8ff" emissive="#39d8ff" /><RopeSide axis="z" side={1} color="#ff4fa3" emissive="#ff298d" /><RopeSide axis="x" side={-1} color="#d9ff47" emissive="#a6ed2f" /><RopeSide axis="x" side={1} color="#ff763b" emissive="#ff4b28" /></>;
}

function Post({ x, z }: { x: number; z: number }) {
  return <RigidBody type="fixed" position={[x, 2.2, z]} colliders={false} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'turnbuckle' }}>
    <CuboidCollider args={[.24, 1.82, .24]} friction={.5} restitution={.08} />
    <CuboidCollider args={[.5, .13, .5]} position={[x > 0 ? -.28 : .28, 1.56, z > 0 ? -.24 : .24]} friction={1.2} restitution={.02} />
    <mesh castShadow><boxGeometry args={[.34, 3.5, .34]} /><meshStandardMaterial color="#161321" metalness={.85} roughness={.2} /></mesh>
    {[.3, .85, 1.4].map((y) => <mesh key={y} position={[x > 0 ? -.22 : .22, y, z > 0 ? -.18 : .18]} castShadow><boxGeometry args={[.58, .31, .34]} /><meshStandardMaterial color="#a34dff" emissive="#6d22df" emissiveIntensity={.9} metalness={.25} roughness={.35} /></mesh>)}
    <mesh position={[0, 1.83, 0]}><octahedronGeometry args={[.25, 0]} /><meshStandardMaterial color="#f2f5ff" emissive={x * z > 0 ? '#ff3c91' : '#42e8ff'} emissiveIntensity={1.8} metalness={.65} roughness={.2} /></mesh>
  </RigidBody>;
}

function Props() {
  const props = useMatchStore((state) => state.model.props);
  const player = useMatchStore((state) => state.model.player);
  const opponent = useMatchStore((state) => state.model.opponent);
  return <>{props.map((prop) => {
    if (prop.broken) return prop.kind === 'table' ? <BrokenTable key={prop.id} x={prop.position.x} z={prop.position.z} /> : null;
    const owner = prop.heldBy === 'player' ? player : prop.heldBy === 'opponent' ? opponent : null;
    const position: [number, number, number] = owner
      ? [owner.position.x + Math.sin(owner.facing) * .65 + Math.cos(owner.facing) * .32, 3.25, owner.position.z + Math.cos(owner.facing) * .65 - Math.sin(owner.facing) * .32]
      : [prop.position.x, prop.kind === 'table' ? .72 : .55, prop.position.z];
    if (prop.kind === 'table') return <RigidBody key={prop.id} type="fixed" position={position} colliders={false} collisionGroups={propCollisionGroups} solverGroups={propCollisionGroups} userData={{ surface: true, prop: prop.id, kind: prop.kind }}><CuboidCollider args={[1.7, .12, .65]} /><CuboidCollider args={[.08, .55, .08]} position={[-1.35, -.58, -.45]} /><CuboidCollider args={[.08, .55, .08]} position={[-1.35, -.58, .45]} /><CuboidCollider args={[.08, .55, .08]} position={[1.35, -.58, -.45]} /><CuboidCollider args={[.08, .55, .08]} position={[1.35, -.58, .45]} /><group>
      <mesh castShadow><boxGeometry args={[3.4, .2, 1.3]} /><meshStandardMaterial color="#2a3140" metalness={.6} roughness={.3} /></mesh>
      {[-1.35, 1.35].flatMap((x) => [-.45, .45].map((z) => <mesh key={`${x}-${z}`} position={[x, -.58, z]}><boxGeometry args={[.12, 1.1, .12]} /><meshStandardMaterial color="#11141b" /></mesh>))}
      <mesh position={[0, .13, 0]}><boxGeometry args={[2.2, .05, .75]} /><meshStandardMaterial color="#27d8ff" emissive="#27d8ff" emissiveIntensity={.8} /></mesh>
    </group></RigidBody>;
    return <PhysicalProp key={prop.id} prop={prop} initialPosition={position} />;
  })}</>;
}

interface FighterColliderData { bodyWorks: true; fighter: FighterKey; segment: BodySegmentId; region: 'head' | 'chest' | 'ribs' | 'pelvis' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' }
const isFighterColliderData = (value: unknown): value is FighterColliderData => typeof value === 'object' && value !== null && 'bodyWorks' in value && 'fighter' in value && 'segment' in value && 'region' in value;

function PhysicalProp({ prop, initialPosition }: { prop: PropRuntime; initialPosition: [number, number, number] }) {
  const body = useRef<RapierRigidBody | null>(null); const previousOwner = useRef<FighterKey | null>(prop.heldBy);
  const rotation = useMemo(() => new Quaternion(), []); const euler = useMemo(() => new Euler(), []);
  useEffect(() => {
    const rigidBody = body.current; if (!rigidBody) return;
    const releasedBy = previousOwner.current;
    rigidBody.setBodyType(prop.heldBy ? RigidBodyType.KinematicPositionBased : RigidBodyType.Dynamic, true);
    if (!prop.heldBy && releasedBy) {
      const fighter = useMatchStore.getState().model[releasedBy]; const speed = prop.kind === 'chair' ? 8.4 : 10.2;
      rigidBody.setLinvel({ x: fighter.velocity.x + Math.sin(fighter.facing) * speed, y: 2.2, z: fighter.velocity.z + Math.cos(fighter.facing) * speed }, true);
      rigidBody.setAngvel({ x: prop.kind === 'chair' ? 5.5 : 2.8, y: 3.2, z: prop.kind === 'chair' ? -4.2 : 6.4 }, true);
    }
    previousOwner.current = prop.heldBy;
  }, [prop.heldBy, prop.kind]);
  useFrame(() => {
    const rigidBody = body.current; if (!rigidBody) return;
    const liveProp = useMatchStore.getState().model.props.find((candidate) => candidate.id === prop.id); const heldBy = liveProp?.heldBy;
    if (heldBy) {
      const fighter = useMatchStore.getState().model[heldBy]; const activeSwing = fighter.moveId === 'prop' && fighter.attackPhase === 'active'; const reach = activeSwing ? 1.22 : .68;
      rigidBody.setNextKinematicTranslation({ x: fighter.position.x + Math.sin(fighter.facing) * reach + Math.cos(fighter.facing) * .3, y: activeSwing ? 3.35 : 3.12, z: fighter.position.z + Math.cos(fighter.facing) * reach - Math.sin(fighter.facing) * .3 });
      euler.set(activeSwing ? -.35 : .08, fighter.facing, activeSwing ? -1.1 : -.32); rotation.setFromEuler(euler); rigidBody.setNextKinematicRotation(rotation);
    } else if (rigidBody.translation().y < -2) {
      rigidBody.setTranslation({ x: liveProp?.position.x ?? initialPosition[0], y: initialPosition[1], z: liveProp?.position.z ?? initialPosition[2] }, true);
      rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true); rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });
  const onContactForce = (payload: ContactForcePayload): void => {
    const liveProp = useMatchStore.getState().model.props.find((candidate) => candidate.id === prop.id); const heldBy = liveProp?.heldBy; if (!heldBy) return;
    const model = useMatchStore.getState().model; const actor = model[heldBy]; const targetData = payload.other.rigidBodyObject?.userData;
    if (!isFighterColliderData(targetData) || targetData.fighter === heldBy || actor.moveId !== 'prop' || actor.attackPhase !== 'active') return;
    const propVelocity = body.current?.linvel() ?? { x: 0, y: 0, z: 0 }; const targetVelocity = payload.other.rigidBody?.linvel() ?? { x: 0, y: 0, z: 0 };
    bodyWorksRuntime.recordContact({ time: model.elapsed, sourceFighter: heldBy, sourceSegment: 'rightHand', targetFighter: targetData.fighter, targetSegment: targetData.segment, targetRegion: targetData.region, totalForce: payload.totalForceMagnitude, maximumForce: payload.maxForceMagnitude, forceDirection: [payload.maxForceDirection.x, payload.maxForceDirection.y, payload.maxForceDirection.z], relativeSpeed: Math.hypot(propVelocity.x - targetVelocity.x, propVelocity.y - targetVelocity.y, propVelocity.z - targetVelocity.z), attackInstanceId: actor.attackInstanceId, moveId: 'prop', targetSurface: null, isLanding: false });
  };
  return <RigidBody ref={body} type="dynamic" position={initialPosition} colliders="cuboid" mass={prop.kind === 'chair' ? 3.4 : .75} linearDamping={1.15} angularDamping={1.05} restitution={prop.kind === 'chair' ? .2 : .34} collisionGroups={propCollisionGroups} solverGroups={propCollisionGroups} userData={{ surface: true, prop: prop.id, kind: prop.kind }} onContactForce={onContactForce}>
    {prop.kind === 'chair' ? <group><mesh><boxGeometry args={[.9, .12, .85]} /><meshStandardMaterial color="#9099aa" metalness={.82} roughness={.2} /></mesh><mesh position={[0, .7, .36]}><boxGeometry args={[.9, 1.2, .12]} /><meshStandardMaterial color="#4cdcff" emissive="#157c8c" emissiveIntensity={.4} /></mesh></group>
      : <group rotation={[0, 0, .1]}><mesh><boxGeometry args={[1.35, .85, .1]} /><meshStandardMaterial color="#ff3c91" emissive="#951654" emissiveIntensity={.4} /></mesh><mesh position={[0, -.82, 0]}><boxGeometry args={[.08, .85, .08]} /><meshStandardMaterial color="#d8e3eb" /></mesh></group>}
  </RigidBody>;
}

function BrokenTable({ x, z }: { x: number; z: number }) {
  const fragments: { offset: [number, number]; velocity: [number, number, number]; spin: [number, number, number] }[] = [
    { offset: [-.9, .36], velocity: [-2.4, 3.2, 1.4], spin: [1.8, -.8, 2.4] },
    { offset: [.9, .36], velocity: [2.4, 3.5, 1.2], spin: [-1.4, .9, -2.1] },
    { offset: [-.9, -.36], velocity: [-2.1, 2.8, -1.6], spin: [-1.2, -1.1, 2] },
    { offset: [.9, -.36], velocity: [2.1, 3, -1.5], spin: [1.4, 1, -2.3] },
  ];
  return <>{fragments.map((fragment, index) => <RigidBody key={index} type="dynamic" position={[x + fragment.offset[0], 1.05, z + fragment.offset[1]]} colliders="cuboid" mass={2.1} linearVelocity={fragment.velocity} angularVelocity={fragment.spin} linearDamping={.7} angularDamping={.9} collisionGroups={propCollisionGroups} solverGroups={propCollisionGroups} userData={{ surface: true, kind: 'broken-table' }}>
    <mesh castShadow><boxGeometry args={[1.55, .14, .56]} /><meshStandardMaterial color={index % 2 === 0 ? '#30394a' : '#202736'} metalness={.55} roughness={.38} emissive="#15a9c8" emissiveIntensity={.18} /></mesh>
  </RigidBody>)}</>;
}

export function Arena() {
  const spotlight = useMatchStore((state) => state.model.chaosEvent?.type === 'SPOTLIGHT SHOWDOWN');
  return <>
    <color attach="background" args={[spotlight ? '#020106' : '#070611']} />
    <fog attach="fog" args={[new Color('#090715'), 15, 30]} />
    <ambientLight intensity={spotlight ? .12 : .45} color="#786dff" />
    <hemisphereLight intensity={spotlight ? .15 : .62} color="#9aefff" groundColor="#160721" />
    <directionalLight castShadow position={[4, 12, 6]} intensity={spotlight ? .35 : 2.2} color="#f0f6ff" shadow-mapSize={[1024, 1024]} />
    <spotLight position={[-7, 11, -5]} intensity={spotlight ? 8 : 3} color="#4be7ff" angle={.42} penumbra={.65} castShadow />
    <spotLight position={[7, 10, 4]} intensity={spotlight ? 8 : 3} color="#ff3a95" angle={.42} penumbra={.7} />
    <RigidBody type="fixed" colliders="cuboid" position={[0, 1.52, 0]} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'ring' }}><mesh receiveShadow><boxGeometry args={[12, .65, 9]} /><meshStandardMaterial color="#202437" roughness={.68} /></mesh></RigidBody>
    <mesh position={[0, 1.86, 0]} receiveShadow><boxGeometry args={[11.3, .08, 8.3]} /><meshStandardMaterial color="#e9ebf4" emissive="#1a0e32" emissiveIntensity={.08} roughness={.72} /></mesh>
    <group position={[0, 1.915, 0]}>
      <mesh position={[0, 0, -3.78]}><boxGeometry args={[10.7, .025, .045]} /><meshStandardMaterial color="#48e7ff" emissive="#48e7ff" emissiveIntensity={1.25} /></mesh><mesh position={[0, 0, 3.78]}><boxGeometry args={[10.7, .025, .045]} /><meshStandardMaterial color="#ff3f8f" emissive="#ff3f8f" emissiveIntensity={1.25} /></mesh>
      <mesh position={[-5.12, 0, 0]}><boxGeometry args={[.045, .025, 7.55]} /><meshStandardMaterial color="#dcff46" emissive="#a8dc2c" emissiveIntensity={1.1} /></mesh><mesh position={[5.12, 0, 0]}><boxGeometry args={[.045, .025, 7.55]} /><meshStandardMaterial color="#ff6e32" emissive="#ff4c2b" emissiveIntensity={1.1} /></mesh>
    </group>
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
    <RigidBody type="fixed" colliders="hull" position={[0, .2, 0]} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'floor' }}><mesh receiveShadow><cylinderGeometry args={[15, 15, .4, 48]} /><meshStandardMaterial color="#100d1c" roughness={.8} /></mesh></RigidBody>
    <Crowd /><Props />
    <group position={[0, 13, 0]}>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => <group key={angle} rotation={[0, angle, 0]}>
        <mesh position={[0, -.65, -7.75]} rotation={[.15, 0, 0]}><cylinderGeometry args={[.18, .36, .65, 10]} /><meshStandardMaterial color="#8eeeff" emissive="#41dcff" emissiveIntensity={2.4} /></mesh>
        <spotLight position={[0, -.8, -7.65]} intensity={4} color={angle % Math.PI === 0 ? '#4be7ff' : '#ff3a95'} angle={.3} penumbra={.8} />
      </group>)}
    </group>
    <group position={[0, 8.7, 0]}>{[-7.2, 7.2].flatMap((x) => [-5.8, 5.8].map((z) => <group key={`${x}-${z}`} position={[x, 0, z]}><mesh><cylinderGeometry args={[.13, .2, .44, 8]} /><meshStandardMaterial color="#adb8c7" metalness={.8} roughness={.2} /></mesh><pointLight position={[0, -.3, 0]} intensity={1.25} distance={10} color={x * z > 0 ? '#ff3f8f' : '#48e7ff'} /></group>))}</group>
    <group position={[0, 4, 12]}><mesh><boxGeometry args={[5.8, 2.5, .4]} /><meshStandardMaterial color="#121323" emissive="#22175d" emissiveIntensity={.5} /></mesh><mesh position={[0, .2, -.24]}><boxGeometry args={[4.8, .18, .04]} /><meshStandardMaterial color="#ff397f" emissive="#ff397f" emissiveIntensity={2} /></mesh><mesh position={[0, -.35, -.24]}><boxGeometry args={[3.2, .12, .04]} /><meshStandardMaterial color="#48e9ff" emissive="#48e9ff" emissiveIntensity={2} /></mesh></group>
    <group position={[0, 1.5, 15]}><mesh><boxGeometry args={[6, 3.8, 1]} /><meshStandardMaterial color="#0c0b17" /></mesh>{[-2, -1, 0, 1, 2].map((x) => <mesh key={x} position={[x, .1, -.55]}><boxGeometry args={[.3, 2.8, .08]} /><meshStandardMaterial color="#7b37ff" emissive="#7b37ff" emissiveIntensity={1.5} /></mesh>)}</group>
    <mesh position={[0, .52, 10.3]} rotation={[-.045, 0, 0]} receiveShadow><boxGeometry args={[5.6, .22, 9.5]} /><meshStandardMaterial color="#171424" metalness={.45} roughness={.5} emissive="#32136f" emissiveIntensity={.12} /></mesh>
    <group position={[-8, .6, -5]}><mesh><boxGeometry args={[4.2, 1.1, .18]} /><meshStandardMaterial color="#272334" /></mesh></group>
    <group position={[8, .6, 4]}><mesh><boxGeometry args={[4.2, 1.1, .18]} /><meshStandardMaterial color="#272334" /></mesh></group>
    <mesh position={[5.3, 2.3, -5.3]}><cylinderGeometry args={[.22, .3, .26, 16]} /><meshStandardMaterial color="#d7a940" metalness={.8} roughness={.22} /></mesh>
  </>;
}
