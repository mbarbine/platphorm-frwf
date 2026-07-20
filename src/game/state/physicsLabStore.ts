import { create } from 'zustand';

export type LabPlaybackRate = .25 | .5 | 1;

interface PhysicsLabStore {
  rate: LabPlaybackRate;
  debug: boolean;
  setRate: (rate: LabPlaybackRate) => void;
  setDebug: (debug: boolean) => void;
  reset: () => void;
}

export const usePhysicsLabStore = create<PhysicsLabStore>((set) => ({
  rate: 1,
  debug: false,
  setRate: (rate) => set({ rate }),
  setDebug: (debug) => set({ debug }),
  reset: () => set({ rate: 1, debug: false }),
}));

