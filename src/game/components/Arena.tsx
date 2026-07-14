import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { ContactForcePayload, RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, Object3D } from 'three';
import type { Group, InstancedMesh, MeshStandardMaterial } from 'three';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';
import { arenaCollisionGroups, propCollisionGroups } from '../physics/collisionGroups';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { FighterKey } from '../physics/physicsRuntime';
import type { BodySegmentId } from '../physics/bodySchema';
import type { PropRuntime } from '../types/game';
import { VOLT_DOME } from '../data/arena';

function Crowd({ count }: { count: number }) {
  const bodies = useRef<InstancedMesh>(null); const heads = useRef<InstancedMesh>(null); const dummy = useMemo(() => new Object3D(), []); const elapsed = useRef(0);
  useFrame((_, dt) => {
    elapsed.current += dt;
    if (!bodies.current || !heads.current) return;
    const hype = useMatchStore.getState().model.hype;
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / 42); const col = index % 42; const angle = (col / 42) * Math.PI * 2 + row * .055;
      const radius = 13.9 + row * 1.28; const wave = Math.sin(elapsed.current * (2 + hype / 30) + index * .71); const bounce = wave * (.035 + hype / 680);
      const baseY = 1.15 + row * .62;
      dummy.position.set(Math.cos(angle) * radius, baseY + bounce, Math.sin(angle) * radius);
      dummy.rotation.set(wave * .025, -angle + Math.PI / 2, wave * .035); dummy.scale.set(.38 + (index % 4) * .025, .62 + (index % 3) * .1, .29); dummy.updateMatrix(); bodies.current.setMatrixAt(index, dummy.matrix);
      dummy.position.set(Math.cos(angle) * radius, baseY + .82 + (index % 3) * .1 + bounce, Math.sin(angle) * radius);
      dummy.rotation.set(0, -angle + Math.PI / 2, wave * .03); dummy.scale.set(.22, .22, .21); dummy.updateMatrix(); heads.current.setMatrixAt(index, dummy.matrix);
    }
    bodies.current.instanceMatrix.needsUpdate = true; heads.current.instanceMatrix.needsUpdate = true;
  });
  return <group>
    <instancedMesh ref={bodies} args={[undefined, undefined, count]} castShadow={false} receiveShadow={false}><capsuleGeometry args={[.52, .72, 4, 7]} /><meshStandardMaterial color="#342d5a" emissive="#6b42c9" emissiveIntensity={.16} roughness={.76} /></instancedMesh>
    <instancedMesh ref={heads} args={[undefined, undefined, count]} castShadow={false} receiveShadow={false}><sphereGeometry args={[1, 7, 5]} /><meshStandardMaterial color="#805f65" emissive="#47264f" emissiveIntensity={.08} roughness={.82} /></instancedMesh>
  </group>;
}

function ArenaRibbon() {
  const cyan = useRef<MeshStandardMaterial>(null); const pink = useRef<MeshStandardMaterial>(null); const elapsed = useRef(0);
  useFrame((_, dt) => {
    elapsed.current += dt;
    const model = useMatchStore.getState().model; const energy = .8 + model.hype / 52 + (model.chaosEvent ? .45 : 0);
    if (cyan.current) cyan.current.emissiveIntensity = energy + Math.sin(elapsed.current * 5.2) * .16;
    if (pink.current) pink.current.emissiveIntensity = energy + Math.cos(elapsed.current * 4.7) * .16;
  });
  const horizontal = VOLT_DOME.barricade.halfWidth * 2; const vertical = VOLT_DOME.barricade.halfDepth * 2;
  return <group position={[0, 1.55, 0]}>
    <mesh position={[0, 0, -VOLT_DOME.barricade.halfDepth + .18]}><boxGeometry args={[horizontal, .12, .06]} /><meshStandardMaterial ref={cyan} color="#6cf7ff" emissive="#23dff7" emissiveIntensity={1} metalness={.55} roughness={.22} /></mesh>
    <mesh position={[0, 0, VOLT_DOME.barricade.halfDepth - .18]}><boxGeometry args={[horizontal, .12, .06]} /><meshStandardMaterial ref={pink} color="#ff56a7" emissive="#ff278d" emissiveIntensity={1} metalness={.55} roughness={.22} /></mesh>
    <mesh position={[-VOLT_DOME.barricade.halfWidth + .18, 0, 0]}><boxGeometry args={[.06, .12, vertical]} /><meshStandardMaterial color="#d7ff45" emissive="#a7e92f" emissiveIntensity={1.35} /></mesh>
    <mesh position={[VOLT_DOME.barricade.halfWidth - .18, 0, 0]}><boxGeometry args={[.06, .12, vertical]} /><meshStandardMaterial color="#ff713a" emissive="#ff4e2d" emissiveIntensity={1.35} /></mesh>
  </group>;
}

