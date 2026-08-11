import { useEffect, useState, useRef } from 'react';
import type { ControlDevice } from '../game/types/game';

const KEY = 'ringfall-tutorial-complete-v2';

export function Tutorial({ device }: { device: ControlDevice }) {
  const [visible, setVisible] = useState(() => localStorage.getItem(KEY) !== 'true');
  const [isInteracting, setIsInteracting] = useState(false);
  const timeLeftRef = useRef(13000);
  const lastActiveRef = useRef<number | null>(null);

  const close = (): void => { localStorage.setItem(KEY, 'true'); setVisible(false); };

  useEffect(() => {
    if (!visible || isInteracting) return;

    lastActiveRef.current = Date.now();
    const timer = window.setTimeout(close, timeLeftRef.current);

    return () => {
      window.clearTimeout(timer);
      if (lastActiveRef.current !== null) {
        timeLeftRef.current = Math.max(0, timeLeftRef.current - (Date.now() - lastActiveRef.current));
        lastActiveRef.current = null;
      }
    };
  }, [visible, isInteracting]);

  if (!visible || device === 'touch') return null;

  return <aside
    className="tutorial"
    onMouseEnter={() => setIsInteracting(true)}
    onMouseLeave={() => setIsInteracting(false)}
    onFocus={() => setIsInteracting(true)}
    onBlur={() => setIsInteracting(false)}
  >
    <div><span>CORE CONTROLS</span><button aria-label="Close tutorial" onClick={close}>×</button></div>
    <ul>
      <li><kbd>WASD</kbd><span>MOVE</span></li><li><kbd>J</kbd><span>STRIKE</span></li><li><kbd>K</kbd><span>POWER</span></li><li><kbd>L</kbd><span>GRAPPLE</span></li><li><kbd>SPACE</kbd><span>DODGE</span></li>
    </ul>
    <small>Get close before attacking. Hold Shift to run, I to guard, and use F only when the action prompt appears.</small>
  </aside>;
}
