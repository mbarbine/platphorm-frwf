import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr, BakeShadows } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Component, Suspense, useCallback, useEffect, useRef } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Arena } from './Arena';
import { FighterModel } from './FighterModel';
import { CameraRig } from './CameraRig';
import { ImpactEffects } from './ImpactEffects';
import { useMatchStore } from '../state/matchStore';
import { useGameInput } from '../input/useGameInput';
import { audioEngine } from '../audio/audioEngine';
import { useSettings } from '../state/settings';
import type { ControlDevice } from '../types/game';

interface Props { onPause: () => void; onDevice: (device: ControlDevice) => void; onFinished: () => void }

function Simulation({ onPause, onDevice, onFinished }: Props) {
  const pause = useCallback(onPause, [onPause]); const input = useGameInput(pause); const accumulator = useRef(0); const lastImpactId = useRef(0); const finishNotified = useRef(false);
  useEffect(() => onDevice(input.device), [input.device, onDevice]);
  useFrame(({ camera }, delta) => {
    const store = useMatchStore.getState(); accumulator.current += Math.min(delta, .25);
    while (accumulator.current >= 1 / 30) {
      const raw = input.read(); const model = useMatchStore.getState().model;
      const middleX = (model.player.position.x + model.opponent.position.x) / 2; const middleZ = (model.player.position.z + model.opponent.position.z) / 2;
      const forwardX = middleX - camera.position.x; const forwardZ = middleZ - camera.position.z; const magnitude = Math.max(.001, Math.hypot(forwardX, forwardZ));
      const forward = { x: forwardX / magnitude, z: forwardZ / magnitude }; const right = { x: -forward.z, z: forward.x };
      raw.move = { x: right.x * raw.move.x - forward.x * raw.move.z, z: right.z * raw.move.x - forward.z * raw.move.z };
      store.advance(1 / 30, raw); accumulator.current -= 1 / 30;
    }
    const model = useMatchStore.getState().model;
    if (model.lastImpact && model.lastImpact.id !== lastImpactId.current) { lastImpactId.current = model.lastImpact.id; audioEngine.impact(model.lastImpact, useSettings.getState()); }
    if (model.resolved && !finishNotified.current) { finishNotified.current = true; window.setTimeout(onFinished, 2600); }
  });
  return null;
}

function Fighters() {
  const player = useMatchStore((state) => state.model.player); const opponent = useMatchStore((state) => state.model.opponent);
  return <><FighterModel runtime={player} counterpart={opponent} side="player" /><FighterModel runtime={opponent} counterpart={player} side="opponent" /></>;
}

export function GameScene(props: Props) {
  return <SceneBoundary><div className="game-canvas" data-testid="game-canvas">
    <Canvas shadows="basic" dpr={[.75, 1.5]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} camera={{ position: [8, 7, 11], fov: 48, near: .1, far: 60 }}>
      <Suspense fallback={null}><Physics gravity={[0, -18, 0]} timeStep="vary"><Arena /><Fighters /><ImpactEffects /></Physics><CameraRig /><Simulation {...props} /><AdaptiveDpr pixelated /><BakeShadows /></Suspense>
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
