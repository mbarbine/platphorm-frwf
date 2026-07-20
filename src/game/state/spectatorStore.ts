import { create } from 'zustand';
import { FIGHTER_SLOTS } from '../types/game';
import type { FighterSlot, MatchModel } from '../types/game';

export type SpectatorCameraMode = 'first_person' | 'third_person' | 'free';

interface SpectatorStore {
  cameraMode: SpectatorCameraMode;
  target: FighterSlot;
  setCameraMode: (mode: SpectatorCameraMode) => void;
  setTarget: (target: FighterSlot) => void;
  cycleTarget: (model: MatchModel, direction?: 1 | -1) => void;
  reset: () => void;
}

export const liveSpectatorTargets = (model: MatchModel): FighterSlot[] => FIGHTER_SLOTS.filter((slot) => !['defeated', 'victorious'].includes(model[slot].state));

export const resolvedSpectatorTarget = (model: MatchModel, requested: FighterSlot): FighterSlot => {
  const live = liveSpectatorTargets(model);
  return live.includes(requested) ? requested : live[0] ?? requested;
};

export const useSpectatorStore = create<SpectatorStore>((set) => ({
  cameraMode: 'third_person',
  target: 'opponent',
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setTarget: (target) => set({ target }),
  cycleTarget: (model, direction = 1) => set((state) => {
    const live = liveSpectatorTargets(model);
    if (live.length === 0) return state;
    const current = live.indexOf(resolvedSpectatorTarget(model, state.target));
    return { target: live[(current + direction + live.length) % live.length] ?? live[0] };
  }),
  reset: () => set({ cameraMode: 'third_person', target: 'opponent' }),
}));
