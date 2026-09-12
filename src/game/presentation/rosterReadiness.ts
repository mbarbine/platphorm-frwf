import { create } from 'zustand';
import type { FighterSlot } from '../types/game';

/** Physical bodies alone are insufficient: every selected skin must have rendered a solved pose. */
export const useRosterPresentation = create<{ runtimeId: number; slots: ReadonlySet<FighterSlot>; mark: (runtimeId: number, slot: FighterSlot) => void }>((set,get) => ({
  runtimeId: -1, slots: new Set(),
  mark: (runtimeId,slot) => {
    const state=get(); if(state.runtimeId===runtimeId && state.slots.has(slot)) return;
    set({runtimeId,slots:new Set([...(state.runtimeId===runtimeId ? state.slots : []),slot])});
  },
}));
export function rosterIsPresented(runtimeId: number, slots: readonly FighterSlot[]) {
  const state=useRosterPresentation.getState();
  return state.runtimeId===runtimeId && slots.every(slot=>state.slots.has(slot));
}
