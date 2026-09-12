import { useEffect, useState } from 'react';
import type { ControlDevice } from '../game/types/game';

const KEY = 'ringfall-tutorial-complete-v2';

export function Tutorial({ device }: { device: ControlDevice }) {
  const [visible, setVisible] = useState(() => localStorage.getItem(KEY) !== 'true');
  const [timeRemaining, setTimeRemaining] = useState(7_000);
  const [isPaused, setIsPaused] = useState(false);

  const close = (): void => {
    localStorage.setItem(KEY, 'true');
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

  return (
    <aside
      className="tutorial"
      data-paused={isPaused}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div aria-live="polite" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>
        Core controls overlay displayed. Press Escape or click close to dismiss.
      </div>
      <div>
        <span>CORE CONTROLS</span>
        <button aria-label="Close tutorial" onClick={close}>×</button>
      </div>
      <ul>
        <li><kbd>WASD</kbd><span>MOVE</span></li>
        <li><kbd>J</kbd><span>STRIKE</span></li>
        <li><kbd>K</kbd><span>POWER</span></li>
        <li><kbd>L</kbd><span>GRAPPLE</span></li>
        <li><kbd>SPACE</kbd><span>DODGE</span></li>
      </ul>
      <small>Get close before attacking. Hold Shift to run, I to guard, and use F only when the action prompt appears.</small>
    </aside>
  );
}
