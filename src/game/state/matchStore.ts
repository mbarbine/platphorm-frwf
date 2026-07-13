import { create } from 'zustand';
import { advanceMatch, createMatch, resetTransientState } from '../systems/combat';
import type { FrameInput } from '../systems/combat';
import type { Difficulty, FighterId, MatchModel, Ruleset } from '../types/game';

interface MatchStore {
  model: MatchModel;
  revision: number;
  configure: (player: FighterId, opponent: FighterId, rules: Ruleset, difficulty: Difficulty, playerBeers?: number, opponentBeers?: number) => void;
  advance: (dt: number, input: FrameInput) => void;
  pause: (paused: boolean) => void;
  rematch: () => void;
  debugResolve: () => void;
}

export const useMatchStore = create<MatchStore>((set) => ({
  model: createMatch('atlas', 'nova', 'standard', 'normal'), revision: 0,
  configure: (player, opponent, rules, difficulty, playerBeers = 0, opponentBeers = 0) => set((state) => ({ model: createMatch(player, opponent, rules, difficulty, 1337, playerBeers, opponentBeers), revision: state.revision + 1 })),
  advance: (dt, input) => set((state) => {
    const model = structuredClone(state.model);
    advanceMatch(model, dt, input);
    return { model, revision: state.revision + 1 };
  }),
  pause: (paused) => set((state) => ({ model: { ...state.model, paused }, revision: state.revision + 1 })),
  rematch: () => set((state) => ({ model: resetTransientState(state.model), revision: state.revision + 1 })),
  debugResolve: () => set((state) => {
    const model = structuredClone(state.model);
    model.opponent.health = 0; model.opponent.state = 'downed'; model.opponent.downTimer = 5; model.player.momentum = 100;
    return { model, revision: state.revision + 1 };
  }),
}));
