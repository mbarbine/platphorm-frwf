import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, Object3D, Color } from 'three';
import { useFrame } from '@react-three/fiber';
import type { InstancedMesh } from 'three';
import { VENUES, type CombatVenue } from '../data/venues';
import { useMatchStore } from '../state/matchStore';
import { arenaCollisionGroups, propCollisionGroups } from '../physics/collisionGroups';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { PropRuntime } from '../types/game';
import { PhysicalProp } from '../components/Arena';
import { VenueAsset } from '../components/VenueAsset';
import { WorldSign } from './ShowgroundEnvironment';

function Block({ at, size, color, metal = 0 }: { at: [number, number, number]; size: [number, number, number]; color: string; metal?: number }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.85} metalness={metal} /></mesh>;
}
function WoodenTable({ prop, floor }: { prop: PropRuntime; floor: number }) {
  const body = useRef<RapierRigidBody>(null);
  useEffect(() => { if (body.current && !prop.broken) return bodyWorksRuntime.registerLandingSurface(prop.id, 'table', body.current); }, [prop.id, prop.broken]);
  if (prop.broken) return <>{[-1, 1].flatMap(x => [-1, 1].map(z => <RigidBody key={`${x}-${z}`} position={[prop.position.x + x * .7, floor + .8, prop.position.z + z * .3]} colliders="cuboid" mass={2} linearVelocity={[x * 1.5, 2, z]} angularVelocity={[z, x, 1]} collisionGroups={propCollisionGroups} solverGroups={propCollisionGroups}><Block at={[0, 0, 0]} size={[1.35, .1, .58]} color="#9e724b" /></RigidBody>))}</>;
  const bend = prop.failureStage === 'cracked' ? .08 : prop.failureStage === 'stressed' ? .025 : 0;
  return <RigidBody ref={body} type="fixed" colliders={false} position={[prop.position.x, floor + .9, prop.position.z]} collisionGroups={propCollisionGroups} solverGroups={propCollisionGroups} userData={{ surface: true, prop: prop.id, kind: 'table' }}>
    <CuboidCollider args={[1.5, .065, .65]} rotation={[0, 0, bend]} />
    <group rotation={[0, 0, bend]}><VenueAsset kind="table" fallback={<>
      <Block at={[0, 0, 0]} size={[3, .13, 1.3]} color="#ae8055" />
      {[-1.15, 1.15].flatMap(x => [-.43, .43].map(z => <Block key={`${x}-${z}`} at={[x, -.45, z]} size={[.11, .84, .11]} color="#424542" metal={.65} />))}
    </>} /></group>
    {[-1.15, 1.15].flatMap(x => [-.43, .43].map(z => <CuboidCollider key={`${x}-${z}`} args={[.055, .42, .055]} position={[x, -.45, z]} />))}
  </RigidBody>;
}
function RingsideFans({ width, depth, floor }: { width: number; depth: number; floor: number }) {
  const torsos = useRef<InstancedMesh>(null); const heads = useRef<InstancedMesh>(null); const limbs = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const fans = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const side = i < 10 ? -1 : 1; const column = i % 10; const back = i >= 20;
    return { x: back ? -width + 1 + (i - 20) * (width * 2 - 2) / 7 : side * (width + 1.1), z: back ? -depth - 1.2 : -depth + 1 + column * (depth * 2 - 2) / 9, yaw: back ? 0 : -side * Math.PI / 2 };
  }), [width, depth]);
  useEffect(() => {
    fans.forEach((_, i) => {
      const skin = new Color(i % 3 ? '#c49573' : '#765842');
      torsos.current?.setColorAt(i, new Color(['#a34936', '#d8bc65', '#3b6971', '#444343'][i % 4] ?? '#444343'));
      heads.current?.setColorAt(i, skin);
      for (let j = 0; j < 4; j++) limbs.current?.setColorAt(i * 4 + j, j < 2 ? new Color('#39444a') : skin);
    });
    for (const mesh of [torsos.current, heads.current, limbs.current]) if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [fans]);
  useFrame(({ clock }) => {
    if (!torsos.current || !heads.current || !limbs.current) return;
    const hype = useMatchStore.getState().model.hype;
    fans.forEach((fan, i) => {
      const y = floor + Math.max(0, Math.sin(clock.elapsedTime * 3.5 + i)) * hype * .0015;
      dummy.rotation.set(0, fan.yaw, 0); dummy.position.set(fan.x, y + 1.1, fan.z); dummy.scale.set(.48, .58, .28); dummy.updateMatrix(); torsos.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.y = y + 1.58; dummy.scale.set(.19, .21, .19); dummy.updateMatrix(); heads.current?.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < 4; j++) {
        const arm = j >= 2; const side = j % 2 ? 1 : -1; const offset = side * (arm ? .39 : .13);
        dummy.position.set(fan.x + Math.cos(fan.yaw) * offset, y + (arm ? 1.45 : .43), fan.z - Math.sin(fan.yaw) * offset);
        dummy.rotation.set(0, fan.yaw, arm ? side * (.6 + Math.sin(clock.elapsedTime * 2 + i) * .12) : 0); dummy.scale.set(arm ? .13 : .17, arm ? .47 : .85, arm ? .14 : .22); dummy.updateMatrix(); limbs.current?.setMatrixAt(i * 4 + j, dummy.matrix);
      }
    });
    torsos.current.instanceMatrix.needsUpdate = true; heads.current.instanceMatrix.needsUpdate = true; limbs.current.instanceMatrix.needsUpdate = true;
  });
  return <><instancedMesh ref={torsos} args={[undefined, undefined, 28]} frustumCulled={false} castShadow><boxGeometry /><meshStandardMaterial roughness={.95} /></instancedMesh><instancedMesh ref={heads} args={[undefined, undefined, 28]} frustumCulled={false} castShadow><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial roughness={.9} /></instancedMesh><instancedMesh ref={limbs} args={[undefined, undefined, 112]} frustumCulled={false} castShadow><boxGeometry /><meshStandardMaterial roughness={.95} /></instancedMesh></>;
}
export function FightVenue({ venue }: { venue: Exclude<CombatVenue, 'dome'> }) {
  const profile = VENUES[venue]; const { halfWidth: w, halfDepth: d, floorY: y } = profile;
  const floor = useRef<RapierRigidBody>(null);
  const props = useMatchStore(s => s.model.props); const runtimeId = useMatchStore(s => s.model.runtimeId);
  const underground = venue === 'underground';
  const backstage = venue === 'backstage' || underground;
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = backstage ? '#77756a' : '#627343'; ctx.fillRect(0, 0, 256, 256);
      let seed = 813; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < 7000; i++) { ctx.globalAlpha = .12 + random() * .25; ctx.fillStyle = i % 2 ? '#c1ad77' : '#35462d'; ctx.fillRect(random() * 256, random() * 256, 1, backstage ? 1 : 3); }
      if (backstage) { ctx.globalAlpha = .25; ctx.strokeStyle = '#242924'; ctx.strokeRect(1, 1, 254, 254); }
    }
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.wrapS = map.wrapT = RepeatWrapping; map.repeat.set(12, 12); return map;
  }, [backstage]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => { if (floor.current) return bodyWorksRuntime.registerLandingSurface('venue-floor', 'floor', floor.current); }, [venue]);
  return <>
    <color attach="background" args={[backstage ? '#303a3c' : '#c0bd9e']} /><fog attach="fog" args={[backstage ? '#303a3c' : '#c0bd9e', 25, 65]} />
    <hemisphereLight args={['#fff1d1', '#515d47', backstage ? 2.2 : 2]} />
    <directionalLight position={[-8, 18, 10]} intensity={3} color="#fff0d5" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-normalBias={.035} />
    <RigidBody ref={floor} type="fixed" position={[0, y - .2, 0]} colliders={false} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'floor' }}><CuboidCollider args={[w + 8, .2, d + 8]} friction={1.1} /><mesh position={[0, .2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[(w + 8) * 2, (d + 8) * 2]} /><meshStandardMaterial map={texture} roughness={1} /></mesh></RigidBody>
    {/* Solid, visible waist-high barriers share the simulation's exact playable bounds. */}
    {[-1, 1].flatMap(side => [{ x: side * (w + .12), z: 0, sx: .24, sz: d * 2 + .5 }, { x: 0, z: side * (d + .12), sx: w * 2, sz: .24 }].map((wall, i) => <RigidBody key={`${side}-${i}`} type="fixed" colliders="cuboid" position={[wall.x, y + .6, wall.z]} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'barrier' }}><Block at={[0, 0, 0]} size={[wall.sx, 1.2, wall.sz]} color={backstage ? '#465356' : '#827151'} /></RigidBody>))}
    {[-1, 1].flatMap(side => Array.from({ length: 9 }, (_, i) => <Block key={`${side}-${i}`} at={[-w + i * w / 4, y + .7, side * (d + .3)]} size={[.13, 1.5, .15]} color="#4c4938" />))}
    <mesh position={[0, y + .015, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.9, 2.94, 64]} /><meshStandardMaterial color="#e6d9b5" roughness={1} transparent opacity={.65} /></mesh>
    <WorldSign text={profile.name.toUpperCase()} position={[0, y + 3.4, -d - 2]} width={6.5} />
    <WorldSign text="FRWF • FALLS COUNT ANYWHERE" position={[0, y + .65, -d + .14]} width={5} />
    {underground ? <UndergroundSet width={w} depth={d} floor={y} /> : backstage ? <>
      <Block at={[0, y + 2, -d - 1.5]} size={[w * 2 + 4, 4, .3]} color="#505c5d" />
      {Array.from({ length: 10 }, (_, i) => <group key={i} position={[-6.5 + i * 1.4, y, -d - 1.15]}><Block at={[0, 1.1, 0]} size={[1.15, 2.2, .45]} color={i % 2 ? '#5f6b69' : '#667c7a'} />{[1.5, 1.65, 1.8].map(h => <Block key={h} at={[0, h, .24]} size={[.7, .035, .025]} color="#273733" />)}<Block at={[.35, 1, .25]} size={[.06, .2, .04]} color="#d1b778" /></group>)}
      {[-5, 5].map(x => <group key={x}><Block at={[x, y + 4, -d - 1]} size={[2.4, .08, .16]} color="#efe3bc" /><pointLight position={[x, y + 3.7, -d + 1]} intensity={12} distance={12} color="#ffd8a0" /></group>)}
    </> : <>
      {[-1, 1].flatMap(side => Array.from({ length: 8 }, (_, i) => <group key={`${side}-${i}`} position={[side * (w + 5 + i % 2), y, -18 + i * 5]}><Block at={[0, 2, 0]} size={[.45, 4, .45]} color="#5b5140" /><mesh position={[0, 5, 0]} castShadow><icosahedronGeometry args={[2.6, 1]} /><meshStandardMaterial color={i % 2 ? '#465c38' : '#637348'} roughness={1} /></mesh></group>))}
      <Block at={[0, y + 3.7, -d - .9]} size={[w * 2 + 1, .06, .06]} color="#383a32" />
      {Array.from({ length: 11 }, (_, i) => <mesh key={i} position={[-w + i * w / 5, y + 3.6, -d - .9]}><sphereGeometry args={[.085, 8, 6]} /><meshBasicMaterial color="#fff0b4" /></mesh>)}
      <Block at={[w + 4, y + 1.4, d + 1]} size={[3, 2.8, 5]} color="#994d37" />
    </>}
    {!backstage && <group position={[-5, y, -d - 4]}><mesh position={[0, 3.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[3.7, 1, 4]} /><meshStandardMaterial color="#44627b" roughness={.9} /></mesh>{[-2.5, 2.5].flatMap(x => [-2.5, 2.5].map(z => <Block key={`${x}-${z}`} at={[x, 1.45, z]} size={[.07, 2.9, .07]} color="#b7b7a2" metal={.55} />))}</group>}
    <RingsideFans width={w} depth={d} floor={y} />
    {props.map(prop => prop.kind === 'table' ? <WoodenTable key={`${runtimeId}-${prop.id}`} prop={prop} floor={y} /> : !prop.broken && <PhysicalProp key={`${runtimeId}-${prop.id}`} prop={prop} initialPosition={[prop.position.x, y + .65, prop.position.z]} />)}
  </>;
}

