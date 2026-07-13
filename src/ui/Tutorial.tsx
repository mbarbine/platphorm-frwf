import { useEffect, useState } from 'react';

const KEY = 'ringfall-tutorial-complete-v1';

export function Tutorial() {
  const [visible, setVisible] = useState(() => localStorage.getItem(KEY) !== 'true');
  const close = (): void => { localStorage.setItem(KEY, 'true'); setVisible(false); };
  useEffect(() => { if (!visible) return; const timer = window.setTimeout(close, 13_000); return () => window.clearTimeout(timer); }, [visible]);
  if (!visible) return null;
  return <aside className="tutorial"><div><span>10-SECOND CORNER COACH</span><button aria-label="Close tutorial" onClick={close}>×</button></div><ul>
    <li><kbd>WASD</kbd><span>MOVE</span></li><li><kbd>J</kbd><span>QUICK</span></li><li><kbd>K</kbd><span>HEAVY</span></li><li><kbd>L + DIR</kbd><span>GRAPPLE CHAIN</span></li><li><kbd>SPACE</kbd><span>DODGE / COUNTER</span></li><li><kbd>F</kbd><span>PIN / FINISHER</span></li>
  </ul><small>Lock up with L, then hold a direction + J/K/L to choose the slam. Fill Momentum, stagger your rival, then press F.</small></aside>;
}