function RopeSide({ axis, side, color, emissive }: { axis: 'x' | 'z'; side: -1 | 1; color: string; emissive: string }) {
  const rope = useRef<InstancedMesh>(null); const material = useRef<MeshStandardMaterial>(null); const dummy = useMemo(() => new Object3D(), []); const elapsed = useRef(0);
  const segmentCount = 7; const length = axis === 'x' ? 8.5 : 11.5; const segmentLength = length / segmentCount; const ropeCount = 3;
  useFrame((_, dt) => {
    elapsed.current += dt;
    if (!rope.current) return;
    const model = useMatchStore.getState().model; const overdrive = model.chaosEvent?.type === 'OVERDRIVE ROPES';
    const edge = axis === 'x' ? 5.2 : 3.7;
    const playerEdge = (axis === 'x' ? model.player.position.x : model.player.position.z) * side;
    const opponentEdge = (axis === 'x' ? model.opponent.position.x : model.opponent.position.z) * side;
    const contactFighter = playerEdge >= opponentEdge ? model.player : model.opponent;
    const contactEdge = Math.max(playerEdge, opponentEdge);
    const compression = Math.max(0, Math.min(1, (contactEdge - edge) / .54));
    const rebound = Math.max(playerEdge > edge - 1.55 ? model.player.ropeRebound : 0, opponentEdge > edge - 1.55 ? model.opponent.ropeRebound : 0);
    const contactAlong = axis === 'x' ? contactFighter.position.z : contactFighter.position.x;
    const pulse = Math.sin(elapsed.current * (overdrive ? 29 : 21)) * (compression + rebound * .34);
    for (let ropeIndex = 0; ropeIndex < ropeCount; ropeIndex += 1) {
      const y = 2.5 + ropeIndex * .55;
      for (let index = 0; index < segmentCount; index += 1) {
        const along = -length / 2 + segmentLength * (index + .5); const distanceFromContact = Math.abs(along - contactAlong);
        const envelope = Math.exp(-distanceFromContact * distanceFromContact * .42);
        const travellingWave = Math.sin(elapsed.current * 25 - distanceFromContact * 2.2) * rebound * .075 * envelope;
        const deflection = side * (compression * (.34 + pulse * .1) * envelope + travellingWave);
        dummy.position.set(axis === 'x' ? deflection : along, y + pulse * .008 * (ropeIndex + 1), axis === 'x' ? along : deflection);
        dummy.rotation.set(0, axis === 'x' ? Math.sin((along - contactAlong) * .72) * compression * .055 * side : 0, axis === 'z' ? -Math.sin((along - contactAlong) * .72) * compression * .055 * side : 0);
        dummy.scale.set(1, 1 + pulse * .025, 1); dummy.updateMatrix(); rope.current.setMatrixAt(ropeIndex * segmentCount + index, dummy.matrix);
      }
    }
    rope.current.instanceMatrix.needsUpdate = true;
    if (material.current) material.current.emissiveIntensity = overdrive ? 2.6 : .78 + compression * 1.2;
  });
  return <instancedMesh ref={rope} args={[undefined, undefined, segmentCount * ropeCount]} position={axis === 'x' ? [side * 5.75, 0, 0] : [0, 0, side * 4.25]} castShadow><boxGeometry args={axis === 'x' ? [.075, .075, segmentLength + .06] : [segmentLength + .06, .075, .075]} /><meshStandardMaterial ref={material} color={color} emissive={emissive} emissiveIntensity={.78} roughness={.3} metalness={.28} /></instancedMesh>;
}

function Ropes() {
  return <><RopeSide axis="z" side={-1} color="#5cf8ff" emissive="#39d8ff" /><RopeSide axis="z" side={1} color="#ff4fa3" emissive="#ff298d" /><RopeSide axis="x" side={-1} color="#d9ff47" emissive="#a6ed2f" /><RopeSide axis="x" side={1} color="#ff763b" emissive="#ff4b28" /></>;
}

