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
    {touch ? <><li><kbd>STICK</kbd><span>MOVE</span></li><li><kbd>JAB</kbd><span>PUNCH</span></li><li><kbd>HIT</kbd><span>KICK</span></li><li><kbd>LOCK</kbd><span>GRAB</span></li><li><kbd>↯</kbd><span>DODGE</span></li><li><kbd>ACTION</kbd><span>JUMP / SPECIAL</span></li></> : <><li><kbd>WASD</kbd><span>MOVE · SHIFT SPRINT</span></li><li><kbd>J</kbd><span>PUNCH</span></li><li><kbd>K</kbd><span>KICK</span></li><li><kbd>L</kbd><span>GRAB</span></li><li><kbd>SPACE</kbd><span>JUMP</span></li><li><kbd>U</kbd><span>DODGE / COUNTER</span></li><li><kbd>I</kbd><span>GUARD (HOLD)</span></li><li><kbd>F</kbd><span>PIN / SPECIAL</span></li></>}
  </ul><small>{touch ? 'Hold RUN into the ropes to rebound. Move to a corner and tap ACTION to climb, then DIVE.' : 'Rapid J: jab→cross→kick chain. Up+J=high cross, Down+J=low kick, Left+J=hook. Shift+K=clothesline. F near downed=pin. While pinned, mash U/J/K to escape — or press F in the FIRST SECOND to REVERSE the pin on them!'}</small></aside>;
}
