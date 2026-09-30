import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { PhysicsReplayFrame } from '../physics/replayBuffer';
import { useSettings } from '../state/settings';
import { useMatchStore } from '../state/matchStore';
import { PropVisual } from './Arena';
import { HumanoidFighter } from './HumanoidFighter';
import { FIGHTER_SLOTS, type FighterSlot } from '../types/game';
import { replayPresentation, sampleReplayFrame } from '../physics/replayBuffer';

const PLAYBACK_SECONDS = 3.85;
const MAJOR_SLAM_MOVES = new Set(['slam', 'piledriver', 'powerbomb', 'spinebuster', 'mountain_drop', 'skyhook', 'suplex']);


function RecordedProps({ frameRef }: { frameRef: React.RefObject<PhysicsReplayFrame | null> }) {
  const matchProps = useMatchStore((state) => state.model.props); const props = useMemo(() => matchProps.filter((prop) => prop.kind !== 'table'), [matchProps]);
  const propIds = useMemo(() => props.map((p) => p.id), [props]);
  const bodies = useRef<Record<string, Group | null>>({});
  useFrame(() => {
    const transforms = frameRef.current?.props; if (!transforms) return;
    // OPTIMIZATION: Use indexed for loop over pre-memoized prop IDs to avoid iterator allocations inside useFrame
    for (let i = 0; i < propIds.length; i++) {
      const id = propIds[i]; if (!id) continue;
      const group = bodies.current[id]; const transform = transforms[id]; if (!group || !transform) continue;
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
  const model = useMatchStore(state => state.model);
  const automaticReplays = useSettings((state) => state.automaticReplays);
  const reducedMotion = useSettings((state) => state.reducedMotion);
  const replayRuntime = useRef(model.runtimeId);
  const replayedImpact = useRef(0); const physicsFrames = useRef<readonly PhysicsReplayFrame[]>([]); const elapsed = useRef(0); const physicsFrame = useRef<PhysicsReplayFrame | null>(null);
  useEffect(() => {
    if (replayRuntime.current !== model.runtimeId) { replayRuntime.current = model.runtimeId; replayedImpact.current = 0; }
    if (model.networkAuthority || !lastImpact || lastImpact.id === replayedImpact.current || reducedMotion || !automaticReplays) return;
    // A physical landing can emit both its move impact and its mat/body response
    // while a replay is already open. Treat those as part of the current spot so
    // Skip never closes one overlay only to immediately queue another.
    if (active) { replayedImpact.current = lastImpact.id; return; }
    const majorSlam = lastImpact.kind === 'grapple' && MAJOR_SLAM_MOVES.has(lastImpact.moveId ?? '');
    const replayWorthy = majorSlam || lastImpact.kind === 'finisher' || lastImpact.kind === 'table' || lastImpact.kind === 'ko';
    if (!replayWorthy || bodyWorksRuntime.replay.size < 45) return;
    replayedImpact.current = lastImpact.id; useMatchStore.getState().startReplay();
  }, [active, automaticReplays, lastImpact, reducedMotion, model.networkAuthority, model.runtimeId]);
  useEffect(() => {
    if (!active) { physicsFrame.current = null; replayPresentation.frame = null; replayPresentation.focusSlots = []; return; }
    const impact = useMatchStore.getState().model.lastImpact;
    replayPresentation.focusSlots = [...new Set([impact?.sourceFighter, impact?.targetFighter].filter((slot): slot is FighterSlot => slot !== undefined))];
    const recorded = bodyWorksRuntime.replay.chronological();
    const end = recorded[recorded.length - 1]?.time ?? 0;
    physicsFrames.current = recorded.filter(frame => frame.time >= end - 2.4);
    elapsed.current = 0; physicsFrame.current = physicsFrames.current[0] ?? null; replayPresentation.frame = physicsFrame.current;
    return () => { replayPresentation.frame = null; replayPresentation.focusSlots = []; };
  }, [active]);
  useFrame((_, dt) => {
    if (!active || physicsFrames.current.length === 0) return;
    elapsed.current += Math.min(dt, .05);
    const first = physicsFrames.current[0]; const last = physicsFrames.current[physicsFrames.current.length - 1];
    if (!first || !last) return;
    // Show the lead-in at normal speed, then slow the contact half-second.
    const duration = Math.max(0, last.time - first.time);
    const lead = Math.max(0, duration - .5);
    const reviewTime = elapsed.current <= lead ? elapsed.current : lead + (elapsed.current - lead) * .4;
    physicsFrame.current = sampleReplayFrame(physicsFrames.current, first.time + reviewTime);
    replayPresentation.frame = physicsFrame.current;
    if (elapsed.current >= PLAYBACK_SECONDS) useMatchStore.getState().stopReplay();
  }, -2);
  if (!active) return null;
  return <group>{(model.matchMode === 'battle_royale' ? FIGHTER_SLOTS : ['player', 'opponent'] as const).map(side => <HumanoidFighter key={side} runtime={model[side]} side={side} replayFrame={physicsFrame} />)}<RecordedProps frameRef={physicsFrame} /></group>;
}