function ReactiveMat() {
  const mat = useRef<InstancedMesh>(null); const dummy = useMemo(() => new Object3D(), []); const lastImpactId = useRef(0); const impactAge = useRef(10); const amplitude = useRef(0); const epicenter = useRef({ x: 0, z: 0 });
  const reducedMotion = useSettings((state) => state.reducedMotion); const lab = useMemo(() => new URLSearchParams(window.location.search).get('physicsLab') === '1', []); const columns = lab ? 6 : 12; const rows = lab ? 5 : 9; const count = columns * rows; const width = 11.3; const depth = 8.3; const tileWidth = width / columns; const tileDepth = depth / rows;
  useFrame((_, dt) => {
    const mesh = mat.current; if (!mesh) return;
    const impact = useMatchStore.getState().model.lastImpact;
    if (impact && impact.id !== lastImpactId.current && Math.abs(impact.position.x) < 6.1 && Math.abs(impact.position.z) < 4.6) {
      lastImpactId.current = impact.id; impactAge.current = 0; epicenter.current = impact.position;
      const hierarchy = impact.kind === 'finisher' || impact.kind === 'ko' ? .24 : impact.kind === 'grapple' ? .17 : impact.kind === 'heavy' || impact.kind === 'weapon' ? .1 : impact.kind === 'light' || impact.kind === 'blocked' ? .035 : .07;
      amplitude.current = hierarchy * Math.min(1.45, .55 + impact.intensity * .42) * (reducedMotion ? .38 : 1);
    }
    impactAge.current += dt;
    const decay = Math.exp(-impactAge.current * 4.8); const waveFront = impactAge.current * 8.5;
    for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column; const x = -width / 2 + tileWidth * (column + .5); const z = -depth / 2 + tileDepth * (row + .5);
      const distance = Math.hypot(x - epicenter.current.x, z - epicenter.current.z);
      const contactDimple = -amplitude.current * Math.exp(-distance * distance * 1.15) * Math.exp(-impactAge.current * 8);
      const travellingWave = amplitude.current * .38 * Math.sin((waveFront - distance) * 2.1) * Math.exp(-Math.abs(waveFront - distance) * .48) * decay;
      const displacement = contactDimple + travellingWave;
      dummy.position.set(x, displacement, z); dummy.rotation.set((z - epicenter.current.z) * displacement * .025, 0, -(x - epicenter.current.x) * displacement * .025); dummy.scale.set(1, 1 + Math.abs(displacement) * 1.8, 1); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mat} args={[undefined, undefined, count]} position={[0, 1.86, 0]} receiveShadow>
    <boxGeometry args={[tileWidth + .012, .08, tileDepth + .012]} /><meshStandardMaterial color="#e9ebf4" emissive="#1a0e32" emissiveIntensity={.08} roughness={.72} />
  </instancedMesh>;
}

function Post({ x, z }: { x: number; z: number }) {
  const visual = useRef<Group>(null); const jewel = useRef<MeshStandardMaterial>(null); const impulse = useRef(0); const lastImpactId = useRef(0);
  useFrame((_, dt) => {
    const group = visual.current; if (!group) return;
    const impact = useMatchStore.getState().model.lastImpact;
    if (impact && impact.id !== lastImpactId.current) {
      lastImpactId.current = impact.id;
      const distance = Math.hypot(impact.position.x - x, impact.position.z - z);
      const major = impact.kind === 'grapple' || impact.kind === 'finisher' || impact.kind === 'table' || impact.kind === 'ko';
      if (distance < (major ? 8 : 4.5)) impulse.current = Math.max(impulse.current, Math.max(0, (major ? 1.1 : .5) - distance * .07) * impact.intensity);
    }
    impulse.current = Math.max(0, impulse.current - dt * 3.4);
    const wobble = Math.sin(performance.now() * .026 + x * z) * impulse.current;
    group.rotation.x = wobble * .018 * Math.sign(z); group.rotation.z = wobble * .018 * Math.sign(x);
    if (jewel.current) jewel.current.emissiveIntensity = 1.8 + impulse.current * 2.8;
  });
  return <RigidBody type="fixed" position={[x, 2.2, z]} colliders={false} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'turnbuckle' }}>
    <CuboidCollider args={[.24, 1.82, .24]} friction={.5} restitution={.08} />
    <CuboidCollider args={[.5, .13, .5]} position={[x > 0 ? -.28 : .28, 1.56, z > 0 ? -.24 : .24]} friction={1.2} restitution={.02} />
    <group ref={visual}>
      <mesh castShadow><cylinderGeometry args={[.19, .23, 3.5, 10]} /><meshStandardMaterial color="#161321" metalness={.85} roughness={.2} /></mesh>
      {[.3, .85, 1.4].map((y) => <group key={y} position={[x > 0 ? -.22 : .22, y, z > 0 ? -.18 : .18]}><mesh castShadow scale={[.58, .31, .34]}><sphereGeometry args={[1, 12, 7]} /><meshStandardMaterial color="#a34dff" emissive="#6d22df" emissiveIntensity={.9} metalness={.25} roughness={.35} /></mesh><mesh position={[0, 0, .31]}><boxGeometry args={[.31, .1, .04]} /><meshStandardMaterial color="#f5eaff" emissive="#d067ff" emissiveIntensity={1.2} /></mesh></group>)}
      <mesh position={[0, 1.83, 0]}><octahedronGeometry args={[.25, 0]} /><meshStandardMaterial ref={jewel} color="#f2f5ff" emissive={x * z > 0 ? '#ff3c91' : '#42e8ff'} emissiveIntensity={1.8} metalness={.65} roughness={.2} /></mesh>
    </group>
  </RigidBody>;
}

function Props() {
  const props = useMatchStore((state) => state.model.props);
  const runtimeId = useMatchStore((state) => state.model.runtimeId);
  const player = useMatchStore((state) => state.model.player);
  const opponent = useMatchStore((state) => state.model.opponent);
  return <>{props.map((prop) => {
    if (prop.broken) return prop.kind === 'table' ? <BrokenTable key={`${runtimeId}-${prop.id}`} x={prop.position.x} z={prop.position.z} /> : null;
    if (prop.kind === 'table') return <CommentaryTable key={`${runtimeId}-${prop.id}`} prop={prop} />;
    const owner = prop.heldBy === 'player' ? player : prop.heldBy === 'opponent' ? opponent : null;
    const position: [number, number, number] = owner
      ? [owner.position.x + Math.sin(owner.facing) * .65 + Math.cos(owner.facing) * .32, 3.25, owner.position.z + Math.cos(owner.facing) * .65 - Math.sin(owner.facing) * .32]
      : [prop.position.x, .55, prop.position.z];
    return <PhysicalProp key={`${runtimeId}-${prop.id}`} prop={prop} initialPosition={position} />;
  })}</>;
}

