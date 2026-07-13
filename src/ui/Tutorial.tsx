import { useEffect, useState } from 'react';
import type { ControlDevice } from '../game/types/game';

const KEY = 'ringfall-tutorial-complete-v1';

export function Tutorial({ device }: { device: ControlDevice }) {
  const [visible, setVisible] = useState(() => localStorage.getItem(KEY) !== 'true');
  const close = (): void => { localStorage.setItem(KEY, 'true'); setVisible(false); };
  useEffect(() => { if (!visible) return; const timer = window.setTimeout(close, 13_000); return () => window.clearTimeout(timer); }, [visible]);
  if (!visible) return null;
  const touch = device === 'touch';
  return <aside className={`tutorial${touch ? ' tutorial--touch' : ''}`}><div><span>10-SECOND CORNER COACH</span><button aria-label="Close tutorial" onClick={close}>×</button></div><ul>
    {touch ? <><li><kbd>STICK</kbd><span>MOVE</span></li><li><kbd>JAB</kbd><span>QUICK</span></li><li><kbd>HIT</kbd><span>HEAVY</span></li><li><kbd>LOCK</kbd><span>GRAPPLE</span></li><li><kbd>↯</kbd><span>COUNTER</span></li><li><kbd>ACTION</kbd><span>CLIMB / DIVE</span></li></> : <><li><kbd>WASD</kbd><span>MOVE</span></li><li><kbd>J</kbd><span>QUICK</span></li><li><kbd>K</kbd><span>HEAVY</span></li><li><kbd>L + DIR</kbd><span>GRAPPLE CHAIN</span></li><li><kbd>SPACE</kbd><span>DODGE / COUNTER</span></li><li><kbd>F</kbd><span>PIN / FINISHER</span></li></>}
  </ul><small>{touch ? 'Hold RUN into the ropes, then hit POWER for a rebound stiff-arm. Move to a corner and tap ACTION to climb, then DIVE.' : 'Hold Shift into the ropes, then press K for a rebound stiff-arm. Move to a corner and press F to climb, then F again to dive.'}</small></aside>;
}
