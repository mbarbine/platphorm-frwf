import { create } from 'zustand';
import type { GraphicsQuality } from '../runtime/quality';

export interface Settings {
  masterVolume: number;
  effectsVolume: number;
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

const DEFAULTS: Settings = { masterVolume: .72, effectsVolume: .86, crowdVolume: .66, shake: .65, reducedMotion: false, uiScale: 1, graphicsQuality: 'auto', controlDeckMode: 'full', grappleGuide: 'full', cameraCuts: 'full', lowFlash: false, highContrast: false };
const STORAGE_KEY = 'ringfall-settings-v1';

const load = (): Settings => {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return DEFAULTS;
    const candidate = parsed as Partial<Settings>;
    return {
      masterVolume: typeof candidate.masterVolume === 'number' ? Math.min(1, Math.max(0, candidate.masterVolume)) : DEFAULTS.masterVolume,
      effectsVolume: typeof candidate.effectsVolume === 'number' ? Math.min(1, Math.max(0, candidate.effectsVolume)) : DEFAULTS.effectsVolume,
      crowdVolume: typeof candidate.crowdVolume === 'number' ? Math.min(1, Math.max(0, candidate.crowdVolume)) : DEFAULTS.crowdVolume,
      shake: typeof candidate.shake === 'number' ? Math.min(1, Math.max(0, candidate.shake)) : DEFAULTS.shake,
      reducedMotion: typeof candidate.reducedMotion === 'boolean' ? candidate.reducedMotion : window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      uiScale: typeof candidate.uiScale === 'number' ? Math.min(1.25, Math.max(.85, candidate.uiScale)) : DEFAULTS.uiScale,
      graphicsQuality: candidate.graphicsQuality === 'performance' || candidate.graphicsQuality === 'quality' ? candidate.graphicsQuality : 'auto',
      controlDeckMode: candidate.controlDeckMode === 'compact' || candidate.controlDeckMode === 'prompts' || candidate.controlDeckMode === 'hidden' ? candidate.controlDeckMode : 'full',
      grappleGuide: candidate.grappleGuide === 'minimal' || candidate.grappleGuide === 'off' ? candidate.grappleGuide : 'full',
      cameraCuts: candidate.cameraCuts === 'reduced' || candidate.cameraCuts === 'off' ? candidate.cameraCuts : 'full',
      lowFlash: typeof candidate.lowFlash === 'boolean' ? candidate.lowFlash : DEFAULTS.lowFlash,
      highContrast: typeof candidate.highContrast === 'boolean' ? candidate.highContrast : DEFAULTS.highContrast,
    };
  } catch { return DEFAULTS; }
};

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const persist = (settings: Settings): void => localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

export const useSettings = create<SettingsStore>((set) => ({
  ...load(),
  update: (patch) => set((current) => {
    const next: Settings = { masterVolume: current.masterVolume, effectsVolume: current.effectsVolume, crowdVolume: current.crowdVolume, shake: current.shake, reducedMotion: current.reducedMotion, uiScale: current.uiScale, graphicsQuality: current.graphicsQuality, controlDeckMode: current.controlDeckMode, grappleGuide: current.grappleGuide, cameraCuts: current.cameraCuts, lowFlash: current.lowFlash, highContrast: current.highContrast, ...patch };
    persist(next); return next;
  }),
  reset: () => { persist(DEFAULTS); set(DEFAULTS); },
}));
