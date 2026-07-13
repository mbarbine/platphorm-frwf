import { create } from 'zustand';
import { advanceMatch, createMatch, requestCommand, resetTransientState } from '../systems/combat';
import type { FrameInput } from '../systems/combat';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
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

let publishAccumulator = 0;

export const useMatchStore = create<MatchStore>((set) => ({
  model: createMatch('atlas', 'nova', 'standard', 'normal'), revision: 0,
  configure: (player, opponent, rules, difficulty, playerBeers = 0, opponentBeers = 0) => set((state) => {
    bodyWorksRuntime.reset(); publishAccumulator = 0;
    return { model: createMatch(player, opponent, rules, difficulty, 1337, playerBeers, opponentBeers), revision: state.revision + 1 };
  }),
  advance: (dt, input) => set((state) => {
    const model = state.model; const previousImpact = model.impactSequence; const wasResolved = model.resolved;
    bodyWorksRuntime.captureInput('player', input, model.elapsed);
    bodyWorksRuntime.resolveCommands('player', model.elapsed, (buffered) => {
      const accepted = requestCommand(model, 'player', buffered.command, buffered.direction);
      if (accepted && buffered.command === 'jump') bodyWorksRuntime.requestJump('player');
      return accepted;
    });
    advanceMatch(model, dt, { ...input, commands: [] });
    publishAccumulator += dt;
    const urgent = previousImpact !== model.impactSequence || wasResolved !== model.resolved;
    if (publishAccumulator >= .1 || urgent) {
      publishAccumulator %= .1;
      return { model: { ...model }, revision: state.revision + 1 };
    }
    return state;
  }),
  pause: (paused) => set((state) => ({ model: { ...state.model, paused }, revision: state.revision + 1 })),
  rematch: () => set((state) => { bodyWorksRuntime.reset(); publishAccumulator = 0; return { model: resetTransientState(state.model), revision: state.revision + 1 }; }),
  debugResolve: () => set((state) => {
    const model = state.model;
    model.opponent.health = 0; model.opponent.state = 'downed'; model.opponent.downTimer = 5; model.player.momentum = 100;
    return { model: { ...model }, revision: state.revision + 1 };
  }),
}));