/** Modular source assets reuse loader-cached geometry/materials; the near camera wall stays open. */
function UndergroundSet({ width: w, depth: d, floor: y }: { width: number; depth: number; floor: number }) {
  return <>
    {[-6, -2, 2, 6].map(x => <group key={`back-${x}`} position={[x, y, -d - .4]}><VenueAsset kind="brickWall" /></group>)}
    {[-1, 1].flatMap(side => [-4, 0, 4].map(z => <group key={`${side}-${z}`} position={[side * (w + .4), y, z]} rotation={[0, Math.PI / 2, 0]}><VenueAsset kind="brickWall" /></group>))}
    {[-8, 0, 8].map(x => <group key={x} position={[x, y, -d - .2]}><VenueAsset kind="column" /></group>)}
    {[-4.5, 4.5].map(x => <group key={x} position={[x, y + 4.1, -d - .2]}><VenueAsset kind="beam" /></group>)}
    <group position={[0, y + 1.4, -d + .12]}><VenueAsset kind="banner" /></group>
    <group position={[w + .25, y, 3]} rotation={[0, -Math.PI / 2, 0]}><VenueAsset kind="gate" /></group>
    {[-1, 1].map(side => <group key={side}>
      <group position={[side * 7.6, y, -5.8]}><VenueAsset kind="speakers" /></group>
      <group position={[side * 7.4, y, 5.6]} rotation={[0, -side * .7, 0]}><VenueAsset kind="workLight" /></group>
      <pointLight position={[side * 6, y + 3, 3]} color={side < 0 ? '#f8c281' : '#9ed4df'} intensity={18} distance={15} />
      <group position={[side * (w + 3), y, -2]} rotation={[0, -side * Math.PI / 2, 0]}><VenueAsset kind="bleachers" /></group>
      <group position={[side * 7.5, y, -4.3]}><VenueAsset kind="crate" /></group>
    </group>)}
  </>;
}
