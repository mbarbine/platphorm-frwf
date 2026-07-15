import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr, BakeShadows, OrbitControls } from '@react-three/drei';
import { Physics, useAfterPhysicsStep, useBeforePhysicsStep } from '@react-three/rapier';
import { JointData } from '@dimforge/rapier3d-compat';
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Vector3 } from 'three';
import type { Group } from 'three';
import type { WebGLRenderer } from 'three';
import { Arena } from './Arena';
import { PhysicalFighterRig } from './PhysicalFighterRig';
import { FighterModel } from './FighterModel';
import { CameraRig } from './CameraRig';
import { ImpactEffects } from './ImpactEffects';
import { useMatchStore } from '../state/matchStore';
import { useGameInput } from '../input/useGameInput';
import { audioEngine } from '../audio/audioEngine';
import { useSettings } from '../state/settings';
import type { ControlDevice } from '../types/game';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { useThree } from '@react-three/fiber';
import { physicsLabEnabled } from '../runtime/runtimeModes';
import { cameraInputBasis, transformCameraRelative, updateStableBasis } from '../input/cameraRelative';
import type { CameraInputBasis } from '../input/cameraRelative';
import { getMove } from '../data/moves';
import { browserRuntimeQuality } from '../runtime/quality';
import { usePhysicsLabStore } from '../state/physicsLabStore';
import { pulseConnectedGamepads } from '../input/gamepadHaptics';
import { renderDiagnostics, resetRenderDiagnostics, sampleRenderDiagnostics } from '../runtime/renderDiagnostics';
import { selectFighterDetail } from '../presentation/presentationManifest';
import type { FighterDetail } from '../presentation/presentationManifest';
import { FALL_REASONS, FIGHTER_SLOTS } from '../types/game';
import { resolvedSpectatorTarget, useSpectatorStore } from '../state/spectatorStore';
import { BODY_SEGMENT_COUNT } from '../physics/bodySchema';
import { fallCount } from '../systems/falls';

interface Props { onPause: () => void; onDevice: (device: ControlDevice) => void; onFinished: () => void; inputEnabled?: boolean }

const ReplayDirector = lazy(async () => ({ default: (await import('./ReplayFighter')).ReplayDirector }));
const BodyWorksDebugOverlay = lazy(async () => ({ default: (await import('./BodyWorksDebugOverlay')).BodyWorksDebugOverlay }));

bodyWorksRuntime.setJointData(JointData);

