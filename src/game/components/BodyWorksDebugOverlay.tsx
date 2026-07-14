import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import type { BodySegmentId } from '../physics/bodySchema';
import type { FighterKey } from '../physics/physicsRuntime';
import { getMove } from '../data/moves';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { isRingside } from '../physics/ringDynamics';
import { useMatchStore } from '../state/matchStore';

const UP = new Vector3(0, 1, 0);
const ALIGNMENT_SEGMENTS = ['head', 'chest', 'pelvis', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot'] as const satisfies readonly BodySegmentId[];
const ALIGNMENT_LINKS = (['player', 'opponent'] as const).flatMap((fighter) => ALIGNMENT_SEGMENTS.map((segment) => ({ key: `${fighter}-${segment}`, fighter, segment })));

/** Imperative Physics Lab markers; no per-step React state or geometry churn. */
export function BodyWorksDebugOverlay() {
  const playerCom = useRef<Group>(null); const opponentCom = useRef<Group>(null); const playerProjection = useRef<Group>(null); const opponentProjection = useRef<Group>(null);
  const gripBeam = useRef<Mesh>(null); const attackWindow = useRef<Group>(null); const impact = useRef<Group>(null);
  const alignmentBeams = useRef<Record<string, Mesh | null>>({}); const alignmentMarkers = useRef<Record<string, Mesh | null>>({});
  const start = useMemo(() => new Vector3(), []); const end = useMemo(() => new Vector3(), []); const direction = useMemo(() => new Vector3(), []); const midpoint = useMemo(() => new Vector3(), []);
  useFrame(({ clock }) => {
    const model = useMatchStore.getState().model; const player = bodyWorksRuntime.fighterSnapshot('player'); const opponent = bodyWorksRuntime.fighterSnapshot('opponent');
    playerCom.current?.position.set(model.player.position.x, player.pelvisY, model.player.position.z); opponentCom.current?.position.set(model.opponent.position.x, opponent.pelvisY, model.opponent.position.z);
    playerProjection.current?.position.set(model.player.position.x, isRingside(model.player.position) ? .43 : 1.93, model.player.position.z);
    opponentProjection.current?.position.set(model.opponent.position.x, isRingside(model.opponent.position) ? .43 : 1.93, model.opponent.position.z);
    if (gripBeam.current) {
      gripBeam.current.visible = Boolean(model.grapple);
      if (model.grapple) {
        start.set(model.player.position.x, player.pelvisY + .48, model.player.position.z); end.set(model.opponent.position.x, opponent.pelvisY + .48, model.opponent.position.z);
        direction.subVectors(end, start); const distance = Math.max(.001, direction.length()); midpoint.addVectors(start, end).multiplyScalar(.5);
        gripBeam.current.position.copy(midpoint); gripBeam.current.scale.set(1, distance, 1); gripBeam.current.quaternion.setFromUnitVectors(UP, direction.normalize());
      }
    }
    if (attackWindow.current) {
      const move = model.player.moveId ? getMove(model.player.moveId) : null; attackWindow.current.visible = model.player.attackPhase === 'active' && Boolean(move);
      attackWindow.current.position.set(model.player.position.x, isRingside(model.player.position) ? .48 : 1.98, model.player.position.z);
      if (move) attackWindow.current.scale.setScalar(move.maximumRange);
    }
    if (impact.current) {
      impact.current.visible = Boolean(model.lastImpact); if (model.lastImpact) impact.current.position.set(model.lastImpact.position.x, isRingside(model.lastImpact.position) ? .6 : 2.12, model.lastImpact.position.z);
      impact.current.scale.setScalar(.75 + Math.sin(clock.elapsedTime * 18) * .22);
    }
    for (const link of ALIGNMENT_LINKS) {
      const beam = alignmentBeams.current[link.key]; const marker = alignmentMarkers.current[link.key];
      const physical = bodyWorksRuntime.segmentSnapshot(link.fighter as FighterKey, link.segment)?.position;
      const presentation = bodyWorksRuntime.presentationPoint(link.fighter as FighterKey, link.segment);
      if (!beam || !marker || !physical || !presentation) {
        if (beam) beam.visible = false;
        if (marker) marker.visible = false;
        continue;
      }
      start.set(presentation.x, presentation.y, presentation.z); end.set(physical.x, physical.y, physical.z);
      direction.subVectors(end, start); const distance = Math.max(.001, direction.length()); midpoint.addVectors(start, end).multiplyScalar(.5);
      const color = distance > .48 ? '#ff315f' : distance > .22 ? '#ffae35' : '#5dffad';
      beam.visible = true; beam.position.copy(midpoint); beam.scale.set(1, distance, 1); beam.quaternion.setFromUnitVectors(UP, direction.normalize());
      (beam.material as MeshBasicMaterial).color.set(color);
      marker.visible = true; marker.position.copy(end); (marker.material as MeshBasicMaterial).color.set(color);
    }
  });
  const com = (color: string) => <><mesh><sphereGeometry args={[.12, 8, 6]} /><meshBasicMaterial color={color} depthTest={false} /></mesh><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.32, .025, 5, 20]} /><meshBasicMaterial color={color} depthTest={false} /></mesh></>;
  const projection = (color: string) => <><mesh rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[.18, .28, 20]} /><meshBasicMaterial color={color} transparent opacity={.9} depthTest={false} /></mesh><mesh position={[0, .015, 0]}><boxGeometry args={[.75, .025, .48]} /><meshBasicMaterial color={color} transparent opacity={.16} depthTest={false} /></mesh></>;
  return <group renderOrder={50}>
    <group ref={playerCom}>{com('#dfff45')}</group><group ref={opponentCom}>{com('#ff3f91')}</group>
    <group ref={playerProjection}>{projection('#dfff45')}</group><group ref={opponentProjection}>{projection('#ff3f91')}</group>
    <mesh ref={gripBeam} visible={false}><cylinderGeometry args={[.022, .022, 1, 6]} /><meshBasicMaterial color="#48e7ff" transparent opacity={.9} depthTest={false} /></mesh>
    <group ref={attackWindow} visible={false}><mesh rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[.94, 1, 32]} /><meshBasicMaterial color="#ffb33d" transparent opacity={.5} depthTest={false} /></mesh></group>
    <group ref={impact} visible={false}><mesh rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[.26, .34, 16]} /><meshBasicMaterial color="#ffffff" depthTest={false} /></mesh></group>
    {ALIGNMENT_LINKS.map((link) => <group key={link.key}>
      <mesh ref={(node) => { alignmentBeams.current[link.key] = node; }} visible={false}><cylinderGeometry args={[.012, .012, 1, 6]} /><meshBasicMaterial color="#5dffad" transparent opacity={.82} depthTest={false} /></mesh>
      <mesh ref={(node) => { alignmentMarkers.current[link.key] = node; }} visible={false}><sphereGeometry args={[.055, 8, 6]} /><meshBasicMaterial color="#5dffad" transparent opacity={.9} depthTest={false} /></mesh>
    </group>)}
  </group>;
}
