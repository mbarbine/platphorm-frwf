import { useEffect, useState, useRef } from 'react';
import type { ControlDevice } from '../game/types/game';

const KEY = 'ringfall-tutorial-complete-v2';

export function Tutorial({ device }: { device: ControlDevice }) {
  const [visible, setVisible] = useState(() => localStorage.getItem(KEY) !== 'true');
  const [isPaused, setIsPaused] = useState(false);

  const remainingTimeRef = useRef(13_000);
  const lastStartTimeRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | undefined>(undefined);

  const close = (): void => {
    localStorage.setItem(KEY, 'true');
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;

    if (isPaused) {
      if (timerIdRef.current !== undefined) {
        window.clearTimeout(timerIdRef.current);
        timerIdRef.current = undefined;
      }
      if (lastStartTimeRef.current !== null) {
        remainingTimeRef.current = Math.max(0, remainingTimeRef.current - (Date.now() - lastStartTimeRef.current));
        lastStartTimeRef.current = null;
      }
    } else {
      lastStartTimeRef.current = Date.now();
      timerIdRef.current = window.setTimeout(() => {
        close();
      }, remainingTimeRef.current);
    }

    return () => {
      if (timerIdRef.current !== undefined) {
        window.clearTimeout(timerIdRef.current);
      }
    };
  }, [visible, isPaused]);

  if (!visible || device === 'touch') return null;

  return (
    <aside
      className="tutorial"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        // Only unpause if focus didn't move to another element inside the tutorial aside
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsPaused(false);
        }
      }}
      tabIndex={0}
      aria-label="Tutorial guide"
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
