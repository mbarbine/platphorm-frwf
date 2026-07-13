import { describe, expect, it } from 'vitest';
import { chooseAiDecision, isActionLegal } from '../game/ai/utilityAI';
import { fighterById } from '../game/data/fighters';
import { getMove } from '../game/data/moves';
import { advanceMatch, applyMoveHit, createMatch, getAttackPhase, requestCommand, resetTransientState, startMove } from '../game/systems/combat';
import type { FrameInput } from '../game/systems/combat';

const none: FrameInput = { move: { x: 0, z: 0 }, run: false, commands: [] };

describe('deterministic combat rules', () => {
  it('applies damage only during a move active phase', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    expect(startMove(model.player, model.opponent, getMove('heavy'))).toBe(true);
    expect(applyMoveHit(model, 'player', 'opponent', getMove('heavy'))).toBe(false);
    model.player.attackPhase = 'active'; expect(applyMoveHit(model, 'player', 'opponent', getMove('heavy'))).toBe(true);
  });

  it('one attack cannot damage the same target repeatedly', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    startMove(model.player, model.opponent, getMove('jab')); model.player.attackPhase = 'active';
    expect(applyMoveHit(model, 'player', 'opponent', getMove('jab'))).toBe(true);
    const health = model.opponent.health; expect(applyMoveHit(model, 'player', 'opponent', getMove('jab'))).toBe(false); expect(model.opponent.health).toBe(health);
  });

  it('stamina cannot fall below zero', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.stamina = 4;
    expect(requestCommand(model, 'player', 'heavy')).toBe(false); expect(model.player.stamina).toBe(4);
    model.player.stamina = 8; requestCommand(model, 'player', 'dodge'); expect(model.player.stamina).toBe(0);
  });

  it('momentum cannot exceed its maximum', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 }; model.player.momentum = 99;
    startMove(model.player, model.opponent, getMove('heavy')); model.player.attackPhase = 'active'; applyMoveHit(model, 'player', 'opponent', getMove('heavy'));
    expect(model.player.momentum).toBe(100);
  });

  it('finisher cannot start before momentum is full', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 }; model.opponent.state = 'staggered'; model.player.momentum = 99;
    expect(requestCommand(model, 'player', 'context')).toBe(false); model.player.momentum = 100; expect(requestCommand(model, 'player', 'context')).toBe(true);
  });

  it('pin cannot begin against a standing opponent', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    expect(requestCommand(model, 'player', 'context')).toBe(false); expect(model.opponent.state).not.toBe('pinned');
  });

  it('successful counter interrupts the incoming move', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    startMove(model.opponent, model.player, getMove('heavy')); model.opponent.phaseElapsed = .25; model.opponent.attackPhase = 'anticipation';
    expect(requestCommand(model, 'player', 'dodge')).toBe(true); expect(model.opponent.moveId).toBeNull(); expect(model.opponent.state).toBe('staggered'); expect(model.playerStats.counters).toBe(1);
  });

  it('pausing prevents combat simulation advancement', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.paused = true; const snapshot = structuredClone(model);
    advanceMatch(model, 1, { move: { x: 1, z: 0 }, run: true, commands: ['heavy'] });
    expect(model).toEqual(snapshot);
  });

  it('rematch clears all transient match state', () => {
    const model = createMatch('atlas', 'vex', 'chaos', 'hard'); model.elapsed = 99; model.player.health = 3; model.player.momentum = 100; model.hype = 92; model.announcement = 'OLD';
    const reset = resetTransientState(model);
    expect(reset.elapsed).toBe(0); expect(reset.player.health).toBe(100); expect(reset.player.momentum).toBe(0); expect(reset.result).toBeNull(); expect(reset.hitStop).toBe(0); expect(reset.ruleset).toBe('chaos');
  });

  it('AI never selects an illegal action for its state or stamina', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'hard'); model.opponent.stamina = 3; model.opponent.state = 'downed';
    const decision = chooseAiDecision(model, fighterById('nova'));
    if (decision.command) expect(isActionLegal(model, decision.command, 'opponent')).toBe(true);
  });

  it('reports explicit anticipation, active, recovery phases', () => {
    const move = getMove('heavy');
    expect(getAttackPhase(move, .1)).toBe('anticipation'); expect(getAttackPhase(move, .45)).toBe('active'); expect(getAttackPhase(move, .7)).toBe('recovery'); expect(getAttackPhase(move, 2)).toBeNull();
  });

  it('simulation is deterministic from identical state and input', () => {
    const a = createMatch('brick', 'nova', 'chaos', 'normal', 44); const b = structuredClone(a);
    for (let index = 0; index < 90; index += 1) { advanceMatch(a, 1 / 30, none); advanceMatch(b, 1 / 30, none); }
    expect(a).toEqual(b);
  });

  it('completes a finisher knockout and resets for an immediate rematch', () => {
    const model = createMatch('brick', 'atlas', 'chaos', 'hard'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    model.player.momentum = 100; model.opponent.health = 18; model.opponent.state = 'staggered';
    expect(requestCommand(model, 'player', 'context')).toBe(true); model.player.attackPhase = 'active';
    expect(applyMoveHit(model, 'player', 'opponent', getMove('finisher'))).toBe(true);
    expect(model.result).toMatchObject({ winner: 'player', method: 'KNOCKOUT' });
    const rematch = resetTransientState(model);
    expect(rematch.resolved).toBe(false); expect(rematch.result).toBeNull(); expect(rematch.player.health).toBe(100); expect(rematch.opponent.health).toBe(100);
  });
});
