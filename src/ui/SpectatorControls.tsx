import { useEffect } from 'react';
import { fighterById } from '../game/data/fighters';
import { useMatchStore } from '../game/state/matchStore';
import { resolvedSpectatorTarget, useSpectatorStore } from '../game/state/spectatorStore';
import type { SpectatorCameraMode } from '../game/state/spectatorStore';

const MODES: readonly { id: SpectatorCameraMode; label: string; key: string }[] = [
  { id: 'first_person', label: 'FIRST PERSON', key: '1' },
  { id: 'third_person', label: '3RD PERSON', key: '2' },
  { id: 'free', label: 'FREESTYLE CAMERA', key: '3' },
];

export function SpectatorControls() {
  const model = useMatchStore((state) => state.model);
  const cameraMode = useSpectatorStore((state) => state.cameraMode);
  const requestedTarget = useSpectatorStore((state) => state.target);
  const setCameraMode = useSpectatorStore((state) => state.setCameraMode);
  const cycleTarget = useSpectatorStore((state) => state.cycleTarget);
  const spectating = model.matchMode === 'battle_royale' && model.player.state === 'defeated' && !model.resolved;
  const target = resolvedSpectatorTarget(model, requestedTarget);

  useEffect(() => {
    if (!spectating) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === '1') setCameraMode('first_person');
      else if (event.key === '2') setCameraMode('third_person');
      else if (event.key === '3') setCameraMode('free');
      else if (event.key === 'Tab') { event.preventDefault(); cycleTarget(useMatchStore.getState().model, event.shiftKey ? -1 : 1); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cycleTarget, setCameraMode, spectating]);

  if (!spectating) return null;
  const fighter = fighterById(model[target].definitionId);
  return <aside className="spectator-controls" data-testid="spectator-controls" data-camera-mode={cameraMode} data-spectator-target={target}>
    <header><span>ELIMINATED · MATCH CONTINUES</span><b>SPECTATING {fighter.name}</b></header>
    <div>{MODES.map((mode) => <button key={mode.id} type="button" className={cameraMode === mode.id ? 'active' : ''} aria-pressed={cameraMode === mode.id} onClick={() => setCameraMode(mode.id)}><kbd>{mode.key}</kbd>{mode.label}</button>)}</div>
    <button type="button" className="spectator-next" onClick={() => cycleTarget(model)}>NEXT WRESTLER <kbd>TAB</kbd></button>
    {cameraMode === 'free' && <small>DRAG TO ORBIT · WHEEL TO ZOOM · RIGHT-DRAG TO PAN</small>}
  </aside>;
}
