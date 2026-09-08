import { useEffect, useRef, useState } from 'react';
import archive from '../../public/video/manifest.json';
import { useSettings } from '../game/state/settings';

/** Original wrestling footage stays silent and never blocks entering a match. */
export function ArchiveBackdrop({ active = true }: { active?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const reducedMotion = useSettings((settings) => settings.reducedMotion);
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const enabled = active && !paused && !failed && !reducedMotion && !connection?.saveData;
  const clip = archive.clips[index];
  useEffect(() => {
    const media = video.current;
    if (!media) return;
    const sync = () => {
      if (!enabled || document.hidden) media.pause();
      else void media.play().catch(() => { /* Poster remains visible if autoplay is unavailable. */ });
    };
    sync(); document.addEventListener('visibilitychange', sync);
    return () => { media.pause(); document.removeEventListener('visibilitychange', sync); };
  }, [enabled, index]);
  return <div className="archive-backdrop" data-testid="archive-backdrop">
    <video ref={video} muted playsInline preload="none" poster={archive.poster} src={active && !reducedMotion && !connection?.saveData ? clip?.src : undefined} aria-hidden="true" onError={() => setFailed(true)} onEnded={() => setIndex((current) => (current + 1) % archive.clips.length)} />
    <div className="archive-backdrop__shade" />
    <div className="archive-backdrop__caption"><span>FRWF ORIGINALS · REAL RINGSIDE FOOTAGE</span>{active && !reducedMotion && !failed && <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Play background footage' : 'Pause background footage'}>{paused ? 'PLAY FOOTAGE' : 'PAUSE FOOTAGE'}</button>}</div>
  </div>;
}

export function ArenaLoading() {
  return <div className="arena-loading"><ArchiveBackdrop /><div className="arena-loading__copy" role="status"><b>THE VOLT DOME IS POWERING UP</b><span>Getting the ring ready…</span></div></div>;
}
