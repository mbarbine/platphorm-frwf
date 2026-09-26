import { useEffect, useRef } from 'react';
import { useSettings } from '../state/settings';
import { audioEngine } from './audioEngine';
import { BACKGROUND_TRACK } from './musicTrack';

/** One stream across menus, gameplay and rematches, using the existing master bus. */
export function BackgroundMusic({ active }: { active: boolean }) {
  const activeRef = useRef(active);
  const syncRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const media = new Audio();
    media.preload = 'none'; media.loop = true;
    let output: ReturnType<typeof audioEngine.connectMusic> = null;
    let disposed = false; let pending = false; let failed = false;
    const allowed = () => activeRef.current && !document.hidden
      && useSettings.getState().masterVolume > 0 && useSettings.getState().musicVolume > 0;
    const sync = () => {
      if (disposed) return;
      if (!allowed()) { media.pause(); return; }
      output ??= audioEngine.connectMusic(media);
      if (!output) return;
      output.volume(useSettings.getState().musicVolume);
      if (!media.getAttribute('src')) media.src = BACKGROUND_TRACK.src;
      if (!media.paused || pending || failed) return;
      pending = true;
      void media.play().then(() => { if (disposed || !allowed()) media.pause(); })
        .catch(() => { /* Autoplay restrictions are retried on the next real gesture. */ })
        .finally(() => { pending = false; });
    };
    const failure = () => { failed = true; media.pause(); document.documentElement.dataset.musicStatus = 'unavailable'; };
    const playing = () => { document.documentElement.dataset.musicStatus = 'playing'; };
    const pause = () => { if (!failed) document.documentElement.dataset.musicStatus = 'paused'; };
    const retry = () => { failed = false; sync(); };
    media.addEventListener('error', failure); media.addEventListener('playing', playing); media.addEventListener('pause', pause);
    const unsubscribe = useSettings.subscribe(sync);
    window.addEventListener('click', retry); window.addEventListener('keydown', retry);
    document.addEventListener('visibilitychange', sync);
    syncRef.current = sync; sync();
    return () => {
      disposed = true; syncRef.current = null; unsubscribe();
      window.removeEventListener('click', retry); window.removeEventListener('keydown', retry);
      document.removeEventListener('visibilitychange', sync);
      media.removeEventListener('error', failure); media.removeEventListener('playing', playing); media.removeEventListener('pause', pause);
      media.pause(); media.removeAttribute('src'); media.load(); output?.dispose();
      delete document.documentElement.dataset.musicStatus;
    };
  }, []);
  useEffect(() => { activeRef.current = active; syncRef.current?.(); }, [active]);
  return null;
}
