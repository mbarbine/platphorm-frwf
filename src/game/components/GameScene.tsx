import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr, BakeShadows } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Suspense, useCallback, useEffect, useRef } from 'react';
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
  useFrame((_, delta) => {
    const store = useMatchStore.getState(); accumulator.current += Math.min(delta, .1);
    while (accumulator.current >= 1 / 30) { store.advance(1 / 30, input.read()); accumulator.current -= 1 / 30; }
    const model = useMatchStore.getState().model;
    if (model.lastImpact && model.lastImpact.id !== lastImpactId.current) { lastImpactId.current = model.lastImpact.id; audioEngine.impact(model.lastImpact, useSettings.getState()); }
    if (model.resolved && !finishNotified.current) { finishNotified.current = true; window.setTimeout(onFinished, 2600); }
  });
  return null;
}

function Fighters() {
  const player = useMatchStore((state) => state.model.player); const opponent = useMatchStore((state) => state.model.opponent);
  return <><FighterModel runtime={player} side="player" /><FighterModel runtime={opponent} side="opponent" /></>;
}

export function GameScene(props: Props) {
  return <div className="game-canvas" data-testid="game-canvas">
    <Canvas shadows dpr={[.75, 1.5]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} camera={{ position: [8, 7, 11], fov: 48, near: .1, far: 60 }}>
      <Suspense fallback={null}><Physics gravity={[0, -18, 0]} timeStep="vary"><Arena /><Fighters /><ImpactEffects /></Physics><CameraRig /><Simulation {...props} /><AdaptiveDpr pixelated /><BakeShadows /></Suspense>
    </Canvas>
  </div>;
}