function CommentaryTable({ prop }: { prop: PropRuntime }) {
  const bend = prop.failureStage === 'cracked' ? .095 : prop.failureStage === 'stressed' ? .035 : 0;
  const accent = prop.failureStage === 'cracked' ? '#ff3c64' : prop.failureStage === 'stressed' ? '#ffc83d' : '#27d8ff';
  return <RigidBody type="fixed" position={[prop.position.x, .72, prop.position.z]} colliders={false} collisionGroups={propCollisionGroups} solverGroups={propCollisionGroups} userData={{ surface: true, prop: prop.id, kind: prop.kind }}>
    <CuboidCollider args={[1.7, .12, .65]} rotation={[0, 0, bend]} />
    <CuboidCollider args={[.08, .55, .08]} position={[-1.35, -.58, -.45]} /><CuboidCollider args={[.08, .55, .08]} position={[-1.35, -.58, .45]} />
    <CuboidCollider args={[.08, .55, .08]} position={[1.35, -.58, -.45]} /><CuboidCollider args={[.08, .55, .08]} position={[1.35, -.58, .45]} />
    <group rotation={[0, 0, bend]}>
      <mesh castShadow><boxGeometry args={[3.4, .2, 1.3]} /><meshStandardMaterial color="#2a3140" metalness={.6} roughness={.3} /></mesh>
      <mesh position={[0, .13, 0]}><boxGeometry args={[2.2, .05, .75]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={prop.failureStage === 'intact' ? .8 : 1.8} /></mesh>
      {prop.failureStage === 'cracked' && <mesh position={[.18, .125, 0]} rotation={[0, .2, -.22]}><boxGeometry args={[.08, .035, 1.18]} /><meshStandardMaterial color="#fff0b8" emissive="#ff4d63" emissiveIntensity={2.6} /></mesh>}
    </group>
    {[-1.35, 1.35].flatMap((x) => [-.45, .45].map((z) => <mesh key={`${x}-${z}`} position={[x, -.58, z]} rotation={[0, 0, x < 0 ? bend * 1.8 : -bend * .5]}><boxGeometry args={[.12, 1.1, .12]} /><meshStandardMaterial color="#11141b" /></mesh>))}
  </RigidBody>;
}

interface FighterColliderData { bodyWorks: true; fighter: FighterKey; segment: BodySegmentId; region: 'head' | 'chest' | 'ribs' | 'pelvis' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' }
const isFighterColliderData = (value: unknown): value is FighterColliderData => typeof value === 'object' && value !== null && 'bodyWorks' in value && 'fighter' in value && 'segment' in value && 'region' in value;

function PropVisual({ kind }: { kind: Exclude<PropRuntime['kind'], 'table'> }) {
  if (kind === 'chair') return <group>
    <mesh><boxGeometry args={[.9, .11, .82]} /><meshStandardMaterial color="#929dac" metalness={.82} roughness={.2} /></mesh>
    <mesh position={[0, .69, .35]}><boxGeometry args={[.9, 1.16, .1]} /><meshStandardMaterial color="#4cdcff" emissive="#157c8c" emissiveIntensity={.4} metalness={.6} roughness={.25} /></mesh>
    {[-1, 1].map((side) => <group key={side} position={[side * .34, -.06, 0]}>
      <mesh position={[0, -.48, .2]} rotation={[.43, 0, 0]}><cylinderGeometry args={[.035, .035, 1.12, 8]} /><meshStandardMaterial color="#c8d0d8" metalness={.92} roughness={.18} /></mesh>
      <mesh position={[0, -.48, -.2]} rotation={[-.43, 0, 0]}><cylinderGeometry args={[.035, .035, 1.12, 8]} /><meshStandardMaterial color="#c8d0d8" metalness={.92} roughness={.18} /></mesh>
      <mesh position={[0, -.18, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.075, .025, 6, 12]} /><meshStandardMaterial color="#5bf0ff" emissive="#1da7bb" emissiveIntensity={.5} /></mesh>
    </group>)}
    <mesh position={[0, -.42, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.025, .025, .7, 7]} /><meshStandardMaterial color="#9ba6b2" metalness={.9} /></mesh>
  </group>;
  if (kind === 'trash') return <group><mesh><cylinderGeometry args={[.46, .39, 1.18, 14]} /><meshStandardMaterial color="#8793a3" metalness={.9} roughness={.25} /></mesh><mesh position={[0, .64, 0]}><cylinderGeometry args={[.5, .5, .08, 14]} /><meshStandardMaterial color="#b2bfcc" metalness={.94} roughness={.2} /></mesh><mesh position={[0, .73, 0]}><torusGeometry args={[.16, .035, 6, 12]} /><meshStandardMaterial color="#56efff" emissive="#21a6ba" emissiveIntensity={.7} metalness={.8} /></mesh>{[-.26, 0, .26].map((x) => <mesh key={x} position={[x, 0, .405]}><boxGeometry args={[.035, .92, .02]} /><meshStandardMaterial color="#c7d1dc" metalness={.9} /></mesh>)}</group>;
  if (kind === 'bell') return <group>
    <mesh position={[0, -.12, 0]}><cylinderGeometry args={[.48, .54, .12, 16]} /><meshStandardMaterial color="#442b18" roughness={.62} /></mesh>
    <mesh position={[0, .1, 0]}><sphereGeometry args={[.38, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e6b83e" emissive="#7c4c08" emissiveIntensity={.16} metalness={.92} roughness={.16} /></mesh>
    <mesh position={[0, .47, 0]}><sphereGeometry args={[.095, 12, 8]} /><meshStandardMaterial color="#f7d76b" metalness={.9} roughness={.14} /></mesh>
  </group>;
  return <group rotation={[0, 0, .1]}><mesh><boxGeometry args={[1.35, .85, .1]} /><meshStandardMaterial color="#ff3c91" emissive="#951654" emissiveIntensity={.4} /></mesh><mesh position={[0, -.82, 0]}><boxGeometry args={[.08, .85, .08]} /><meshStandardMaterial color="#d8e3eb" /></mesh></group>;
}

function PhysicalProp({ prop, initialPosition }: { prop: PropRuntime; initialPosition: [number, number, number] }) {
  const body = useRef<RapierRigidBody | null>(null);
  const replayActive = useMatchStore((state) => state.replayActive);
  useEffect(() => {
    const rigidBody = body.current; if (!rigidBody || prop.kind === 'table') return;
    return bodyWorksRuntime.registerProp(prop.id, prop.kind, rigidBody);
  }, [prop.id, prop.kind]);
  useFrame(() => {
    const rigidBody = body.current; if (!rigidBody) return;
    const liveProp = useMatchStore.getState().model.props.find((candidate) => candidate.id === prop.id);
    if (!liveProp?.heldBy && rigidBody.translation().y < -2) {
      rigidBody.setTranslation({ x: liveProp?.position.x ?? initialPosition[0], y: initialPosition[1], z: liveProp?.position.z ?? initialPosition[2] }, true);
      rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true); rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });
  const onContactForce = (payload: ContactForcePayload): void => {
    const model = useMatchStore.getState().model; const liveProp = model.props.find((candidate) => candidate.id === prop.id); const heldBy = liveProp?.heldBy;
    const released = heldBy ? null : bodyWorksRuntime.propAttackSource(prop.id, model.elapsed); const source = heldBy ?? released?.owner; if (!source) return;
    const actor = model[source]; const targetData = payload.other.rigidBodyObject?.userData;
    const moveId = heldBy ? 'prop' : released?.moveId; const attackInstanceId = heldBy ? actor.attackInstanceId : released?.attackInstanceId;
    if (!isFighterColliderData(targetData) || targetData.fighter === source || !moveId || attackInstanceId === undefined || actor.moveId !== moveId || actor.attackPhase !== 'active') return;
    const propVelocity = body.current?.linvel() ?? { x: 0, y: 0, z: 0 }; const targetVelocity = payload.other.rigidBody?.linvel() ?? { x: 0, y: 0, z: 0 };
    bodyWorksRuntime.recordContact({ time: model.elapsed, sourceFighter: source, sourceSegment: 'rightHand', targetFighter: targetData.fighter, targetSegment: targetData.segment, targetRegion: targetData.region, totalForce: payload.totalForceMagnitude, maximumForce: payload.maxForceMagnitude, forceDirection: [payload.maxForceDirection.x, payload.maxForceDirection.y, payload.maxForceDirection.z], relativeSpeed: Math.hypot(propVelocity.x - targetVelocity.x, propVelocity.y - targetVelocity.y, propVelocity.z - targetVelocity.z), attackInstanceId, moveId, sourceObjectId: prop.id, targetSurface: null, isLanding: false });
  };
  return <RigidBody ref={body} type="dynamic" position={initialPosition} colliders="cuboid" mass={prop.kind === 'chair' ? 3.4 : prop.kind === 'trash' ? 4.8 : .75} linearDamping={1.15} angularDamping={1.05} restitution={prop.kind === 'chair' ? .2 : prop.kind === 'trash' ? .16 : .34} collisionGroups={propCollisionGroups} solverGroups={propCollisionGroups} userData={{ surface: true, prop: prop.id, kind: prop.kind }} onContactForce={onContactForce}>
    <group visible={!replayActive}>{prop.kind === 'chair' ? <group><mesh><boxGeometry args={[.9, .12, .85]} /><meshStandardMaterial color="#9099aa" metalness={.82} roughness={.2} /></mesh><mesh position={[0, .7, .36]}><boxGeometry args={[.9, 1.2, .12]} /><meshStandardMaterial color="#4cdcff" emissive="#157c8c" emissiveIntensity={.4} /></mesh></group>
      : prop.kind === 'trash' ? <group><mesh><cylinderGeometry args={[.46, .39, 1.18, 14]} /><meshStandardMaterial color="#8793a3" metalness={.9} roughness={.25} /></mesh><mesh position={[0, .64, 0]}><cylinderGeometry args={[.5, .5, .08, 14]} /><meshStandardMaterial color="#b2bfcc" metalness={.94} roughness={.2} /></mesh><mesh position={[0, .73, 0]}><torusGeometry args={[.16, .035, 6, 12]} /><meshStandardMaterial color="#56efff" emissive="#21a6ba" emissiveIntensity={.7} metalness={.8} /></mesh>{[-.26,0,.26].map((x) => <mesh key={x} position={[x,0,.405]}><boxGeometry args={[.035,.92,.02]} /><meshStandardMaterial color="#c7d1dc" metalness={.9} /></mesh>)}</group>
        : <group rotation={[0, 0, .1]}><mesh><boxGeometry args={[1.35, .85, .1]} /><meshStandardMaterial color="#ff3c91" emissive="#951654" emissiveIntensity={.4} /></mesh><mesh position={[0, -.82, 0]}><boxGeometry args={[.08, .85, .08]} /><meshStandardMaterial color="#d8e3eb" /></mesh></group>}</group>
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

function SteelSteps() {
  const { x, z } = VOLT_DOME.steelSteps;
  const steps = [
    { x: 0, y: .12, z: .22, width: 1.35, height: .12, depth: .72 },
    { x: -.16, y: .34, z: .04, width: 1.18, height: .12, depth: .56 },
    { x: -.31, y: .56, z: -.12, width: 1, height: .12, depth: .42 },
  ] as const;
  return <RigidBody type="fixed" colliders={false} position={[x, .2, z]} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'steps' }}>
    {steps.map((step, index) => <group key={index} position={[step.x, step.y, step.z]}>
      <CuboidCollider args={[step.width / 2, step.height, step.depth / 2]} friction={.82} />
      <mesh castShadow receiveShadow><boxGeometry args={[step.width, step.height * 2, step.depth]} /><meshStandardMaterial color={index === 2 ? '#6d7d92' : '#414d60'} metalness={.88} roughness={.2} /></mesh>
      <mesh position={[0, step.height + .006, 0]}><boxGeometry args={[step.width * .92, .018, step.depth * .82]} /><meshStandardMaterial color="#91a7bb" metalness={.96} roughness={.18} /></mesh>
    </group>)}
  </RigidBody>;
}

function EntranceLane() {
  const { x, z, width, depth } = VOLT_DOME.entrance;
  return <RigidBody type="fixed" colliders={false} position={[x, .38, z]} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'entrance-ramp' }}>
    <CuboidCollider args={[width / 2, .12, depth / 2]} friction={1.05} />
    <mesh receiveShadow><boxGeometry args={[width, .22, depth]} /><meshStandardMaterial color="#181527" metalness={.48} roughness={.42} emissive="#2e1268" emissiveIntensity={.18} /></mesh>
    {[-2.35, -1.57, -.79, 0, .79, 1.57, 2.35].map((lane, index) => <mesh key={lane} position={[lane, .13, 0]}><boxGeometry args={[.1, .025, depth * .92]} /><meshStandardMaterial color={index % 2 ? '#ff4a9b' : '#54efff'} emissive={index % 2 ? '#ff2486' : '#24d9ff'} emissiveIntensity={1.75} /></mesh>)}
    <group position={[0, .52, depth / 2 - .4]}>
      {[-2.5, 2.5].map((post) => <group key={post} position={[post, 0, 0]}><mesh><cylinderGeometry args={[.08, .12, 1.05, 8]} /><meshStandardMaterial color="#9cacc3" metalness={.9} roughness={.18} /></mesh><pointLight position={[0, .4, -.1]} intensity={1.3} distance={5} color={post < 0 ? '#4beaff' : '#ff3c93'} /></group>)}
    </group>
  </RigidBody>;
}

function FlexBarricadePanel({ axis, position, length, accent }: { axis: 'x' | 'z'; position: [number, number, number]; length: number; accent: string }) {
  const body = useRef<RapierRigidBody | null>(null); const anchor = useRef({ x: position[0], y: position[1], z: position[2] });
  useFrame(() => {
    const rigidBody = body.current; if (!rigidBody?.isValid()) return;
    const current = rigidBody.translation(); const velocity = rigidBody.linvel(); const target = anchor.current;
    rigidBody.addForce({
      x: (target.x - current.x) * 760 - velocity.x * 92,
      y: (target.y - current.y) * 920 - velocity.y * 105,
      z: (target.z - current.z) * 760 - velocity.z * 92,
    }, true);
  });
  const size: [number, number, number] = axis === 'x' ? [length, .82, .18] : [.18, .82, length];
  const collider: [number, number, number] = axis === 'x' ? [length / 2, .41, .09] : [.09, .41, length / 2];
  return <RigidBody ref={body} type="dynamic" position={position} colliders={false} mass={44} gravityScale={0} lockRotations linearDamping={4.2} angularDamping={8} collisionGroups={propCollisionGroups} solverGroups={propCollisionGroups} userData={{ surface: true, kind: 'barricade-flex' }}>
    <CuboidCollider args={collider} friction={.86} restitution={.08} />
    <mesh castShadow><boxGeometry args={size} /><meshStandardMaterial color="#33394c" emissive={accent} emissiveIntensity={.32} metalness={.7} roughness={.28} /></mesh>
    <mesh position={axis === 'x' ? [0, .48, -.105] : [-.105, .48, 0]}><boxGeometry args={axis === 'x' ? [length * .9, .06, .055] : [.055, .06, length * .9]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.55} /></mesh>
  </RigidBody>;
}

function Barricades() {
  const material = <meshStandardMaterial color="#242638" metalness={.62} roughness={.34} emissive="#35157c" emissiveIntensity={.18} />;
  const rails = (length: number, count: number, axis: 'x' | 'z') => Array.from({ length: count }, (_, index) => {
    const offset = (index - (count - 1) / 2) * (length / count);
    return <group key={`${axis}-${index}`} position={axis === 'x' ? [offset, 0, 0] : [0, 0, offset]}>
      <mesh castShadow><boxGeometry args={axis === 'x' ? [length / count - .08, .82, .16] : [.16, .82, length / count - .08]} />{material}</mesh>
      <mesh position={axis === 'x' ? [0, .48, -.1] : [-.1, .48, 0]}><boxGeometry args={axis === 'x' ? [length / count - .18, .055, .055] : [.055, .055, length / count - .18]} /><meshStandardMaterial color="#65eaff" emissive="#31cdec" emissiveIntensity={1.15} /></mesh>
    </group>;
  });
  return <>
    <RigidBody type="fixed" colliders={false} position={[0, .65, -VOLT_DOME.barricade.halfDepth]} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'barricade' }}><CuboidCollider args={[VOLT_DOME.barricade.halfWidth, .65, .12]} />{rails(VOLT_DOME.barricade.halfWidth * 2, 16, 'x')}</RigidBody>
    <RigidBody type="fixed" colliders={false} position={[0, .65, VOLT_DOME.barricade.halfDepth]} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'barricade' }}><CuboidCollider args={[VOLT_DOME.barricade.halfWidth, .65, .12]} />{rails(VOLT_DOME.barricade.halfWidth * 2, 16, 'x')}</RigidBody>
    <RigidBody type="fixed" colliders={false} position={[-VOLT_DOME.barricade.halfWidth, .65, 0]} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'barricade' }}><CuboidCollider args={[.12, .65, VOLT_DOME.barricade.halfDepth - .15]} />{rails(VOLT_DOME.barricade.halfDepth * 2, 14, 'z')}</RigidBody>
    <RigidBody type="fixed" colliders={false} position={[VOLT_DOME.barricade.halfWidth, .65, 0]} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'barricade' }}><CuboidCollider args={[.12, .65, VOLT_DOME.barricade.halfDepth - .15]} />{rails(VOLT_DOME.barricade.halfDepth * 2, 14, 'z')}</RigidBody>
    <FlexBarricadePanel axis="x" position={[0, .65, -VOLT_DOME.barricade.halfDepth + .28]} length={5.2} accent="#4beaff" />
    <FlexBarricadePanel axis="x" position={[0, .65, VOLT_DOME.barricade.halfDepth - .28]} length={5.2} accent="#ff3f91" />
    <FlexBarricadePanel axis="z" position={[-VOLT_DOME.barricade.halfWidth + .28, .65, 0]} length={4.8} accent="#dfff45" />
    <FlexBarricadePanel axis="z" position={[VOLT_DOME.barricade.halfWidth - .28, .65, 0]} length={4.8} accent="#ff7438" />
  </>;
}

