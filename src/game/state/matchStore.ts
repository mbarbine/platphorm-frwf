import { create } from 'zustand';
import { advanceMatch, applyPhysicalContact, createMatch, requestCommand, resetTransientState } from '../systems/combat';
import type { FrameInput } from '../systems/combat';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import type { BodyWorksContact } from '../physics/physicsRuntime';
import type { Difficulty, FighterId, MatchModel, Ruleset } from '../types/game';

interface MatchStore {
  model: MatchModel;
  revision: number;
  replayActive: boolean;
  configure: (player: FighterId, opponent: FighterId, rules: Ruleset, difficulty: Difficulty, playerBeers?: number, opponentBeers?: number) => void;
  advance: (dt: number, input: FrameInput) => void;
  pause: (paused: boolean) => void;
  setLabMode: (active: boolean) => void;
  setPhysicsAuthority: (active: boolean) => void;
  resolvePhysicsContacts: (contacts: readonly BodyWorksContact[]) => void;
  rematch: () => void;
  startReplay: () => void;
  stopReplay: () => void;
}

let publishAccumulator = 0;

export const useMatchStore = create<MatchStore>((set) => ({
  model: createMatch('atlas', 'nova', 'standard', 'normal'), revision: 0, replayActive: false,
  configure: (player, opponent, rules, difficulty, playerBeers = 0, opponentBeers = 0) => set((state) => {
    bodyWorksRuntime.reset(); publishAccumulator = 0;
    return { model: createMatch(player, opponent, rules, difficulty, 1337, playerBeers, opponentBeers), revision: state.revision + 1, replayActive: false };
  }),
  advance: (dt, input) => set((state) => {
    const model = state.model; const previousImpact = model.impactSequence; const wasResolved = model.resolved;
    bodyWorksRuntime.captureInput('player', input, model.elapsed);
    bodyWorksRuntime.resolveCommands('player', model.elapsed, (buffered) => {
      const wasClimbing = model.player.state === 'climbing';
      const wasNearApron = ((Math.abs(model.player.position.x) > 5.05 && Math.abs(model.player.position.x) < 6.9 && Math.abs(model.player.position.z) < 4.4)
        || (Math.abs(model.player.position.z) > 3.55 && Math.abs(model.player.position.z) < 5.6 && Math.abs(model.player.position.x) < 5.9))
        && model.opponent.state !== 'downed' && model.player.momentum < 100;
      const accepted = requestCommand(model, 'player', buffered.command, buffered.direction);
      if (accepted && buffered.command === 'jump') bodyWorksRuntime.requestJump('player');
      if (accepted && buffered.command === 'context' && !wasClimbing && model.player.state === 'climbing') bodyWorksRuntime.requestCornerClimb('player', model.player.position);
      if (accepted && buffered.command === 'context' && wasClimbing && model.player.state === 'climbing') bodyWorksRuntime.requestCornerClimb('player', model.player.position, model.player.climbStage || 1);
      if (accepted && buffered.command === 'context' && wasClimbing && model.player.moveId === 'aerial') bodyWorksRuntime.requestCornerDive('player', model.opponent.position);
      if (accepted && buffered.command === 'context' && !wasClimbing && wasNearApron && model.player.state === 'locomotion') bodyWorksRuntime.requestApronTransition('player', model.player.position);
      return accepted;
    }, (buffered) => {
      if (!model.resolved) { model.announcement = `${buffered.command.toUpperCase()} — NO OPENING`; model.announcementTimer = .45; }
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
  setLabMode: (active) => set((state) => ({ model: { ...state.model, labMode: active, aiIntent: null, aiMovement: { x: 0, z: 0 }, aiRunning: false, aiBlockTimer: 0 }, revision: state.revision + 1 })),
  setPhysicsAuthority: (active) => set((state) => ({ model: { ...state.model, physicsAuthority: active }, revision: state.revision + 1 })),
  resolvePhysicsContacts: (contacts) => set((state) => {
    let changed = false;
    for (const contact of contacts) changed = applyPhysicalContact(state.model, contact) || changed;
    return changed ? { model: { ...state.model }, revision: state.revision + 1 } : state;
  }),
  rematch: () => set((state) => { bodyWorksRuntime.reset(); publishAccumulator = 0; return { model: resetTransientState(state.model), revision: state.revision + 1, replayActive: false }; }),
  startReplay: () => set((state) => state.replayActive ? state : ({ replayActive: true, revision: state.revision + 1 })),
  stopReplay: () => set((state) => !state.replayActive ? state : ({ replayActive: false, revision: state.revision + 1 })),
}));
