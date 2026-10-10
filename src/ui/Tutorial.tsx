import { useEffect, useState } from 'react';
import type { ControlDevice } from '../game/types/game';
import { controlPrompt } from './ControlDeck';

const KEY = 'ringfall-tutorial-complete-v2';

export function Tutorial({ device }: { device: ControlDevice }) {
  const [visible, setVisible] = useState(() => { try { return localStorage?.getItem(KEY) !== 'true'; } catch { return true; } });
  const [timeRemaining, setTimeRemaining] = useState(7_000);
  const [isPaused, setIsPaused] = useState(false);

  const close = (): void => {
    try { localStorage?.setItem(KEY, 'true'); } catch { /* Storage may be disabled in private browsing. */ }
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  useEffect(() => {
    if (!visible || isPaused || timeRemaining <= 0) return;

    const startTime = Date.now();
    const timer = window.setTimeout(close, timeRemaining);

    return () => {
      window.clearTimeout(timer);
      const elapsed = Date.now() - startTime;
      setTimeRemaining((prev) => Math.max(0, prev - elapsed));
    };
  }, [visible, isPaused, timeRemaining]);

  if (!visible || device === 'touch') return null;

  const moveKey = controlPrompt(device, 'move');
  const strikeKey = controlPrompt(device, 'quick');
  const powerKey = controlPrompt(device, 'heavy');
  const grappleKey = controlPrompt(device, 'grapple');
  const dodgeKey = controlPrompt(device, 'counter');
  const runKey = controlPrompt(device, 'run');
  const guardKey = controlPrompt(device, 'block');
  const actionKey = controlPrompt(device, 'context');

  return (
    <aside
      className="tutorial"
      data-paused={isPaused}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <p className="sr-only" role="status" aria-live="polite">
        Core controls overlay displayed for {device}. Press Escape or click close to dismiss.
      </p>
      <div>
        <span>CORE CONTROLS</span>
        <button type="button" aria-label="Close tutorial" title="Close tutorial (Escape key)" onClick={close}>×</button>
      </div>
      <ul>
        <li><kbd>{moveKey}</kbd><span>MOVE</span></li>
        <li><kbd>{strikeKey}</kbd><span>STRIKE</span></li>
        <li><kbd>{powerKey}</kbd><span>POWER</span></li>
        <li><kbd>{grappleKey}</kbd><span>GRAPPLE</span></li>
        <li><kbd>{dodgeKey}</kbd><span>DODGE</span></li>
      </ul>
      <small>Get close before attacking. Hold {runKey} to run, {guardKey} to guard, and use {actionKey} only when the action prompt appears.</small>
    </aside>
  );
}
