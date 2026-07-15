import { create } from 'zustand';
import { advanceMatch, applyPhysicalContact, createFighterRuntime, createMatch, cyclePlayerTarget, requestCommand, resetTransientState } from '../systems/combat';
import type { FrameInput } from '../systems/combat';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { getMove } from '../data/moves';
import type { BodyWorksContact } from '../physics/physicsRuntime';
import type { Difficulty, FighterId, FighterState, GameCommand, MatchMode, MatchModel, RecoveryOrientation, Ruleset, Vec2 } from '../types/game';
import { useSpectatorStore } from './spectatorStore';

interface MatchStore {
  model: MatchModel;
  revision: number;
  replayActive: boolean;
  configure: (player: FighterId, opponent: FighterId, rules: Ruleset, difficulty: Difficulty, playerBeers?: number, opponentBeers?: number, matchMode?: MatchMode) => void;
  advance: (dt: number, input: FrameInput) => void;
  pause: (paused: boolean) => void;
  setLabMode: (active: boolean) => void;
  setToyTestMode: (active: boolean) => void;
  configureLab: (player: FighterId, opponent: FighterId, seed: number, playerStaminaPercent: number, opponentStaminaPercent: number, playerAdditionalMass?: number, opponentAdditionalMass?: number) => void;
  requestLabCommand: (fighter: 'player' | 'opponent', command: GameCommand, direction?: Vec2, running?: boolean) => void;
  prepareLabScenario: (playerPosition: Vec2, opponentPosition: Vec2, playerState?: Extract<FighterState, 'idle' | 'blocking' | 'downed'>, opponentHealth?: number, recoveryOrientation?: RecoveryOrientation, downTimer?: number, playerStaminaPercent?: number) => void;
  setPhysicsAuthority: (active: boolean) => void;
  resolvePhysicsContacts: (contacts: readonly BodyWorksContact[]) => void;
  cyclePlayerTarget: (direction?: number) => void;
  rematch: () => void;
  startReplay: () => void;
  stopReplay: () => void;
}

let publishAccumulator = 0;

