import { BallCollider, CapsuleCollider, CuboidCollider, RigidBody, useRevoluteJoint, useSphericalJoint } from '@react-three/rapier';
import type { CollisionEnterPayload, ContactForcePayload, RapierRigidBody } from '@react-three/rapier';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { fighterById } from '../data/fighters';
import { useMatchStore } from '../state/matchStore';
import type { FighterRuntime } from '../types/game';
import { buildBodySchema } from '../physics/bodySchema';
import type { BodySegmentId, BodySegmentSchema } from '../physics/bodySchema';
import { fighterCollisionGroups } from '../physics/collisionGroups';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { FighterKey } from '../physics/physicsRuntime';

interface Props { runtime: FighterRuntime; side: FighterKey }
interface RigUserData { bodyWorks: true; fighter: FighterKey; segment: BodySegmentId; region: BodySegmentSchema['bodyRegion']; surface?: boolean }
interface SurfaceUserData { surface: true; kind: string }

const isRigUserData = (value: unknown): value is RigUserData => typeof value === 'object' && value !== null && 'bodyWorks' in value;
const isSurfaceUserData = (value: unknown): value is SurfaceUserData => typeof value === 'object' && value !== null && 'surface' in value && 'kind' in value;

export function SegmentVisual({ schema, fighterId }: { schema: BodySegmentSchema; fighterId: FighterRuntime['definitionId'] }) {
  const fighter = fighterById(fighterId); const arm = schema.id.includes('Arm') || schema.id.includes('Forearm') || schema.id.includes('Hand'); const leg = schema.id.includes('Thigh') || schema.id.includes('Shin') || schema.id.includes('Foot');
  const costume = schema.id.includes('Forearm') || schema.id.includes('Shin') || schema.id.includes('Foot');
  const color = schema.id === 'pelvis' ? fighter.palette.secondary : schema.id === 'chest' || costume ? fighter.palette.primary : arm || leg || schema.id === 'head' || schema.id === 'abdomen' ? fighter.palette.skin : fighter.palette.primary;
  const material = <meshStandardMaterial color={color} roughness={.5} metalness={costume ? .28 : .08} emissive={fighter.palette.emissive} emissiveIntensity={costume ? .16 : .035} />;
  if (schema.id === 'head') return <group>
    <mesh castShadow><dodecahedronGeometry args={[schema.radius * 1.08, 1]} />{material}</mesh>
    <mesh position={[-.065, .035, .17]}><sphereGeometry args={[.025, 6, 5]} /><meshBasicMaterial color="#f8fbff" /></mesh><mesh position={[.065, .035, .17]}><sphereGeometry args={[.025, 6, 5]} /><meshBasicMaterial color="#f8fbff" /></mesh>
    <Headwear fighterId={fighterId} />
  </group>;
  if (schema.id.includes('Hand')) return <mesh castShadow><boxGeometry args={[schema.radius * 1.8, schema.halfLength * 1.8, schema.radius * 1.6]} />{material}</mesh>;
  if (schema.id.includes('Foot')) return <group><mesh castShadow position={[0, 0, .07]}><boxGeometry args={[schema.radius * 2.05, schema.radius, schema.halfLength * 2.7]} />{material}</mesh><mesh position={[0, -.065, .11]}><boxGeometry args={[schema.radius * 2.15, .035, schema.halfLength * 2.8]} /><meshStandardMaterial color={fighter.palette.emissive} emissive={fighter.palette.emissive} emissiveIntensity={.65} /></mesh></group>;
  if (['pelvis', 'abdomen', 'chest'].includes(schema.id)) return <group>
    <mesh castShadow scale={[schema.id === 'chest' ? 1.45 : 1.15, 1, schema.id === 'chest' ? 1.05 : .9]}><capsuleGeometry args={[schema.radius, schema.halfLength * 1.35, 6, 10]} />{material}</mesh>
    {schema.id === 'chest' && <><mesh position={[0, .03, schema.radius * 1.02]}><boxGeometry args={[schema.radius * 1.85, .08, .035]} /><meshStandardMaterial color={fighter.palette.secondary} emissive={fighter.palette.emissive} emissiveIntensity={.32} /></mesh><mesh position={[0, -.1, schema.radius * 1.02]}><octahedronGeometry args={[.11, 0]} /><meshStandardMaterial color={fighter.palette.emissive} emissive={fighter.palette.emissive} emissiveIntensity={.7} /></mesh></>}
  </group>;
  return <group><mesh castShadow><capsuleGeometry args={[schema.radius, schema.halfLength * 1.72, 6, 9]} />{material}</mesh>{costume && <mesh position={[0, schema.halfLength * .48, 0]}><torusGeometry args={[schema.radius * 1.03, .025, 5, 10]} /><meshStandardMaterial color={fighter.palette.secondary} emissive={fighter.palette.emissive} emissiveIntensity={.25} /></mesh>}</group>;
}