function BroadcastSet() {
  return <>
    <group position={[0, 4.9, 13.7]}>
      <mesh><boxGeometry args={[8.4, 3.4, .5]} /><meshStandardMaterial color="#101121" emissive="#241867" emissiveIntensity={.72} metalness={.3} roughness={.32} /></mesh>
      {[-3, -2, -1, 0, 1, 2, 3].map((x, index) => <mesh key={x} position={[x, .18 + Math.sin(index) * .18, -.28]}><boxGeometry args={[.52, 2.05 - (index % 3) * .24, .035]} /><meshStandardMaterial color={index % 2 ? '#ff408e' : '#52efff'} emissive={index % 2 ? '#ff2078' : '#24d8ff'} emissiveIntensity={2.2} /></mesh>)}
      <mesh position={[0, -1.3, -.3]}><boxGeometry args={[7.3, .18, .04]} /><meshStandardMaterial color="#dfff45" emissive="#b8ef26" emissiveIntensity={2.4} /></mesh>
    </group>
    <group position={[0, 2.05, 17]}><mesh><boxGeometry args={[8.8, 5.1, 1.1]} /><meshStandardMaterial color="#090916" metalness={.3} roughness={.46} /></mesh>{[-3.2, -1.6, 0, 1.6, 3.2].map((x, index) => <mesh key={x} position={[x, .1, -.61]}><boxGeometry args={[.48, 3.8, .08]} /><meshStandardMaterial color={index % 2 ? '#ef3d96' : '#7738ff'} emissive={index % 2 ? '#ef3d96' : '#7738ff'} emissiveIntensity={1.65} /></mesh>)}</group>
    <group position={[0, 8.8, 0]}>{[-10.4, 10.4].flatMap((x) => [-8.6, 8.6].map((z) => <group key={`${x}-${z}`} position={[x, 0, z]}><mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.08, .08, 4.4, 8]} /><meshStandardMaterial color="#65738a" metalness={.9} roughness={.2} /></mesh><mesh><cylinderGeometry args={[.08, .08, 4.4, 8]} /><meshStandardMaterial color="#65738a" metalness={.9} roughness={.2} /></mesh></group>))}</group>
  </>;
}

