import type { PlayerCameraMode } from '../camera/playerCamera';
import { create } from 'zustand';
import type { GraphicsQuality } from '../runtime/quality';

export interface Settings {
  playerCamera: PlayerCameraMode;
  controlStyle: 'arcade' | 'technical';
  automaticReplays: boolean;
  masterVolume: number;
  effectsVolume: number;
  musicVolume: number;
  crowdVolume: number;
  shake: number;
  reducedMotion: boolean;
  uiScale: number;
  graphicsQuality: GraphicsQuality;
  controlDeckMode: ControlDeckMode;
  grappleGuide: 'full' | 'minimal' | 'off';
  cameraCuts: 'full' | 'reduced' | 'off';
  lowFlash: boolean;
  highContrast: boolean;
}

export type ControlDeckMode = 'full' | 'compact' | 'prompts' | 'hidden';

const DEFAULTS: Settings = { playerCamera: 'broadcast', controlStyle: 'arcade', automaticReplays: false, masterVolume: .72, musicVolume: .28, effectsVolume: .86, crowdVolume: .66, shake: .16, reducedMotion: false, uiScale: 1, graphicsQuality: 'auto', controlDeckMode: 'compact', grappleGuide: 'minimal', cameraCuts: 'off', lowFlash: true, highContrast: false };
const STORAGE_KEY = 'ringfall-settings-v2';

const load = (): Settings => {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULTS, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches };
    const candidate = parsed as Partial<Settings>;
    return {
      playerCamera: candidate.playerCamera === 'first_person' || candidate.playerCamera === 'third_person' ? candidate.playerCamera : 'broadcast',
      controlStyle: candidate.controlStyle === 'technical' ? 'technical' : 'arcade',
      automaticReplays: candidate.automaticReplays === true,
      masterVolume: typeof candidate.masterVolume === 'number' ? Math.min(1, Math.max(0, candidate.masterVolume)) : DEFAULTS.masterVolume,
      musicVolume: typeof candidate.musicVolume === 'number' && Number.isFinite(candidate.musicVolume) ? Math.min(1, Math.max(0, candidate.musicVolume)) : DEFAULTS.musicVolume,
      effectsVolume: typeof candidate.effectsVolume === 'number' ? Math.min(1, Math.max(0, candidate.effectsVolume)) : DEFAULTS.effectsVolume,
      crowdVolume: typeof candidate.crowdVolume === 'number' ? Math.min(1, Math.max(0, candidate.crowdVolume)) : DEFAULTS.crowdVolume,
      shake: typeof candidate.shake === 'number' ? Math.min(1, Math.max(0, candidate.shake)) : DEFAULTS.shake,
      reducedMotion: typeof candidate.reducedMotion === 'boolean' ? candidate.reducedMotion : window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      uiScale: typeof candidate.uiScale === 'number' ? Math.min(1.25, Math.max(.85, candidate.uiScale)) : DEFAULTS.uiScale,
      graphicsQuality: candidate.graphicsQuality === 'performance' || candidate.graphicsQuality === 'quality' ? candidate.graphicsQuality : 'auto',
      controlDeckMode: ['full', 'compact', 'prompts', 'hidden'].includes(candidate.controlDeckMode ?? '') ? candidate.controlDeckMode as ControlDeckMode : DEFAULTS.controlDeckMode,
      grappleGuide: candidate.grappleGuide === 'full' || candidate.grappleGuide === 'off' ? candidate.grappleGuide : DEFAULTS.grappleGuide,
      cameraCuts: candidate.cameraCuts === 'full' || candidate.cameraCuts === 'reduced' ? candidate.cameraCuts : DEFAULTS.cameraCuts,
      lowFlash: typeof candidate.lowFlash === 'boolean' ? candidate.lowFlash : DEFAULTS.lowFlash,
      highContrast: typeof candidate.highContrast === 'boolean' ? candidate.highContrast : DEFAULTS.highContrast,
    };
  } catch { return DEFAULTS; }
};

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const persist = (settings: Settings): void => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Private browsing or full storage must not disable settings. */ }
};

export const useSettings = create<SettingsStore>((set) => ({
  ...load(),
  update: (patch) => set((current) => {
    const next: Settings = { playerCamera: current.playerCamera, controlStyle: current.controlStyle, automaticReplays: current.automaticReplays, masterVolume: current.masterVolume, musicVolume: current.musicVolume, effectsVolume: current.effectsVolume, crowdVolume: current.crowdVolume, shake: current.shake, reducedMotion: current.reducedMotion, uiScale: current.uiScale, graphicsQuality: current.graphicsQuality, controlDeckMode: current.controlDeckMode, grappleGuide: current.grappleGuide, cameraCuts: current.cameraCuts, lowFlash: current.lowFlash, highContrast: current.highContrast, ...patch };
    persist(next); return next;
  }),
  reset: () => { persist(DEFAULTS); set(DEFAULTS); },
}));
