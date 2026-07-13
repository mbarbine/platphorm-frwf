import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr, BakeShadows } from '@react-three/drei';
import { Physics, useAfterPhysicsStep, useBeforePhysicsStep } from '@react-three/rapier';
import { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Vector3 } from 'three';
import type { WebGLRenderer } from 'three';
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
import { getMove } from '../data/moves';

interface Props { onPause: () => void; onDevice: (device: ControlDevice) => void; onFinished: () => void }

function Simulation({ onPause, onDevice, onFinished }: Props) {
  const pause = useCallback(onPause, [onPause]); const input = useGameInput(pause); const lastImpactId = useRef(0); const lastActionAudio = useRef(''); const finishNotified = useRef(false); const finishTimer = useRef<number | null>(null); const { camera, gl } = useThree();
  const inputBasis = useRef<CameraInputBasis | null>(null);
  const listenerPosition = useRef(new Vector3()); const listenerForward = useRef(new Vector3()); const footstepTimer = useRef(0);
  useEffect(() => onDevice(input.device), [input.device, onDevice]);
  useEffect(() => { useMatchStore.getState().setPhysicsAuthority(true); return () => useMatchStore.getState().setPhysicsAuthority(false); }, []);
  useEffect(() => () => { if (finishTimer.current !== null) window.clearTimeout(finishTimer.current); }, []);
  useBeforePhysicsStep((world) => {
    const session = gl.xr.getSession(); const raw = input.read(session ? Array.from(session.inputSources) : []); const model = useMatchStore.getState().model;
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
  useFrame((_, dt) => {
    const model = useMatchStore.getState().model;
    const listeningCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    listeningCamera.getWorldPosition(listenerPosition.current); listeningCamera.getWorldDirection(listenerForward.current);
    audioEngine.setListener({ position: [listenerPosition.current.x, listenerPosition.current.y, listenerPosition.current.z], forward: [listenerForward.current.x, listenerForward.current.y, listenerForward.current.z], up: [0, 1, 0] });
    if (model.lastImpact && model.lastImpact.id !== lastImpactId.current) { lastImpactId.current = model.lastImpact.id; audioEngine.impact(model.lastImpact, useSettings.getState()); }
    const actionAudio = `${model.player.state}:${model.player.moveId ?? ''}:${model.player.attackInstanceId}:${model.player.climbStage}`;
    if (actionAudio !== lastActionAudio.current) {
      const previous = lastActionAudio.current; lastActionAudio.current = actionAudio;
      const move = model.player.moveId ? getMove(model.player.moveId) : null;
      if (move?.id === 'taunt') audioEngine.play('cheer', useSettings.getState());
      else if (move?.category === 'aerial' || move?.category === 'finisher') audioEngine.playAt('finisher', useSettings.getState(), model.player.position);
      else if (['front_kick', 'low_kick', 'high_kick', 'roundhouse'].includes(move?.id ?? '')) audioEngine.playAt('kick', useSettings.getState(), model.player.position);
      else if (move?.category === 'grapple') audioEngine.playAt('grapple', useSettings.getState(), model.player.position);
      else if (move?.id === 'kick_up' || model.player.state === 'jumping') audioEngine.playAt('jump', useSettings.getState(), model.player.position);
      else if (model.player.state === 'climbing' && !previous.startsWith('climbing')) audioEngine.playAt('rope', useSettings.getState(), model.player.position);
    }
    footstepTimer.current = Math.max(0, footstepTimer.current - dt);
    const playerSpeed = bodyWorksRuntime.fighterSnapshot('player').speed;
    if (model.player.state === 'locomotion' && playerSpeed > .8 && footstepTimer.current <= 0) {
      audioEngine.playAt('step', useSettings.getState(), model.player.position); footstepTimer.current = playerSpeed > 3.8 ? .24 : .39;
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
  const renderer = useRef<WebGLRenderer | null>(null); const [xrAvailable, setXrAvailable] = useState(false); const [xrPresenting, setXrPresenting] = useState(false); const [xrError, setXrError] = useState('');
  const enterXR = async (): Promise<void> => {
    if (!navigator.xr || !renderer.current) return;
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: ['bounded-floor', 'hand-tracking'] });
      renderer.current.xr.setReferenceSpaceType('local-floor'); await renderer.current.xr.setSession(session); setXrPresenting(true); setXrError('');
      session.addEventListener('end', () => setXrPresenting(false), { once: true });
    } catch (error: unknown) { setXrError(error instanceof Error ? error.message : 'XR session could not start'); }
  };
  const exitXR = async (): Promise<void> => { await renderer.current?.xr.getSession()?.end(); };
  return <SceneBoundary><div className="game-canvas" data-testid="game-canvas">
    <Canvas shadows={lab ? false : 'basic'} dpr={lab ? .5 : [.75, 1.5]} gl={{ antialias: !lab, alpha: false, powerPreference: 'high-performance' }} camera={{ position: [8, 7, 11], fov: 48, near: .1, far: 60 }} onCreated={({ gl }) => {
      renderer.current = gl; gl.xr.enabled = true;
      if (navigator.xr) void navigator.xr.isSessionSupported('immersive-vr').then(setXrAvailable).catch(() => setXrAvailable(false));
    }}>
      <Suspense fallback={null}><Physics gravity={[0, -18, 0]} timeStep={1 / 60} paused={paused || replayActive} interpolate numSolverIterations={8} numInternalPgsIterations={2} maxCcdSubsteps={2}><Arena /><Fighters /><ImpactEffects /><Simulation {...props} /></Physics><ReplayDirector /><CameraRig /><AdaptiveDpr pixelated />{!lab && <BakeShadows />}</Suspense>
    </Canvas>
    {xrAvailable && <button type="button" className="xr-entry" data-testid="xr-entry" onClick={() => void (xrPresenting ? exitXR() : enterXR())}>{xrPresenting ? 'EXIT ARENA XR' : 'ENTER ARENA XR'}<small>QUEST · STEAM FRAME · OPENXR</small></button>}
    {xrError && <div className="xr-error" role="status">XR UNAVAILABLE · {xrError}</div>}
  </div></SceneBoundary>;
}

interface BoundaryState { failed: boolean }
class SceneBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo): void { console.error('Arena rendering failed', error.message, info.componentStack); }
  render(): ReactNode { return this.state.failed ? <div className="canvas-fallback"><b>ARENA RENDERER RECOVERING</b><span>Reload the match to reinitialize WebGL.</span><button className="button" onClick={() => location.reload()}>RELOAD ARENA</button></div> : this.props.children; }
}