function Headwear({ fighterId }: { fighterId: FighterRuntime['definitionId'] }) {
  const fighter = fighterById(fighterId); const color = fighter.palette.emissive;
  if (fighter.proportions.headwear === 'mohawk') return <mesh position={[0, .22, 0]}><boxGeometry args={[.09, .24, .28]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.55} /></mesh>;
  if (fighter.proportions.headwear === 'crown') return <group position={[0, .2, 0]}>{[-.1, 0, .1].map((x) => <mesh key={x} position={[x, .08, 0]}><coneGeometry args={[.065, .22, 4]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.5} /></mesh>)}</group>;
  if (fighter.proportions.headwear === 'mask') return <mesh position={[0, .025, .18]}><boxGeometry args={[.3, .13, .035]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.45} /></mesh>;
  if (fighter.proportions.headwear === 'mullet') return <group><mesh position={[0, .16, -.04]}><sphereGeometry args={[.2, 8, 6]} /><meshStandardMaterial color="#382720" /></mesh><mesh position={[0, -.05, -.17]}><boxGeometry args={[.28, .33, .09]} /><meshStandardMaterial color="#382720" /></mesh><mesh position={[0, -.12, .16]}><dodecahedronGeometry args={[.14, 0]} /><meshStandardMaterial color="#39251e" /></mesh></group>;
  return <mesh position={[0, .19, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.18, .035, 5, 14]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.5} /></mesh>;
}

interface SegmentBodyProps {
  schema: BodySegmentSchema;
  fighterId: FighterRuntime['definitionId'];
  side: FighterKey;
  base: readonly [number, number, number];
  bodyRef: RefObject<RapierRigidBody | null>;
  onContactForce: (segment: BodySegmentSchema, bodyRef: RefObject<RapierRigidBody | null>, payload: ContactForcePayload) => void;
  onFootContact: (foot: BodySegmentId, touching: boolean, payload: CollisionEnterPayload) => void;
}

function SegmentBody({ schema, fighterId, side, base, bodyRef, onContactForce, onFootContact }: SegmentBodyProps) {
  const position: [number, number, number] = [base[0] + schema.localPosition[0], base[1] + schema.localPosition[1], base[2] + schema.localPosition[2]];
  const userData: RigUserData = { bodyWorks: true, fighter: side, segment: schema.id, region: schema.bodyRegion };
  const isFoot = schema.id === 'leftFoot' || schema.id === 'rightFoot'; const isHand = schema.id === 'leftHand' || schema.id === 'rightHand'; const isHead = schema.id === 'head';
  const collider: ReactNode = isHead ? <BallCollider args={[schema.radius]} mass={schema.massKg} />
    : isFoot || isHand ? <CuboidCollider args={[schema.radius, isFoot ? schema.radius * .5 : schema.halfLength, isFoot ? schema.halfLength * 1.35 : schema.radius]} mass={schema.massKg} friction={isFoot ? 1.45 : .72} restitution={.02} />
    : <CapsuleCollider args={[schema.halfLength, schema.radius]} mass={schema.massKg} friction={.76} restitution={.015} />;
  const isCore = schema.id === 'pelvis' || schema.id === 'abdomen' || schema.id === 'chest';
  return <RigidBody ref={bodyRef} name={`${side}-${schema.id}`} type="dynamic" position={position} colliders={false} collisionGroups={fighterCollisionGroups(side)} solverGroups={fighterCollisionGroups(side)} canSleep={false} linearDamping={.42} angularDamping={1.8} additionalSolverIterations={4} ccd={schema.attackEligible || isHead || isCore} userData={userData}
    onContactForce={(payload) => onContactForce(schema, bodyRef, payload)}
    onCollisionEnter={isFoot ? (payload) => onFootContact(schema.id, true, payload) : undefined}
    onCollisionExit={isFoot ? (payload) => onFootContact(schema.id, false, payload as CollisionEnterPayload) : undefined}>
    {collider}<SegmentVisual schema={schema} fighterId={fighterId} />
  </RigidBody>;
}

