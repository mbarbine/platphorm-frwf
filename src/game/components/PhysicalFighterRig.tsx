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
import { strikeDriveProfile } from '../physics/strikeDynamics';
import { fighterVisual } from '../presentation/fighterVisuals';

interface Props { runtime: FighterRuntime; side: FighterKey; showVisuals?: boolean }
interface RigUserData {
  bodyWorks: true;
  fighter: FighterKey;
  segment: BodySegmentId;
  region: BodySegmentSchema['bodyRegion'];
  side: BodySegmentSchema['side'];
  colliderRole: BodySegmentSchema['colliderRole'];
  damageMultiplier: number;
  gripAnchorEligible: boolean;
  surface?: boolean;
}
interface SurfaceUserData { surface: true; kind: string }

const isRigUserData = (value: unknown): value is RigUserData => typeof value === 'object' && value !== null && 'bodyWorks' in value;
const isSurfaceUserData = (value: unknown): value is SurfaceUserData => typeof value === 'object' && value !== null && 'surface' in value && 'kind' in value;

export function SegmentVisual({ schema, fighterId }: { schema: BodySegmentSchema; fighterId: FighterRuntime['definitionId'] }) {
  const fighter = fighterById(fighterId); const profile = fighterVisual(fighterId); const arm = schema.id.includes('Arm') || schema.id.includes('Forearm') || schema.id.includes('Hand'); const leg = schema.id.includes('Thigh') || schema.id.includes('Shin') || schema.id.includes('Foot');
  const costume = schema.id.includes('Forearm') || schema.id.includes('Shin') || schema.id.includes('Foot');
  const color = schema.id === 'pelvis' ? fighter.palette.secondary : schema.id === 'chest' || costume ? fighter.palette.primary : arm || leg || schema.id === 'head' || schema.id === 'abdomen' ? fighter.palette.skin : fighter.palette.primary;
  const material = <meshStandardMaterial color={color} roughness={.5} metalness={costume ? .28 : .08} emissive={fighter.palette.emissive} emissiveIntensity={costume ? .16 : .035} />;
  if (schema.id === 'head') return <group>
    <mesh castShadow scale={[1.03 * profile.headScale[0], 1.14 * profile.headScale[1], 1.02 * profile.headScale[2]]}><sphereGeometry args={[schema.radius * 1.08, 16, 11]} />{material}</mesh>
    <mesh position={[0, -.105, .105]} scale={[.82, .48, .72]}><sphereGeometry args={[schema.radius, 13, 8]} />{material}</mesh>
    {[-1, 1].map((faceSide) => <group key={faceSide} position={[faceSide * .066, .03, .178]}>
      <mesh scale={[.035, .025, .018]}><sphereGeometry args={[1, 9, 7]} /><meshStandardMaterial color="#f6f2ec" roughness={.35} /></mesh>
      <mesh position={[0, 0, .016]} scale={[.014, .015, .009]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={profile.eyeColor} emissive={profile.eyeColor} emissiveIntensity={.18} /></mesh>
      <mesh position={[0, .053, .007]} rotation={[0, 0, faceSide * -.12]}><boxGeometry args={[.07, .014, .016]} /><meshStandardMaterial color={profile.browColor} roughness={.9} /></mesh>
    </group>)}
    <mesh position={[0, -.01, .195]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.028, .07, 7]} />{material}</mesh>
    <mesh position={[0, -.09, .19]} scale={[.065, .012, .012]}><sphereGeometry args={[1, 10, 5]} /><meshStandardMaterial color="#5b1f31" roughness={.7} /></mesh>
    {[-1, 1].map((earSide) => <mesh key={earSide} position={[earSide * .196, .005, 0]} scale={[.035, .055, .025]}><sphereGeometry args={[1, 9, 6]} />{material}</mesh>)}
    <Headwear fighterId={fighterId} />
  </group>;
  if (schema.id.includes('Hand')) return <group>
    <mesh castShadow scale={[1, 1, .92]}><capsuleGeometry args={[schema.radius * .88, schema.halfLength * 1.25, 6, 10]} />{material}</mesh>
    <mesh position={[0, schema.halfLength * .78, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[schema.radius * .86, .025, 6, 14]} /><meshStandardMaterial color={fighter.palette.secondary} metalness={.28} roughness={.48} /></mesh>
    {[-.052, -.017, .017, .052].map((x) => <mesh key={x} position={[x, -schema.halfLength * .72, .045]}><capsuleGeometry args={[.019, .055, 4, 6]} />{material}</mesh>)}
  </group>;
  if (schema.id.includes('Foot')) return <group><mesh castShadow position={[0, 0, .07]}><boxGeometry args={[schema.radius * 2.05, schema.radius, schema.halfLength * 2.7]} />{material}</mesh><mesh position={[0, -.065, .11]}><boxGeometry args={[schema.radius * 2.15, .035, schema.halfLength * 2.8]} /><meshStandardMaterial color={fighter.palette.emissive} emissive={fighter.palette.emissive} emissiveIntensity={.65} /></mesh></group>;
  if (['pelvis', 'abdomen', 'chest'].includes(schema.id)) return <group>
    <mesh castShadow scale={[schema.id === 'chest' ? 1.45 * profile.chestScale : schema.id === 'pelvis' ? 1.22 * profile.waistScale : 1.1 * profile.waistScale, 1, schema.id === 'chest' ? 1.05 : .9]}><capsuleGeometry args={[schema.radius, schema.halfLength * 1.35, 8, 14]} />{material}</mesh>
    {schema.id === 'chest' && <><mesh position={[0, .03, schema.radius * 1.02]}><boxGeometry args={[schema.radius * 1.85, .08, .035]} /><meshStandardMaterial color={fighter.palette.secondary} emissive={fighter.palette.emissive} emissiveIntensity={.32} /></mesh><mesh position={[0, -.1, schema.radius * 1.02]}><octahedronGeometry args={[.11, 0]} /><meshStandardMaterial color={fighter.palette.emissive} emissive={fighter.palette.emissive} emissiveIntensity={.7} /></mesh></>}
    {schema.id === 'abdomen' && [-.07, .07].map((x) => <mesh key={x} position={[x, 0, schema.radius * .91]} scale={[.052, .12, .025]}><sphereGeometry args={[1, 9, 6]} /><meshStandardMaterial color={fighter.palette.skin} roughness={profile.skinRoughness * .9} /></mesh>)}
    {schema.id === 'pelvis' && <><mesh position={[0, .03, schema.radius * .92]} scale={[.98, .62, .42]}><sphereGeometry args={[schema.radius, 13, 8]} /><meshStandardMaterial color={fighter.palette.secondary} roughness={.78} metalness={.05} /></mesh><mesh position={[0, schema.halfLength * .7, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[schema.radius * 1.12, .035, 7, 18]} /><meshStandardMaterial color={fighter.palette.emissive} emissive={fighter.palette.emissive} emissiveIntensity={.22} /></mesh></>}
  </group>;
  return <group><mesh castShadow scale={[arm ? profile.armScale : leg ? schema.id.includes('Thigh') ? profile.thighScale : profile.calfScale : 1, 1, arm ? profile.armScale : 1]}><capsuleGeometry args={[schema.radius, schema.halfLength * 1.72, 7, 12]} />{material}</mesh><mesh position={[0, schema.halfLength * .92, 0]} scale={[schema.radius * 1.1, schema.radius * .72, schema.radius * 1.1]}><sphereGeometry args={[1, 10, 7]} />{material}</mesh>{costume && <mesh position={[0, schema.halfLength * .48, 0]}><torusGeometry args={[schema.radius * 1.03, .025, 5, 10]} /><meshStandardMaterial color={fighter.palette.secondary} emissive={fighter.palette.emissive} emissiveIntensity={.25} /></mesh>}</group>;
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
  showVisuals: boolean;
}

function SegmentBody({ schema, fighterId, side, base, bodyRef, onContactForce, onFootContact, showVisuals }: SegmentBodyProps) {
  const position: [number, number, number] = [base[0] + schema.localPosition[0], base[1] + schema.localPosition[1], base[2] + schema.localPosition[2]];
  const userData: RigUserData = {
    bodyWorks: true,
    fighter: side,
    segment: schema.id,
    region: schema.bodyRegion,
    side: schema.side,
    colliderRole: schema.colliderRole,
    damageMultiplier: schema.damageMultiplier,
    gripAnchorEligible: schema.gripAnchorEligible,
  };
  const isFoot = schema.id === 'leftFoot' || schema.id === 'rightFoot'; const isHand = schema.id === 'leftHand' || schema.id === 'rightHand'; const isHead = schema.id === 'head';
  const collider: ReactNode = isHead ? <BallCollider args={[schema.radius]} mass={schema.massKg} />
    : isFoot || isHand ? <CuboidCollider args={[schema.radius, isFoot ? schema.radius * .5 : schema.halfLength, isFoot ? schema.halfLength * 1.35 : schema.radius]} mass={schema.massKg} friction={isFoot ? 1.45 : .72} restitution={.02} />
    : <CapsuleCollider args={[schema.halfLength, schema.radius]} mass={schema.massKg} friction={.76} restitution={.015} />;
  const isCore = schema.id === 'pelvis' || schema.id === 'abdomen' || schema.id === 'chest';
  return <RigidBody ref={bodyRef} name={`${side}-${schema.id}`} type="dynamic" position={position} colliders={false} collisionGroups={fighterCollisionGroups(side)} solverGroups={fighterCollisionGroups(side)} canSleep linearDamping={.55} angularDamping={2.2} additionalSolverIterations={4} enabledRotations={[false, false, false]} ccd={schema.attackEligible || isHead || isCore} userData={userData}
    onContactForce={(payload) => onContactForce(schema, bodyRef, payload)}
    onCollisionEnter={isFoot ? (payload) => onFootContact(schema.id, true, payload) : undefined}
    onCollisionExit={isFoot ? (payload) => onFootContact(schema.id, false, payload as CollisionEnterPayload) : undefined}>
    {collider}{showVisuals && <SegmentVisual schema={schema} fighterId={fighterId} />}
  </RigidBody>;
}

export function PhysicalFighterRig({ runtime, side, showVisuals = true }: Props) {
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
    if (target?.fighter === side) return;
    const ownVelocity = bodyRef.current?.linvel() ?? { x: 0, y: 0, z: 0 }; const ownPosition = bodyRef.current?.translation() ?? { x: 0, y: 0, z: 0 }; const otherVelocity = payload.other.rigidBody?.linvel() ?? { x: 0, y: 0, z: 0 };
    const sourceRuntime = useMatchStore.getState().model[side];
    const activeAttack = sourceRuntime.attackPhase === 'active' && sourceRuntime.moveId !== null;
    const strikeProfile = activeAttack && sourceRuntime.moveId ? strikeDriveProfile(sourceRuntime.moveId) : null;
    const directionalStiffArm = sourceRuntime.moveId === 'stiff_arm' || sourceRuntime.moveId === 'rebound';
    const chestLedDive = sourceRuntime.moveId === 'aerial' && ['chest', 'abdomen', 'pelvis', 'leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm', 'leftHand', 'rightHand', 'leftThigh', 'rightThigh', 'leftShin', 'rightShin', 'leftFoot', 'rightFoot'].includes(segment.id);
    const activeContactLimb = Boolean(strikeProfile && (strikeProfile.source === segment.id
      || directionalStiffArm && ['leftForearm', 'rightForearm', 'leftHand', 'rightHand', 'leftUpperArm', 'rightUpperArm'].includes(segment.id)
      || chestLedDive));
    // Shipping damage is emitted only by the move's active physical limb. A
    // nearby foot, shoulder, or authored animation phase cannot impersonate a
    // jab contact. Environmental contacts remain eligible only while a real
    // released throw is awaiting its landing surface.
    if (target && !activeContactLimb) return;
    if (!target && !landingCandidate) return;
    bodyWorksRuntime.recordContact({
      time: useMatchStore.getState().model.elapsed, sourceFighter: side, sourceSegment: segment.id,
      targetFighter: target?.fighter ?? null, targetSegment: target?.segment ?? null, targetRegion: target?.region ?? segment.bodyRegion,
      totalForce: payload.totalForceMagnitude, maximumForce: payload.maxForceMagnitude,
      forceDirection: [payload.maxForceDirection.x, payload.maxForceDirection.y, payload.maxForceDirection.z],
      point: [ownPosition.x, ownPosition.y, ownPosition.z],
      relativeSpeed: Math.hypot(ownVelocity.x - otherVelocity.x, ownVelocity.y - otherVelocity.y, ownVelocity.z - otherVelocity.z),
      attackInstanceId: activeContactLimb ? sourceRuntime.attackInstanceId : null,
      moveId: activeContactLimb ? sourceRuntime.moveId : null,
      attackPhaseAtContact: activeContactLimb ? 'active' : null,
      sourceObjectId: null,
      targetSurface: isSurfaceUserData(otherData) ? otherData.kind : null,
      isLanding: false,
    });
  }, [side]);
  const onFootContact = useCallback((foot: BodySegmentId, touching: boolean, payload: CollisionEnterPayload): void => {
    const otherData = payload.other.rigidBodyObject?.userData;
    if (!isRigUserData(otherData) || otherData.fighter !== side) bodyWorksRuntime.setFootContact(side, foot, touching);
  }, [side]);
  // Ring deck top is 1.845 m; this base places the compact foot collider sole
  // on the mat instead of suspending both feet above the support surface.
  const base = useMemo(() => [runtime.position.x, 1.8, runtime.position.z] as const, [runtime.position.x, runtime.position.z]);
  return <group>{schema.map((entry) => <SegmentBody key={entry.id} schema={entry} fighterId={runtime.definitionId} side={side} base={base} bodyRef={refs[entry.id]} onContactForce={onContactForce} onFootContact={onFootContact} showVisuals={showVisuals} />)}</group>;
}
