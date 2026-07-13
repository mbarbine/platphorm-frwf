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

interface Props { onPause: () => void; onDevice: (device: ControlDevice) => void; onFinished: () => void }

function Simulation({ onPause, onDevice, onFinished }: Props) {
  const pause = useCallback(onPause, [onPause]); const input = useGameInput(pause); const lastImpactId = useRef(0); const finishNotified = useRef(false); const finishTimer = useRef<number | null>(null); const { camera } = useThree();
  useEffect(() => onDevice(input.device), [input.device, onDevice]);
  useEffect(() => { useMatchStore.getState().setPhysicsAuthority(true); return () => useMatchStore.getState().setPhysicsAuthority(false); }, []);
  useEffect(() => () => { if (finishTimer.current !== null) window.clearTimeout(finishTimer.current); }, []);
  useBeforePhysicsStep((world) => {
    const raw = input.read(); const model = useMatchStore.getState().model;
    const middleX = (model.player.position.x + model.opponent.position.x) / 2; const middleZ = (model.player.position.z + model.opponent.position.z) / 2;
    const forwardX = middleX - camera.position.x; const forwardZ = middleZ - camera.position.z; const magnitude = Math.max(.001, Math.hypot(forwardX, forwardZ));
    const forward = { x: forwardX / magnitude, z: forwardZ / magnitude }; const right = { x: -forward.z, z: forward.x };
    raw.move = { x: right.x * raw.move.x - forward.x * raw.move.z, z: right.z * raw.move.x - forward.z * raw.move.z };
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
  return <SceneBoundary><div className="game-canvas" data-testid="game-canvas">
    <Canvas shadows="basic" dpr={[.75, 1.5]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} camera={{ position: [8, 7, 11], fov: 48, near: .1, far: 60 }}>
      <Suspense fallback={null}><Physics gravity={[0, -18, 0]} timeStep={1 / 60} paused={paused || replayActive} interpolate numSolverIterations={8} numInternalPgsIterations={2} maxCcdSubsteps={2}><Arena /><Fighters /><ImpactEffects /><Simulation {...props} /></Physics><ReplayDirector /><CameraRig /><AdaptiveDpr pixelated /><BakeShadows /></Suspense>
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
