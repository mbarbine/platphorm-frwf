import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr, BakeShadows } from '@react-three/drei';
import { Physics, useAfterPhysicsStep, useBeforePhysicsStep } from '@react-three/rapier';
import { Component, Suspense, useCallback, useEffect, useRef } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Arena } from './Arena';
import { PhysicalFighterRig } from './PhysicalFighterRig';
import { CameraRig } from './CameraRig';
import { ImpactEffects } from './ImpactEffects';
import { useMatchStore } from '../state/matchStore';
import { useGameInput } from '../input/useGameInput';
import { audioEngine } from '../audio/audioEngine';
import { useSettings } from '../state/settings';
import type { ControlDevice } from '../types/game';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { useThree } from '@react-three/fiber';
import { ReplayDirector } from './ReplayFighter';
import { physicsLabEnabled } from './PhysicsLab';
import { cameraInputBasis, transformCameraRelative, updateStableBasis } from '../input/cameraRelative';
import type { CameraInputBasis } from '../input/cameraRelative';

interface Props { onPause: () => void; onDevice: (device: ControlDevice) => void; onFinished: () => void }

function Simulation({ onPause, onDevice, onFinished }: Props) {
  const pause = useCallback(onPause, [onPause]); const input = useGameInput(pause); const lastImpactId = useRef(0); const lastActionAudio = useRef(''); const finishNotified = useRef(false); const finishTimer = useRef<number | null>(null); const { camera } = useThree();
  const inputBasis = useRef<CameraInputBasis | null>(null);
  useEffect(() => onDevice(input.device), [input.device, onDevice]);
  useEffect(() => { useMatchStore.getState().setPhysicsAuthority(true); return () => useMatchStore.getState().setPhysicsAuthority(false); }, []);
  useEffect(() => () => { if (finishTimer.current !== null) window.clearTimeout(finishTimer.current); }, []);
  useBeforePhysicsStep((world) => {
    const raw = input.read(); const model = useMatchStore.getState().model;
    const middleX = (model.player.position.x + model.opponent.position.x) / 2; const middleZ = (model.player.position.z + model.opponent.position.z) / 2;
    const candidate = cameraInputBasis({ x: camera.position.x, z: camera.position.z }, { x: middleX, z: middleZ });
    if (!inputBasis.current) inputBasis.current = candidate;
    const inputHeld = Math.hypot(raw.move.x, raw.move.z) > .08;
    const cinematic = useMatchStore.getState().replayActive || !['idle', 'locomotion', 'blocking'].includes(model.player.state) || model.player.moveId !== null || model.opponent.moveId !== null;
    inputBasis.current = updateStableBasis(inputBasis.current, candidate, inputHeld, cinematic, 1 / 60);
    raw.move = transformCameraRelative(raw.move, inputBasis.current);
    useMatchStore.getState().advance(1 / 60, raw);
    bodyWorksRuntime.beforeFixedStep(1 / 60, useMatchStore.getState().model, world);
  });
  useAfterPhysicsStep(() => {
    bodyWorksRuntime.afterFixedStep(useMatchStore.getState().model);
    const contacts = bodyWorksRuntime.consumeContacts();
    if (contacts.length > 0) useMatchStore.getState().resolvePhysicsContacts(contacts);
  });
  useFrame(() => {
    const model = useMatchStore.getState().model;
    if (model.lastImpact && model.lastImpact.id !== lastImpactId.current) { lastImpactId.current = model.lastImpact.id; audioEngine.impact(model.lastImpact, useSettings.getState()); }
    const actionAudio = `${model.player.state}:${model.player.moveId ?? ''}:${model.player.attackInstanceId}:${model.player.climbStage}`;
    if (actionAudio !== lastActionAudio.current) {
      const previous = lastActionAudio.current; lastActionAudio.current = actionAudio;
      if (model.player.moveId === 'taunt') audioEngine.play('cheer', useSettings.getState());
      else if (model.player.moveId === 'aerial' || model.player.moveId === 'finisher') audioEngine.play('finisher', useSettings.getState());
      else if (model.player.state === 'climbing' && !previous.startsWith('climbing')) audioEngine.play('rope', useSettings.getState());
    }
    if (model.resolved && !finishNotified.current) { finishNotified.current = true; finishTimer.current = window.setTimeout(onFinished, 4800); }
  });
  return null;
}

function Fighters() {
  const player = useMatchStore((state) => state.model.player); const opponent = useMatchStore((state) => state.model.opponent);
  const runtimeId = useMatchStore((state) => state.model.runtimeId);
  const replayActive = useMatchStore((state) => state.replayActive);
  return <group key={runtimeId} visible={!replayActive}><PhysicalFighterRig runtime={player} side="player" /><PhysicalFighterRig runtime={opponent} side="opponent" /></group>;
}

export function GameScene(props: Props) {
  const paused = useMatchStore((state) => state.model.paused);
  const replayActive = useMatchStore((state) => state.replayActive);
  const lab = physicsLabEnabled();
  return <SceneBoundary><div className="game-canvas" data-testid="game-canvas">
    <Canvas shadows={lab ? false : 'basic'} dpr={lab ? .5 : [.75, 1.5]} gl={{ antialias: !lab, alpha: false, powerPreference: 'high-performance' }} camera={{ position: [8, 7, 11], fov: 48, near: .1, far: 60 }}>
      <Suspense fallback={null}><Physics gravity={[0, -18, 0]} timeStep={1 / 60} paused={paused || replayActive} interpolate numSolverIterations={8} numInternalPgsIterations={2} maxCcdSubsteps={2}><Arena /><Fighters /><ImpactEffects /><Simulation {...props} /></Physics><ReplayDirector /><CameraRig /><AdaptiveDpr pixelated />{!lab && <BakeShadows />}</Suspense>
    </Canvas>
  </div></SceneBoundary>;
}

interface BoundaryState { failed: boolean }
class SceneBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo): void { console.error('Arena rendering failed', error.message, info.componentStack); }
  render(): ReactNode { return this.state.failed ? <div className="canvas-fallback"><b>ARENA RENDERER RECOVERING</b><span>Reload the match to reinitialize WebGL.</span><button className="button" onClick={() => location.reload()}>RELOAD ARENA</button></div> : this.props.children; }
}
