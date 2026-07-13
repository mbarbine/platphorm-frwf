import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { fighterById } from '../data/fighters';
import { buildBodySchema } from '../physics/bodySchema';
import type { BodySegmentId } from '../physics/bodySchema';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { FighterKey } from '../physics/physicsRuntime';
import type { PhysicsReplayFrame } from '../physics/replayBuffer';
import { useSettings } from '../state/settings';
import { useMatchStore } from '../state/matchStore';
import { SegmentVisual } from './PhysicalFighterRig';

const PLAYBACK_SECONDS = 3.85;

function RecordedFighter({ side, frameRef }: { side: FighterKey; frameRef: React.RefObject<PhysicsReplayFrame | null> }) {
  const fighterId = useMatchStore((state) => state.model[side].definitionId);
  const schema = useMemo(() => buildBodySchema(fighterById(fighterId)), [fighterId]);
  const segments = useRef<Partial<Record<BodySegmentId, Group>>>({});
  useFrame(() => {
    const transforms = frameRef.current?.fighters[side]; if (!transforms) return;
    for (const segment of schema) {
      const group = segments.current[segment.id]; const transform = transforms[segment.id]; if (!group || !transform) continue;
      group.position.set(transform.position.x, transform.position.y, transform.position.z);
      group.quaternion.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
    }
  }, -1);
  return <group>{schema.map((segment) => <group key={segment.id} ref={(node) => { if (node) segments.current[segment.id] = node; }}><SegmentVisual schema={segment} fighterId={fighterId} /></group>)}</group>;
}

export function ReplayDirector() {
  const active = useMatchStore((state) => state.replayActive); const lastImpact = useMatchStore((state) => state.model.lastImpact);
  const reducedMotion = useSettings((state) => state.reducedMotion);
  const replayedImpact = useRef(0); const frames = useRef<readonly PhysicsReplayFrame[]>([]); const elapsed = useRef(0); const frame = useRef<PhysicsReplayFrame | null>(null);
  useEffect(() => {
    if (!lastImpact || lastImpact.id === replayedImpact.current || active || reducedMotion) return;
    const replayWorthy = lastImpact.kind === 'finisher' || lastImpact.kind === 'table' || lastImpact.kind === 'ko' || lastImpact.intensity >= 2.05;
    if (!replayWorthy || bodyWorksRuntime.replay.size < 45) return;
    replayedImpact.current = lastImpact.id; useMatchStore.getState().startReplay();
  }, [active, lastImpact, reducedMotion]);
  useEffect(() => {
    if (!active) { frame.current = null; return; }
    frames.current = bodyWorksRuntime.replay.chronological().slice(-150); elapsed.current = 0; frame.current = frames.current[0] ?? null;
  }, [active]);
  useFrame((_, dt) => {
    if (!active || frames.current.length === 0) return;
    elapsed.current += Math.min(dt, .05);
    const slowTail = Math.min(20, Math.max(1, frames.current.length - 1)); const leadFrames = frames.current.length - slowTail;
    const index = elapsed.current < 2.2
      ? Math.floor(elapsed.current / 2.2 * leadFrames)
      : leadFrames + Math.floor((elapsed.current - 2.2) * 30 * .4);
    frame.current = frames.current[Math.min(frames.current.length - 1, index)] ?? null;
    if (elapsed.current >= PLAYBACK_SECONDS) useMatchStore.getState().stopReplay();
  }, -2);
  return <group visible={active}><RecordedFighter side="player" frameRef={frame} /><RecordedFighter side="opponent" frameRef={frame} /></group>;
}