export const useMatchStore = create<MatchStore>((set) => ({
  model: createMatch('atlas', 'nova', 'standard', 'normal', 1337, 0, 0, 'battle_royale'), revision: 0, replayActive: false,
  configure: (player, opponent, rules, difficulty, playerBeers = 0, opponentBeers = 0, matchMode = 'battle_royale') => set((state) => {
    bodyWorksRuntime.reset(); useSpectatorStore.getState().reset(); publishAccumulator = 0;
    return { model: createMatch(player, opponent, rules, difficulty, 1337, playerBeers, opponentBeers, matchMode), revision: state.revision + 1, replayActive: false };
  }),
  advance: (dt, input) => set((state) => {
    const model = state.model; const previousImpact = model.impactSequence; const wasResolved = model.resolved; let commandAccepted = false;
    bodyWorksRuntime.captureInput('player', input, model.elapsed);
    bodyWorksRuntime.resolveCommands('player', model.elapsed, (buffered) => {
      const wasClimbing = model.player.state === 'climbing';
      const wasDowned = model.player.state === 'downed';
      const wasNearApron = ((Math.abs(model.player.position.x) > 4.62 && Math.abs(model.player.position.x) < 6.9 && Math.abs(model.player.position.z) < 3.55)
        || (Math.abs(model.player.position.z) > 3.05 && Math.abs(model.player.position.z) < 5.6 && Math.abs(model.player.position.x) < 5.15));
      const accepted = requestCommand(model, 'player', buffered.command, buffered.direction, buffered.running);
      commandAccepted ||= accepted;
      if (accepted && buffered.command === 'jump') bodyWorksRuntime.requestJump('player');
      if (accepted && buffered.command === 'dodge' && wasDowned && model.player.moveId === 'kick_up') bodyWorksRuntime.requestJump('player');
      if (accepted && buffered.command === 'dodge' && wasClimbing && model.player.state === 'climbing') bodyWorksRuntime.requestCornerClimb('player', model.player.position, model.player.climbStage || 1);
      if (accepted && buffered.command === 'context' && !wasClimbing && model.player.state === 'climbing') bodyWorksRuntime.requestCornerClimb('player', model.player.position);
      if (accepted && buffered.command === 'context' && wasClimbing && model.player.state === 'climbing') bodyWorksRuntime.requestCornerClimb('player', model.player.position, model.player.climbStage || 1);
      if (accepted && wasClimbing && model.player.moveId && getMove(model.player.moveId).category === 'aerial') bodyWorksRuntime.requestCornerDive('player', model[model.targets.player].position);
      if (accepted && buffered.command === 'context' && !wasClimbing && wasNearApron && model.player.state === 'locomotion') bodyWorksRuntime.requestApronTransition('player', model.player.position);
      return accepted;
    });
    advanceMatch(model, dt, { ...input, commands: [] });
    publishAccumulator += dt;
    const urgent = commandAccepted || previousImpact !== model.impactSequence || wasResolved !== model.resolved;
    if (publishAccumulator >= .1 || urgent) {
      publishAccumulator %= .1;
      return { model: { ...model }, revision: state.revision + 1 };
    }
    return state;
  }),
  pause: (paused) => set((state) => ({ model: { ...state.model, paused }, revision: state.revision + 1 })),
  setLabMode: (active) => set((state) => ({ model: { ...state.model, labMode: active, aiIntent: null, aiMovement: { x: 0, z: 0 }, aiRunning: false, aiBlockTimer: 0 }, revision: state.revision + 1 })),
  setToyTestMode: (active) => set((state) => ({ model: { ...state.model, toyTestMode: active }, revision: state.revision + 1 })),
  configureLab: (playerId, opponentId, seed, playerStaminaPercent, opponentStaminaPercent, playerAdditionalMass = 0, opponentAdditionalMass = 0) => set((state) => {
    bodyWorksRuntime.reset(); publishAccumulator = 0;
    const model = createMatch(playerId, opponentId, 'standard', 'normal', Math.max(1, Math.floor(seed)));
    model.runtimeId = state.model.runtimeId + 1;
    model.labMode = true; model.physicsAuthority = true; model.announcement = 'LAB PAIR LOADED — INPUT LIVE'; model.announcementTimer = .8;
    model.player.stamina = model.player.staminaCap * Math.max(0, Math.min(100, playerStaminaPercent)) / 100;
    model.opponent.stamina = model.opponent.staminaCap * Math.max(0, Math.min(100, opponentStaminaPercent)) / 100;
    model.player.body.mass += Math.max(0, Math.min(120, playerAdditionalMass)); model.opponent.body.mass += Math.max(0, Math.min(120, opponentAdditionalMass));
    bodyWorksRuntime.setLabAdditionalMass('player', playerAdditionalMass); bodyWorksRuntime.setLabAdditionalMass('opponent', opponentAdditionalMass);
    return { model, revision: state.revision + 1, replayActive: false };
  }),
  requestLabCommand: (fighter, command, direction = { x: 0, z: 0 }, running = false) => set((state) => {
    if (!state.model.labMode || !requestCommand(state.model, fighter, command, direction, running)) return state;
    return { model: { ...state.model }, revision: state.revision + 1 };
  }),
  prepareLabScenario: (playerPosition, opponentPosition, playerState = 'idle', opponentHealth = 100, recoveryOrientation = 'back', downTimer = 5, playerStaminaPercent) => set((state) => {
    if (!state.model.labMode) return state;
    bodyWorksRuntime.prepareLabPositions(playerPosition, opponentPosition);
    const player = createFighterRuntime(state.model.player.definitionId, { ...playerPosition }, state.model.player.beersDrunk);
    const opponent = createFighterRuntime(state.model.opponent.definitionId, { ...opponentPosition }, state.model.opponent.beersDrunk);
    player.facing = Math.atan2(opponentPosition.x - playerPosition.x, opponentPosition.z - playerPosition.z);
    opponent.facing = Math.atan2(playerPosition.x - opponentPosition.x, playerPosition.z - opponentPosition.z);
    player.state = playerState; player.downTimer = playerState === 'downed' ? downTimer : 0; player.recoveryOrientation = recoveryOrientation;
    player.stamina = player.staminaCap * (playerStaminaPercent ?? state.model.player.stamina / Math.max(1, state.model.player.staminaCap) * 100) / 100;
    opponent.stamina = opponent.staminaCap * state.model.opponent.stamina / Math.max(1, state.model.opponent.staminaCap);
    opponent.health = Math.max(0, Math.min(100, opponentHealth));
    return { model: { ...state.model, player, opponent, grapple: null, lastImpact: null, hitStop: 0, slowMotion: 0, announcement: 'LAB RESET — INPUT LIVE', announcementTimer: .65, aiIntent: null, aiMovement: { x: 0, z: 0 }, aiRunning: false, aiBlockTimer: 0 }, revision: state.revision + 1, replayActive: false };
  }),
  setPhysicsAuthority: (active) => set((state) => ({ model: { ...state.model, physicsAuthority: active }, revision: state.revision + 1 })),
  resolvePhysicsContacts: (contacts) => set((state) => {
    let changed = false;
    for (const contact of contacts) changed = applyPhysicalContact(state.model, contact) || changed;
    return changed ? { model: { ...state.model }, revision: state.revision + 1 } : state;
  }),
  cyclePlayerTarget: (direction = 1) => set((state) => cyclePlayerTarget(state.model, direction)
    ? { model: { ...state.model }, revision: state.revision + 1 }
    : state),
  rematch: () => set((state) => { bodyWorksRuntime.reset(); useSpectatorStore.getState().reset(); publishAccumulator = 0; return { model: resetTransientState(state.model), revision: state.revision + 1, replayActive: false }; }),
  startReplay: () => set((state) => state.replayActive ? state : ({ replayActive: true, revision: state.revision + 1 })),
  stopReplay: () => set((state) => !state.replayActive ? state : ({ replayActive: false, revision: state.revision + 1 })),
}));
