import { useEffect, useState } from 'react';
import type { ControlDevice } from '../game/types/game';

const KEY = 'ringfall-tutorial-complete-v2';

export function Tutorial({ device }: { device: ControlDevice }) {
  const [visible, setVisible] = useState(() => localStorage.getItem(KEY) !== 'true');
  const [timeRemaining, setTimeRemaining] = useState(13_000);
  const [isPaused, setIsPaused] = useState(false);

  const close = (): void => {
    localStorage.setItem(KEY, 'true');
    setVisible(false);
  };

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