function Simulation({ onPause, onDevice, onFinished, inputEnabled = true }: Props) {
  const pause = useCallback(onPause, [onPause]);
  const clearPendingInput = useCallback((reason: string) => {
    const model = useMatchStore.getState().model;
    bodyWorksRuntime.rejectPendingActions('player', model.elapsed, reason);
  }, []);
  const input = useGameInput(pause, inputEnabled, clearPendingInput); const lastImpactId = useRef(0); const lastActionAudio = useRef(''); const finishNotified = useRef(false); const finishTimer = useRef<number | null>(null); const { camera, gl } = useThree();
  const inputBasis = useRef<CameraInputBasis | null>(null);
  const storeActionCount = useRef(0);
  const rosterReadiness = useRef({ runtimeId: -1, ready: false });
  const listenerPosition = useRef(new Vector3()); const listenerForward = useRef(new Vector3()); const footstepTimer = useRef(0);
  useEffect(() => onDevice(input.device), [input.device, onDevice]);
  useEffect(() => { useMatchStore.getState().setPhysicsAuthority(true); return () => useMatchStore.getState().setPhysicsAuthority(false); }, []);
  useEffect(() => () => { if (finishTimer.current !== null) window.clearTimeout(finishTimer.current); }, []);
  useEffect(() => {
    const onTargetCycle = (event: KeyboardEvent): void => {
      if (event.code !== 'Tab') return;
      const model = useMatchStore.getState().model;
      if (model.matchMode !== 'battle_royale' || model.resolved || ['defeated', 'victorious'].includes(model.player.state)) return;
      event.preventDefault();
      useMatchStore.getState().cyclePlayerTarget(event.shiftKey ? -1 : 1);
    };
    window.addEventListener('keydown', onTargetCycle);
    return () => window.removeEventListener('keydown', onTargetCycle);
  }, []);
  useBeforePhysicsStep((world) => {
    const model = useMatchStore.getState().model;
    const fixedStep = model.labMode ? usePhysicsLabStore.getState().rate / 60 : 1 / 60;
    const activeSlots = model.matchMode === 'battle_royale' ? FIGHTER_SLOTS.filter((slot) => model[slot].state !== 'defeated') : FIGHTER_SLOTS.slice(0, 2);
    const expectedBodies = activeSlots.length * BODY_SEGMENT_COUNT;
    if (rosterReadiness.current.runtimeId !== model.runtimeId) rosterReadiness.current = { runtimeId: model.runtimeId, ready: false };
    if (!rosterReadiness.current.ready && bodyWorksRuntime.metrics.bodyCount >= expectedBodies) rosterReadiness.current.ready = true;
    if (!rosterReadiness.current.ready) {
      // Let registered bodies settle under their motors, but do not let AI,
      // combat, or the match clock run against a partially mounted roster.
      bodyWorksRuntime.beforeFixedStep(fixedStep, model, world);
      return;
    }
    const session = gl.xr.getSession(); const raw = input.read(session ? Array.from(session.inputSources) : []);
    if (raw.actions?.length) {
      storeActionCount.current += raw.actions.length;
      document.documentElement.dataset.storeActionCount = String(storeActionCount.current);
      document.documentElement.dataset.storeLastAction = raw.actions[raw.actions.length - 1]?.action ?? '';
    }
    if (raw.targetCycle) useMatchStore.getState().cyclePlayerTarget(raw.targetCycle);
    const middleX = activeSlots.reduce((sum, slot) => sum + model[slot].position.x, 0) / Math.max(1, activeSlots.length);
    const middleZ = activeSlots.reduce((sum, slot) => sum + model[slot].position.z, 0) / Math.max(1, activeSlots.length);
    const candidate = cameraInputBasis({ x: camera.position.x, z: camera.position.z }, { x: middleX, z: middleZ });
    if (!inputBasis.current) inputBasis.current = candidate;
    const inputHeld = Math.hypot(raw.move.x, raw.move.z) > .08;
    const playerInGrapple = Boolean(model.grapple && (model.grapple.attacker === 'player' || model.grapple.defender === 'player'));
    const cinematic = useMatchStore.getState().replayActive || playerInGrapple || model.player.moveId !== null || ['grappling', 'grabbed', 'climbing', 'airborne', 'jumping', 'pinning', 'pinned'].includes(model.player.state);
    inputBasis.current = updateStableBasis(inputBasis.current, candidate, inputHeld, cinematic, fixedStep);
    raw.move = transformCameraRelative(raw.move, inputBasis.current);
    useMatchStore.getState().advance(fixedStep, raw);
    bodyWorksRuntime.beforeFixedStep(fixedStep, useMatchStore.getState().model, world);
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
    const liveSettings = useSettings.getState(); const audioSettings = model.toyTestMode ? { ...liveSettings, crowdVolume: 0 } : liveSettings;
    if (model.lastImpact && model.lastImpact.id !== lastImpactId.current) {
      lastImpactId.current = model.lastImpact.id;
      audioEngine.impact(model.lastImpact, audioSettings);
      pulseConnectedGamepads(model.lastImpact);
      document.documentElement.dataset.lastImpactKind = model.lastImpact.kind;
      document.documentElement.dataset.lastImpactMove = model.lastImpact.moveId ?? '';
      window.setTimeout(() => {
        if (document.documentElement.dataset.lastImpactKind === model.lastImpact?.kind) delete document.documentElement.dataset.lastImpactKind;
        if (document.documentElement.dataset.lastImpactMove === model.lastImpact?.moveId) delete document.documentElement.dataset.lastImpactMove;
      }, 120);
    }
    const actionAudio = `${model.player.state}:${model.player.moveId ?? ''}:${model.player.attackInstanceId}:${model.player.climbStage}`;
    if (actionAudio !== lastActionAudio.current) {
      const previous = lastActionAudio.current; lastActionAudio.current = actionAudio;
      const move = model.player.moveId ? getMove(model.player.moveId) : null;
      if (move?.id === 'taunt' && !model.toyTestMode) audioEngine.play('cheer', audioSettings);
      else if (move) audioEngine.move(move.id, audioSettings, model.player.position);
      else if (model.player.state === 'jumping') audioEngine.playAt('jump', audioSettings, model.player.position);
      else if (model.player.state === 'climbing' && !previous.startsWith('climbing')) audioEngine.playAt('rope', audioSettings, model.player.position);
    }
    footstepTimer.current = Math.max(0, footstepTimer.current - dt);
    const playerSpeed = bodyWorksRuntime.fighterSnapshot('player').speed;
    if (model.player.state === 'locomotion' && playerSpeed > .8 && footstepTimer.current <= 0) {
      audioEngine.playAt('step', audioSettings, model.player.position); footstepTimer.current = playerSpeed > 3.8 ? .24 : .39;
    }
    if (model.resolved && !finishNotified.current) { finishNotified.current = true; finishTimer.current = window.setTimeout(onFinished, 4800); }
  });
  return null;
}

