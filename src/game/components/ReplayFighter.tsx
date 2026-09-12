import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { PhysicsReplayFrame } from '../physics/replayBuffer';
import { useSettings } from '../state/settings';
import { useMatchStore } from '../state/matchStore';
import { PropVisual } from './Arena';
import { SegmentVisual } from './PhysicalFighterRig';
import { buildBodySchema } from '../physics/bodySchema';
import type { BodySegmentId } from '../physics/bodySchema';
import { fighterById } from '../data/fighters';
import type { FighterId } from '../types/game';

const PLAYBACK_SECONDS = 3.85;

function RecordedPhysicalFighter({ frameRef, side, fighterId }: { frameRef: React.RefObject<PhysicsReplayFrame | null>; side: 'player' | 'opponent'; fighterId: FighterId }) {
  const segments = useMemo(() => buildBodySchema(fighterById(fighterId)), [fighterId]);
  const bodies = useRef<Partial<Record<BodySegmentId, Group | null>>>({});
  useFrame(() => {
    const transforms = frameRef.current?.fighters[side]; if (!transforms) return;
    for (const segment of segments) {
      const group = bodies.current[segment.id]; const transform = transforms[segment.id]; if (!group || !transform) continue;
      group.position.set(transform.position.x, transform.position.y, transform.position.z);
      group.quaternion.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
      group.visible = true;
    }
  }, -1);
  return <>{segments.map((segment) => <group key={segment.id} ref={(node) => { bodies.current[segment.id] = node; }} visible={false}><SegmentVisual schema={segment} fighterId={fighterId} /></group>)}</>;
}

function RecordedProps({ frameRef }: { frameRef: React.RefObject<PhysicsReplayFrame | null> }) {
  const matchProps = useMatchStore((state) => state.model.props); const props = useMemo(() => matchProps.filter((prop) => prop.kind !== 'table'), [matchProps]);
  const bodies = useRef<Record<string, Group | null>>({});
  useFrame(() => {
    const transforms = frameRef.current?.props; if (!transforms) return;
    for (const prop of props) {
      const group = bodies.current[prop.id]; const transform = transforms[prop.id]; if (!group || !transform) continue;
      group.position.set(transform.position.x, transform.position.y, transform.position.z);
      group.quaternion.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
      group.visible = true;
    }
  }, -1);
  return <group>{props.map((prop) => <group key={prop.id} ref={(node) => { bodies.current[prop.id] = node; }} visible={false}>
    <PropVisual kind={prop.kind} />
  </group>)}</group>;
}

export function ReplayDirector() {
  const active = useMatchStore((state) => state.replayActive); const lastImpact = useMatchStore((state) => state.model.lastImpact);
  const playerId = useMatchStore((state) => state.model.player.definitionId); const opponentId = useMatchStore((state) => state.model.opponent.definitionId);
  const automaticReplays = useSettings((state) => state.automaticReplays);
  const reducedMotion = useSettings((state) => state.reducedMotion);
  const replayedImpact = useRef(0); const physicsFrames = useRef<readonly PhysicsReplayFrame[]>([]); const elapsed = useRef(0); const physicsFrame = useRef<PhysicsReplayFrame | null>(null);
  useEffect(() => {
    if (!lastImpact || lastImpact.id === replayedImpact.current || reducedMotion || !automaticReplays) return;
    // A physical landing can emit both its move impact and its mat/body response
    // while a replay is already open. Treat those as part of the current spot so
    // Skip never closes one overlay only to immediately queue another.
    if (active) { replayedImpact.current = lastImpact.id; return; }
    const majorSlam = lastImpact.kind === 'grapple' && ['slam', 'piledriver', 'powerbomb', 'spinebuster', 'mountain_drop', 'skyhook', 'suplex'].includes(lastImpact.moveId ?? '');
    const replayWorthy = majorSlam || lastImpact.kind === 'finisher' || lastImpact.kind === 'table' || lastImpact.kind === 'ko';
    if (!replayWorthy || bodyWorksRuntime.replay.size < 45) return;
    replayedImpact.current = lastImpact.id; useMatchStore.getState().startReplay();
  }, [active, automaticReplays, lastImpact, reducedMotion]);
  useEffect(() => {
    if (!active) { physicsFrame.current = null; return; }
    physicsFrames.current = bodyWorksRuntime.replay.chronological().slice(-150);
    elapsed.current = 0; physicsFrame.current = physicsFrames.current[0] ?? null;
  }, [active]);
  useFrame((_, dt) => {
    if (!active || physicsFrames.current.length === 0) return;
    elapsed.current += Math.min(dt, .05);
    const physicsTail = Math.min(20, Math.max(1, physicsFrames.current.length - 1)); const physicsLead = physicsFrames.current.length - physicsTail;
    const physicsIndex = elapsed.current < 2.2 ? Math.floor(elapsed.current / 2.2 * physicsLead) : physicsLead + Math.floor((elapsed.current - 2.2) * 30 * .4);
    physicsFrame.current = physicsFrames.current[Math.min(physicsFrames.current.length - 1, physicsIndex)] ?? null;
    if (elapsed.current >= PLAYBACK_SECONDS) useMatchStore.getState().stopReplay();
  }, -2);
  return <group visible={active}><RecordedPhysicalFighter frameRef={physicsFrame} side="player" fighterId={playerId} /><RecordedPhysicalFighter frameRef={physicsFrame} side="opponent" fighterId={opponentId} /><RecordedProps frameRef={physicsFrame} /></group>;
}
