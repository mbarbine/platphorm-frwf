import { useEffect, useRef, useState } from 'react';
import { WorldSign } from './ShowgroundEnvironment';
export const LAWNMOWER_ACTIVITY = { position: { x: 4, z: 15 }, url: 'https://lawnmower.platphormnews.com', radius: 2.6 } as const;
export const nearLawnmower = (p: { x: number; z: number }) => (p.x - 4) ** 2 + (p.z - 15) ** 2 <= LAWNMOWER_ACTIVITY.radius ** 2;
/** One original low-poly push mower, built from reusable primitive geometry. */
export function PushMower() {
  return <group position={[4, 0, 15]}>
    <mesh position={[0, .3, 0]} castShadow><boxGeometry args={[.72, .2, 1]} /><meshStandardMaterial color="#c33c2d" roughness={.65} /></mesh>
    <mesh position={[0, .52, -.06]} castShadow><cylinderGeometry args={[.23, .25, .3, 12]} /><meshStandardMaterial color="#272b2b" /></mesh>
    {[-.4, .4].flatMap(x => [-.32, .35].map(z => <mesh key={`${x}:${z}`} position={[x, .23, z]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[.21, .21, .12, 12]} /><meshStandardMaterial color="#151819" roughness={.95} /></mesh>))}
    {[-.3, .3].map(x => <mesh key={x} position={[x, .82, .82]} rotation={[.65, 0, 0]} castShadow><boxGeometry args={[.045, 1.3, .045]} /><meshStandardMaterial color="#999f9b" metalness={.7} roughness={.3} /></mesh>)}
    <mesh position={[0, 1.34, 1.2]}><boxGeometry args={[.66, .075, .075]} /><meshStandardMaterial color="#1b1e1c" /></mesh>
    <WorldSign text="MOW THE GROUNDS" position={[0, 1.9, -.7]} width={3.2} />
  </group>;
}
export function LawnmowerGame({ onClose }: { onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [coverage, setCoverage] = useState(0);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const origin = LAWNMOWER_ACTIVITY.url;
    const send = (type: string) => frame.current?.contentWindow?.postMessage({ type }, origin);
    const message = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow || event.data?.source !== 'platphorm-lawnmower') return;
      if (event.data.type === 'ready') { setStatus('ready'); window.clearTimeout(timeout); window.clearInterval(hello); }
      if (event.data.type === 'exit') close.current();
      if (event.data.type === 'state' && typeof event.data.coverage === 'number' && Number.isFinite(event.data.coverage)) setCoverage(Math.max(0, Math.min(100, event.data.coverage)));
    };
    const visibility = () => send(document.hidden ? 'lawnmower:pause' : 'lawnmower:resume');
    const keyboard = (event: KeyboardEvent) => { if (event.code === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); } };
    const timeout = window.setTimeout(() => setStatus('error'), 25000);
    const hello = window.setInterval(() => send('lawnmower:hello'), 1000);
    window.addEventListener('message', message);
    window.addEventListener('keydown', keyboard);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.clearTimeout(timeout); window.clearInterval(hello); window.removeEventListener('message', message); window.removeEventListener('keydown', keyboard); document.removeEventListener('visibilitychange', visibility); };
  }, [attempt]);
  return <div className="world-modal" role="dialog" aria-modal="true" aria-label="Lawnmower subgame"><article style={{ width: 'min(1300px, 98vw)', maxWidth: '98vw', height: '94dvh', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><button ref={closeButton} className="button button--quiet" onClick={onClose}>RETURN TO FRWF</button><span aria-live="polite">{status === 'ready' ? `MULCH MADNESS · ${coverage}% mowed` : 'WAKING THE MOWER…'}</span></header>
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <iframe key={attempt} ref={frame} title="Lawnmower game" src={`${LAWNMOWER_ACTIVITY.url}/embed`} style={{ width: '100%', height: '100%', border: 0, borderRadius: 12 }} allow="fullscreen; gamepad" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { setDocumentLoaded(true); frame.current?.contentWindow?.postMessage({ type: 'lawnmower:hello' }, LAWNMOWER_ACTIVITY.url); }} onError={() => setStatus('error')} />
      {!documentLoaded && status === 'loading' && <div role="status" style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', background: '#18352f', borderRadius: 12, pointerEvents: 'none' }}>Loading your backyard. The grass is nervous.</div>}
      {status === 'error' && <div role="alert" style={{ position: 'absolute', bottom: 8, left: 8, right: 8, padding: 12, background: '#18352f', borderRadius: 12 }}><p>The game has not confirmed it is ready. Retry the connection here.</p><button className="button" onClick={() => { setStatus('loading'); setDocumentLoaded(false); setAttempt(n => n + 1); }}>RETRY HERE</button></div>}
    </div>
  </article></div>;
}