function RuntimeDiagnosticsSampler() {
  const { gl } = useThree();
  useEffect(() => { resetRenderDiagnostics(); return resetRenderDiagnostics; }, []);
  useFrame((_, dt) => sampleRenderDiagnostics(gl, dt));
  return null;
}

function SpectatorFreeCamera() {
  const model = useMatchStore((state) => state.model);
  const cameraMode = useSpectatorStore((state) => state.cameraMode);
  const requestedTarget = useSpectatorStore((state) => state.target);
  const targetSlot = resolvedSpectatorTarget(model, requestedTarget); const target = model[targetSlot];
  const enabled = model.matchMode === 'battle_royale' && model.player.state === 'defeated' && !model.resolved && cameraMode === 'free';
  return <OrbitControls makeDefault enabled={enabled} enableDamping dampingFactor={.09} enablePan enableZoom minDistance={2.4} maxDistance={32} minPolarAngle={.16} maxPolarAngle={Math.PI * .49} target={[target.position.x, 2.5, target.position.z]} />;
}

function Fighters({ detail, showPhysical }: { detail: FighterDetail; showPhysical: boolean }) {
  const model = useMatchStore((state) => state.model); const runtimeId = model.runtimeId;
  const replayActive = useMatchStore((state) => state.replayActive);
  const slots = model.matchMode === 'battle_royale' ? FIGHTER_SLOTS : FIGHTER_SLOTS.slice(0, 2);
  return <group key={runtimeId} visible={!replayActive}>
    {slots.map((slot) => <PhysicalFighterRig key={`physics-${slot}`} runtime={model[slot]} side={slot} showVisuals={showPhysical} />)}
    {!showPhysical && slots.map((slot) => <FighterModel key={`visual-${slot}`} runtime={model[slot]} counterpart={model[model.targets[slot]]} side={slot} detail={detail} />)}
  </group>;
}

function PlayerControlBeacon() {
  const beacon = useRef<Group | null>(null);
  const direction = useRef<Group | null>(null);
  useFrame(({ clock }) => {
    const group = beacon.current; if (!group) return;
    const intent = bodyWorksRuntime.intentSnapshot('player'); const model = useMatchStore.getState().model;
    const magnitude = Math.hypot(intent.move.x, intent.move.z); const controllable = ['idle', 'locomotion'].includes(model.player.state) && !model.paused && !model.resolved;
    const battleIdentity = model.matchMode === 'battle_royale' && !['defeated', 'victorious'].includes(model.player.state) && !model.resolved;
    group.visible = battleIdentity || controllable && magnitude > .08;
    if (!group.visible) return;
    group.position.set(model.player.position.x, Math.abs(model.player.position.x) <= 5.82 && Math.abs(model.player.position.z) <= 4.32 ? 1.94 : .08, model.player.position.z);
    group.rotation.y = Math.atan2(intent.move.x, intent.move.z);
    if (direction.current) direction.current.visible = controllable && magnitude > .08;
    const pulse = 1 + Math.sin(clock.elapsedTime * 8) * .045; group.scale.setScalar(intent.run && magnitude > .08 ? pulse * 1.1 : pulse);
  });
  return <group ref={beacon} visible={false}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.43, .035, 5, 32]} /><meshBasicMaterial color="#49efff" transparent opacity={.86} depthWrite={false} /></mesh>
    <group ref={direction}><mesh position={[0, .028, .5]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.15, .4, 3]} /><meshBasicMaterial color="#dfff38" transparent opacity={.96} depthWrite={false} /></mesh></group>
    <mesh position={[0, 2.62, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[.22, .62, 4]} /><meshBasicMaterial color="#dfff38" transparent opacity={.94} depthWrite={false} /></mesh>
    <mesh position={[0, 2.95, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.3, .045, 5, 28]} /><meshBasicMaterial color="#49efff" transparent opacity={.92} depthWrite={false} /></mesh>
  </group>;
}