function VoltDomeArchitecture() {
  const supports = Array.from({ length: 16 }, (_, index) => index / 16 * Math.PI * 2);
  return <group>
    {[4.1, 6.8, 9.5].map((y, index) => <group key={y} position={[0, y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[18.1 + index * .9, .16 + index * .035, 8, 96]} /><meshStandardMaterial color="#2f354a" emissive={index === 1 ? '#4c1f8e' : '#11274a'} emissiveIntensity={.44} metalness={.86} roughness={.25} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[16.7 + index * .95, .055, 6, 96]} /><meshStandardMaterial color={index % 2 ? '#ff4a9e' : '#56edff'} emissive={index % 2 ? '#ff247f' : '#20cce9'} emissiveIntensity={1.55} metalness={.58} roughness={.24} /></mesh>
    </group>)}
    {supports.map((angle, index) => <group key={angle} rotation={[0, angle, 0]}>
      <mesh position={[0, 5.8, -20.25]} rotation={[0, 0, index % 2 ? .08 : -.08]}><boxGeometry args={[.22, 9.8, .34]} /><meshStandardMaterial color="#363d52" metalness={.88} roughness={.24} /></mesh>
      <mesh position={[0, 5.6, -19.98]}><boxGeometry args={[.07, 5.5, .045]} /><meshStandardMaterial color={index % 3 ? '#6531c8' : '#ff3d91'} emissive={index % 3 ? '#6531c8' : '#ff3d91'} emissiveIntensity={1.2} /></mesh>
      <mesh position={[0, 2.2 + (index % 2) * .45, -17.6]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[.16, 3.7, .22]} /><meshStandardMaterial color="#24293a" metalness={.75} roughness={.3} /></mesh>
    </group>)}
    <mesh position={[0, 14.6, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[9.8, .28, 10, 80]} /><meshStandardMaterial color="#647088" emissive="#291a69" emissiveIntensity={.55} metalness={.92} roughness={.18} /></mesh>
    <mesh position={[0, 15.3, 0]} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[10, 24, 72]} /><meshBasicMaterial color="#0b0917" transparent opacity={.72} /></mesh>
  </group>;
}