export function PhysicalFighterRig({ runtime, side }: Props) {
  const fighter = fighterById(runtime.definitionId); const schema = useMemo(() => buildBodySchema(fighter), [fighter]);
  const byId = useMemo(() => new Map(schema.map((entry) => [entry.id, entry])), [schema]);
  const pelvis = useRef<RapierRigidBody | null>(null); const abdomen = useRef<RapierRigidBody | null>(null); const chest = useRef<RapierRigidBody | null>(null); const head = useRef<RapierRigidBody | null>(null);
  const leftUpperArm = useRef<RapierRigidBody | null>(null); const rightUpperArm = useRef<RapierRigidBody | null>(null); const leftForearm = useRef<RapierRigidBody | null>(null); const rightForearm = useRef<RapierRigidBody | null>(null); const leftHand = useRef<RapierRigidBody | null>(null); const rightHand = useRef<RapierRigidBody | null>(null);
  const leftThigh = useRef<RapierRigidBody | null>(null); const rightThigh = useRef<RapierRigidBody | null>(null); const leftShin = useRef<RapierRigidBody | null>(null); const rightShin = useRef<RapierRigidBody | null>(null); const leftFoot = useRef<RapierRigidBody | null>(null); const rightFoot = useRef<RapierRigidBody | null>(null);
  const refs: Readonly<Record<BodySegmentId, RefObject<RapierRigidBody | null>>> = useMemo(() => ({ pelvis, abdomen, chest, head, leftUpperArm, rightUpperArm, leftForearm, rightForearm, leftHand, rightHand, leftThigh, rightThigh, leftShin, rightShin, leftFoot, rightFoot }), []);
  const jointRef = (ref: RefObject<RapierRigidBody | null>): RefObject<RapierRigidBody> => ref as RefObject<RapierRigidBody>;
  const value = (id: BodySegmentId): BodySegmentSchema => { const result = byId.get(id); if (!result) throw new Error(`Missing segment ${id}`); return result; };
  const shoulder = Math.abs(value('leftUpperArm').localPosition[0]); const hip = Math.abs(value('leftThigh').localPosition[0]);
  const anchorY = (parent: BodySegmentId, child: BodySegmentId): readonly [number, number] => {
    const halfDelta = (value(child).localPosition[1] - value(parent).localPosition[1]) * .5;
    return [halfDelta, -halfDelta];
  };
  const pelvisAbdomen = anchorY('pelvis', 'abdomen'); const abdomenChest = anchorY('abdomen', 'chest'); const chestHead = anchorY('chest', 'head');
  const chestUpperArm = anchorY('chest', 'leftUpperArm'); const upperForearm = anchorY('leftUpperArm', 'leftForearm'); const forearmHand = anchorY('leftForearm', 'leftHand');
  const pelvisThigh = anchorY('pelvis', 'leftThigh'); const thighShin = anchorY('leftThigh', 'leftShin'); const shinFoot = anchorY('leftShin', 'leftFoot');
  useSphericalJoint(jointRef(pelvis), jointRef(abdomen), [[0, pelvisAbdomen[0], 0], [0, pelvisAbdomen[1], 0]]);
  useSphericalJoint(jointRef(abdomen), jointRef(chest), [[0, abdomenChest[0], 0], [0, abdomenChest[1], 0]]);
  useSphericalJoint(jointRef(chest), jointRef(head), [[0, chestHead[0], 0], [0, chestHead[1], 0]]);
  useSphericalJoint(jointRef(chest), jointRef(leftUpperArm), [[-shoulder, chestUpperArm[0], 0], [0, chestUpperArm[1], 0]]);
  useSphericalJoint(jointRef(chest), jointRef(rightUpperArm), [[shoulder, chestUpperArm[0], 0], [0, chestUpperArm[1], 0]]);
  useRevoluteJoint(jointRef(leftUpperArm), jointRef(leftForearm), [[0, upperForearm[0], 0], [0, upperForearm[1], 0], [1, 0, 0], [-2.65, .08]]);
  useRevoluteJoint(jointRef(rightUpperArm), jointRef(rightForearm), [[0, upperForearm[0], 0], [0, upperForearm[1], 0], [1, 0, 0], [-2.65, .08]]);
  useSphericalJoint(jointRef(leftForearm), jointRef(leftHand), [[0, forearmHand[0], 0], [0, forearmHand[1], 0]]);
  useSphericalJoint(jointRef(rightForearm), jointRef(rightHand), [[0, forearmHand[0], 0], [0, forearmHand[1], 0]]);
  useSphericalJoint(jointRef(pelvis), jointRef(leftThigh), [[-hip, pelvisThigh[0], 0], [0, pelvisThigh[1], 0]]);
  useSphericalJoint(jointRef(pelvis), jointRef(rightThigh), [[hip, pelvisThigh[0], 0], [0, pelvisThigh[1], 0]]);
  useRevoluteJoint(jointRef(leftThigh), jointRef(leftShin), [[0, thighShin[0], 0], [0, thighShin[1], 0], [1, 0, 0], [-.08, 2.58]]);
  useRevoluteJoint(jointRef(rightThigh), jointRef(rightShin), [[0, thighShin[0], 0], [0, thighShin[1], 0], [1, 0, 0], [-.08, 2.58]]);
  useRevoluteJoint(jointRef(leftShin), jointRef(leftFoot), [[0, shinFoot[0], 0], [0, shinFoot[1], -.03], [1, 0, 0], [-.58, .68]]);
  useRevoluteJoint(jointRef(rightShin), jointRef(rightFoot), [[0, shinFoot[0], 0], [0, shinFoot[1], -.03], [1, 0, 0], [-.58, .68]]);

  useEffect(() => {
    const bodies: Partial<Record<BodySegmentId, RapierRigidBody>> = {};
    for (const [id, ref] of Object.entries(refs) as [BodySegmentId, RefObject<RapierRigidBody | null>][]) if (ref.current) bodies[id] = ref.current;
    return bodyWorksRuntime.registerFighter(side, bodies, 15);
  }, [refs, side]);
  const onContactForce = useCallback((segment: BodySegmentSchema, bodyRef: RefObject<RapierRigidBody | null>, payload: ContactForcePayload): void => {
    const otherData = payload.other.rigidBodyObject?.userData; const target = isRigUserData(otherData) ? otherData : null;
    const landingCandidate = !target && bodyWorksRuntime.isAwaitingLanding(side);
    if (target?.fighter === side || (!landingCandidate && !segment.attackEligible && payload.totalForceMagnitude < 420)) return;
    const ownVelocity = bodyRef.current?.linvel() ?? { x: 0, y: 0, z: 0 }; const otherVelocity = payload.other.rigidBody?.linvel() ?? { x: 0, y: 0, z: 0 };
    const sourceRuntime = useMatchStore.getState().model[side];
    const activeAttack = sourceRuntime.attackPhase === 'active' && sourceRuntime.moveId !== null;
    bodyWorksRuntime.recordContact({
      time: useMatchStore.getState().model.elapsed, sourceFighter: side, sourceSegment: segment.id,
      targetFighter: target?.fighter ?? null, targetSegment: target?.segment ?? null, targetRegion: target?.region ?? segment.bodyRegion,
      totalForce: payload.totalForceMagnitude, maximumForce: payload.maxForceMagnitude,
      forceDirection: [payload.maxForceDirection.x, payload.maxForceDirection.y, payload.maxForceDirection.z],
      relativeSpeed: Math.hypot(ownVelocity.x - otherVelocity.x, ownVelocity.y - otherVelocity.y, ownVelocity.z - otherVelocity.z),
      attackInstanceId: activeAttack ? sourceRuntime.attackInstanceId : null,
      moveId: activeAttack ? sourceRuntime.moveId : null,
      sourceObjectId: null,
      targetSurface: isSurfaceUserData(otherData) ? otherData.kind : null,
      isLanding: false,
    });
  }, [side]);
  const onFootContact = useCallback((foot: BodySegmentId, touching: boolean, payload: CollisionEnterPayload): void => {
    const otherData = payload.other.rigidBodyObject?.userData;
    if (!isRigUserData(otherData) || otherData.fighter !== side) bodyWorksRuntime.setFootContact(side, foot, touching);
  }, [side]);
  const base = useMemo(() => [runtime.position.x, 1.92, runtime.position.z] as const, [runtime.position.x, runtime.position.z]);
  return <group>{schema.map((entry) => <SegmentBody key={entry.id} schema={entry} fighterId={runtime.definitionId} side={side} base={base} bodyRef={refs[entry.id]} onContactForce={onContactForce} onFootContact={onFootContact} />)}</group>;
}