export function GameScene(props: Props) {
  const paused = useMatchStore((state) => state.model.paused);
  const replayActive = useMatchStore((state) => state.replayActive);
  const diagnosticModel = useMatchStore((state) => state.model); const toyTestMode = diagnosticModel.toyTestMode; const playerMove = diagnosticModel.player.moveId; const playerPosition = diagnosticModel.player.position; const opponentHealth = diagnosticModel[diagnosticModel.targets.player].health;
  const lab = physicsLabEnabled();
  const labRate = usePhysicsLabStore((state) => state.rate); const labDebug = usePhysicsLabStore((state) => state.debug);
  const graphicsQuality = useSettings((state) => state.graphicsQuality); const reducedMotion = useSettings((state) => state.reducedMotion);
  // Five articulated rigs, five presentation shells, ropes, props, and a full
  // crowd are a materially different render budget from singles. Auto quality
  // protects control latency first in Battle Royale; an explicit user quality
  // choice still wins. Slow rendering must never turn the match into slow
  // motion or make a held direction feel unregistered.
  const runtimeGraphicsQuality = diagnosticModel.matchMode === 'battle_royale' && graphicsQuality === 'auto' ? 'performance' : graphicsQuality;
  const quality = useMemo(() => browserRuntimeQuality(runtimeGraphicsQuality, reducedMotion, lab), [lab, reducedMotion, runtimeGraphicsQuality]);
  const fighterDetail = selectFighterDetail(quality.tier);
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
  const expectedBodies = (diagnosticModel.matchMode === 'battle_royale' ? 5 : 2) * BODY_SEGMENT_COUNT;
  return <SceneBoundary><div className="game-canvas" data-testid="game-canvas" data-match-mode={diagnosticModel.matchMode} data-player-state={diagnosticModel.player.state} data-active-wrestlers={FIGHTER_SLOTS.filter((slot) => (diagnosticModel.matchMode === 'battle_royale' && diagnosticModel[slot].state !== 'defeated') || (diagnosticModel.matchMode === 'singles' && (slot === 'player' || slot === 'opponent'))).length} data-simulation-ready={bodyWorksRuntime.metrics.bodyCount >= expectedBodies ? 'true' : 'false'} data-toy-test={toyTestMode ? 'true' : 'false'} data-graphics-tier={quality.tier} data-physics-bodies={bodyWorksRuntime.metrics.bodyCount} data-physics-steps={bodyWorksRuntime.metrics.fixedSteps} data-physics-emergency-resets={bodyWorksRuntime.metrics.emergencyResetCount} data-unknown-falls={fallCount(diagnosticModel, FALL_REASONS.Unknown)} data-unstable-without-cause-seconds={diagnosticModel.unstableWithoutCauseSeconds.toFixed(3)} data-draw-calls={renderDiagnostics.drawCalls} data-triangles={renderDiagnostics.triangles} data-geometries={renderDiagnostics.geometries} data-textures={renderDiagnostics.textures} data-shader-programs={renderDiagnostics.shaderPrograms} data-frame-p95-ms={renderDiagnostics.frameP95Ms.toFixed(2)} data-frame-p99-ms={renderDiagnostics.frameP99Ms.toFixed(2)} data-frames-over-100-ms={renderDiagnostics.framesOver100Ms} data-player-move={playerMove ?? ''} data-player-x={playerPosition.x.toFixed(3)} data-player-z={playerPosition.z.toFixed(3)} data-opponent-health={opponentHealth.toFixed(1)}>
    <Canvas shadows={quality.shadows ? 'basic' : false} dpr={quality.dpr} gl={{ antialias: quality.antialias, alpha: false, powerPreference: 'high-performance' }} camera={{ position: [8, 7, 11], fov: 48, near: .1, far: 72 }} onCreated={({ gl }) => {
      renderer.current = gl; gl.xr.enabled = true;
      if (navigator.xr) void navigator.xr.isSessionSupported('immersive-vr').then(setXrAvailable).catch(() => setXrAvailable(false));
    }}>
      <Suspense fallback={null}><Physics gravity={[0, -18, 0]} timeStep={(lab ? labRate : 1) / 60} paused={paused || replayActive} debug={lab && labDebug} interpolate numSolverIterations={8} numInternalPgsIterations={2} maxCcdSubsteps={2}><Arena crowdCount={quality.crowdCount} /><Fighters detail={fighterDetail} showPhysical={lab && labDebug} />{lab && labDebug && <BodyWorksDebugOverlay />}<PlayerControlBeacon /><ImpactEffects /><Simulation {...props} inputEnabled={!paused && !replayActive && !diagnosticModel.resolved && !['defeated', 'victorious'].includes(diagnosticModel.player.state)} /></Physics><ReplayDirector /><CameraRig /><SpectatorFreeCamera /><RuntimeDiagnosticsSampler /><AdaptiveDpr pixelated />{quality.bakeShadows && <BakeShadows />}</Suspense>
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