function Jumbotron() {
  const rig = useRef<Group>(null); const front = useRef<MeshStandardMaterial>(null); const back = useRef<MeshStandardMaterial>(null); const lastImpact = useRef(0); const pulse = useRef(0);
  useFrame(({ clock }, dt) => {
    const model = useMatchStore.getState().model; const impact = model.lastImpact;
    if (impact && impact.id !== lastImpact.current) { lastImpact.current = impact.id; pulse.current = Math.max(pulse.current, impact.intensity); }
    pulse.current = Math.max(0, pulse.current - dt * 2.8);
    if (rig.current) rig.current.rotation.y = Math.sin(clock.elapsedTime * .12) * .035;
    const energy = .7 + model.hype / 48 + pulse.current * .8 + (model.chaosEvent ? .6 : 0);
    if (front.current) front.current.emissiveIntensity = energy;
    if (back.current) back.current.emissiveIntensity = energy * .9;
  });
  return <group ref={rig} position={[0, 10.9, 0]}>
    <mesh><cylinderGeometry args={[3.85, 3.85, 1.8, 8]} /><meshStandardMaterial color="#111320" metalness={.72} roughness={.25} emissive="#20135c" emissiveIntensity={.4} /></mesh>
    <mesh position={[0, 0, 3.62]}><boxGeometry args={[5.8, 1.18, .12]} /><meshStandardMaterial ref={front} color="#58efff" emissive="#20cfe9" emissiveIntensity={1.2} metalness={.25} roughness={.28} /></mesh>
    <mesh position={[0, 0, -3.62]}><boxGeometry args={[5.8, 1.18, .12]} /><meshStandardMaterial ref={back} color="#ff4c9d" emissive="#ff247f" emissiveIntensity={1.2} metalness={.25} roughness={.28} /></mesh>
    <mesh position={[3.62, 0, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[5.8, 1.18, .12]} /><meshStandardMaterial color="#dfff45" emissive="#a7db22" emissiveIntensity={1.4} metalness={.25} roughness={.28} /></mesh>
    <mesh position={[-3.62, 0, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[5.8, 1.18, .12]} /><meshStandardMaterial color="#8c55ff" emissive="#672bd4" emissiveIntensity={1.4} metalness={.25} roughness={.28} /></mesh>
    {[-2.25, -.75, .75, 2.25].map((x) => <mesh key={x} position={[x, 0, 3.7]}><boxGeometry args={[.08, .76, .035]} /><meshBasicMaterial color="#091019" /></mesh>)}
    <mesh position={[0, -1.15, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[3.7, .1, 7, 48]} /><meshStandardMaterial color="#f4f7ff" emissive="#7d5cff" emissiveIntensity={1.5} metalness={.8} roughness={.18} /></mesh>
    {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => <group key={angle} rotation={[0, angle, 0]}><spotLight position={[0, -1.1, -3]} intensity={2.1} color={angle % Math.PI === 0 ? '#4be7ff' : '#ff3a95'} angle={.28} penumbra={.8} /></group>)}
  </group>;
}

export function Arena({ crowdCount = 156 }: { crowdCount?: number }) {
  const spotlight = useMatchStore((state) => state.model.chaosEvent?.type === 'SPOTLIGHT SHOWDOWN');
  const toyTest = useMatchStore((state) => state.model.toyTestMode);
  return <>
    <color attach="background" args={[spotlight ? '#020106' : '#070611']} />
    <fog attach="fog" args={[new Color('#090715'), 20, 42]} />
    <ambientLight intensity={spotlight ? .12 : .45} color="#786dff" />
    <hemisphereLight intensity={spotlight ? .15 : .62} color="#9aefff" groundColor="#160721" />
    <directionalLight castShadow position={[4, 12, 6]} intensity={spotlight ? .35 : 2.2} color="#f0f6ff" shadow-mapSize={[1024, 1024]} />
    <spotLight position={[-7, 11, -5]} intensity={spotlight ? 8 : 3} color="#4be7ff" angle={.42} penumbra={.65} castShadow />
    <spotLight position={[7, 10, 4]} intensity={spotlight ? 8 : 3} color="#ff3a95" angle={.42} penumbra={.7} />
    <RigidBody type="fixed" colliders="cuboid" position={[0, 1.52, 0]} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'ring' }}><mesh receiveShadow><boxGeometry args={[12, .65, 9]} /><meshStandardMaterial color="#202437" roughness={.68} /></mesh></RigidBody>
    <ReactiveMat />
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
    <SteelSteps />
    <RigidBody type="fixed" colliders="hull" position={[0, .2, 0]} collisionGroups={arenaCollisionGroups} solverGroups={arenaCollisionGroups} userData={{ surface: true, kind: 'floor' }}><mesh receiveShadow><cylinderGeometry args={[VOLT_DOME.floor.radius, VOLT_DOME.floor.radius, .4, 64]} /><meshStandardMaterial color="#100d1c" roughness={.8} /></mesh></RigidBody>
    <EntranceLane /><Barricades /><ArenaRibbon />{!toyTest && crowdCount > 0 && <Crowd count={crowdCount} />}<Props /><VoltDomeArchitecture /><Jumbotron />
    <group position={[0, 13, 0]}>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => <group key={angle} rotation={[0, angle, 0]}>
        <mesh position={[0, -.65, -7.75]} rotation={[.15, 0, 0]}><cylinderGeometry args={[.18, .36, .65, 10]} /><meshStandardMaterial color="#8eeeff" emissive="#41dcff" emissiveIntensity={2.4} /></mesh>
        <spotLight position={[0, -.8, -7.65]} intensity={4} color={angle % Math.PI === 0 ? '#4be7ff' : '#ff3a95'} angle={.3} penumbra={.8} />
      </group>)}
    </group>
    <group position={[0, 8.7, 0]}>{[-7.2, 7.2].flatMap((x) => [-5.8, 5.8].map((z) => <group key={`${x}-${z}`} position={[x, 0, z]}><mesh><cylinderGeometry args={[.13, .2, .44, 8]} /><meshStandardMaterial color="#adb8c7" metalness={.8} roughness={.2} /></mesh><pointLight position={[0, -.3, 0]} intensity={1.25} distance={10} color={x * z > 0 ? '#ff3f8f' : '#48e7ff'} /></group>))}</group>
    <BroadcastSet />
    <group position={[-10.7, .7, -6.4]}><mesh><boxGeometry args={[4.6, 1.25, .18]} /><meshStandardMaterial color="#272334" emissive="#27105b" emissiveIntensity={.18} /></mesh></group>
    <group position={[10.7, .7, 6.4]}><mesh><boxGeometry args={[4.6, 1.25, .18]} /><meshStandardMaterial color="#272334" emissive="#5b123a" emissiveIntensity={.18} /></mesh></group>
    <mesh position={[5.3, 2.3, -5.3]}><cylinderGeometry args={[.22, .3, .26, 16]} /><meshStandardMaterial color="#d7a940" metalness={.8} roughness={.22} /></mesh>
  </>;
}
