import { describe, expect, it } from 'vitest';
import { chooseAiDecision, isActionLegal } from '../game/ai/utilityAI';
import { cinematicProgress, getPairedPose, getStrikePose, getStrikeReactionPose, getTauntPose, strikePresentationProgress } from '../game/animation/choreography';
import { FIGHTERS, fighterById } from '../game/data/fighters';
import { getMove } from '../game/data/moves';
import { activeFighterSlots, advanceMatch, applyMoveHit, applyPhysicalContact, createMatch, getAttackPhase, requestCommand, resetTransientState, resolveMatch, selectDirectionalGrapple, selectDirectionalStrike, startMove } from '../game/systems/combat';
import { canTransition } from '../game/systems/stateMachine';
import type { FrameInput } from '../game/systems/combat';
import { BodyWorksRuntime } from '../game/physics/physicsRuntime';
import { createActionEvent } from '../game/input/actionLayer';

const none: FrameInput = { move: { x: 0, z: 0 }, run: false, block: false, commands: [] };

describe('deterministic combat rules', () => {
  it('creates a five-wrestler Battle Royale with unique entrants and live rival targets', () => {
    const model = createMatch('atlas', 'atlas', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    const slots = activeFighterSlots(model);
    expect(slots).toHaveLength(5);
    expect(new Set(slots.map((slot) => model[slot].definitionId))).toEqual(new Set(FIGHTERS.map(({ id }) => id)));
    expect(new Set(slots.map((slot) => `${model[slot].position.x}:${model[slot].position.z}`)).size).toBe(5);
    for (const slot of slots) {
      expect(model.targets[slot]).not.toBe(slot);
      expect(slots).toContain(model.targets[slot]);
    }
  });

  it('gives the player an opening-bell movement head start before Battle Royale AI attacks', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    const startingPositions = activeFighterSlots(model).map((slot) => ({ ...model[slot].position }));
    const move: FrameInput = { ...none, move: { x: 1, z: 0 }, run: true };
    for (let frame = 0; frame < 240; frame += 1) advanceMatch(model, 1 / 60, move);
    const [playerStart, ...aiStarts] = startingPositions;
    expect(activeFighterSlots(model).map((slot) => model[slot].health)).toEqual([100, 100, 100, 100, 100]);
    expect(playerStart).toBeDefined();
    expect(playerStart ? Math.hypot(model.player.position.x - playerStart.x, model.player.position.z - playerStart.z) : 0).toBeGreaterThan(1);
    expect(activeFighterSlots(model).slice(1).map((slot) => model[slot].position)).toEqual(aiStarts);
  });

  it('keeps Battle Royale running through four eliminations and declares the last wrestler standing', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    for (const loser of ['opponent', 'rival1', 'rival2'] as const) {
      resolveMatch(model, 'player', 'KNOCKOUT', loser);
      expect(model.resolved).toBe(false);
      expect(model[loser].state).toBe('defeated');
      const remaining = activeFighterSlots(model).filter((slot) => model[slot].state !== 'defeated');
      for (const slot of remaining) expect(remaining).toContain(model.targets[slot]);
    }
    resolveMatch(model, 'player', 'KNOCKOUT', 'rival3');
    expect(model.resolved).toBe(true);
    expect(model.result?.winner).toBe('player');
    expect(model.player.state).toBe('victorious');
    expect(model.eliminations.map(({ fighter }) => fighter)).toEqual(['opponent', 'rival1', 'rival2', 'rival3']);
  });

  it('preserves the singles result contract by marking the loser defeated', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal');
    resolveMatch(model, 'player', 'PINFALL', 'opponent');
    expect(model.resolved).toBe(true);
    expect(model.player.state).toBe('victorious');
    expect(model.opponent.state).toBe('defeated');
  });

  it('allows only one pin sequence across a Battle Royale ring', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    model.elapsed = 90; model.opponent.state = 'pinning'; model.player.state = 'pinned';
    model.targets.rival1 = 'rival2'; model.rival1.position = { x: 0, z: 0 }; model.rival2.position = { x: .8, z: 0 };
    model.rival2.state = 'downed'; model.rival2.health = 4;
    expect(isActionLegal(model, 'context', 'rival1')).toBe(false);
    expect(requestCommand(model, 'rival1', 'context')).toBe(false);
    expect(model.rival2.state).toBe('downed');
  });

  it('eliminates a zero-health guard after blocked major-impact chip', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 }; model.opponent.state = 'blocking'; model.opponent.health = .1;
    expect(startMove(model.player, model.opponent, getMove('heavy'))).toBe(true); model.player.attackPhase = 'active';
    expect(applyMoveHit(model, 'player', 'opponent', getMove('heavy'))).toBe(true);
    expect(model.opponent.state).toBe('defeated'); expect(model.eliminations[0]?.fighter).toBe('opponent'); expect(model.resolved).toBe(false);
  });

  it('releases both sides of a Battle Royale pin after an elimination', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    model.opponent.state = 'pinning'; model.player.state = 'pinned';
    resolveMatch(model, 'opponent', 'PINFALL', 'player');
    expect(model.resolved).toBe(false); expect(model.player.state).toBe('defeated'); expect(model.opponent.state).toBe('idle');
    expect(activeFighterSlots(model).some((slot) => model[slot].state === 'pinning' || model[slot].state === 'pinned')).toBe(false);
  });

  it('recovers an orphaned pinned wrestler instead of freezing the ring', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'battle_royale'); model.rival3.state = 'pinned';
    advanceMatch(model, 1 / 30, none);
    expect(model.rival3.state).toBe('downed'); expect(model.elapsed).toBeGreaterThan(0);
  });

  it('eliminates the rival actually struck when a Battle Royale attack catches a bystander', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 }; model.rival1.position = { x: .8, z: 0 }; model.rival1.health = 1;
    expect(startMove(model.player, model.opponent, getMove('heavy'))).toBe(true);
    model.player.attackPhase = 'active';
    expect(applyMoveHit(model, 'player', 'rival1', getMove('heavy'))).toBe(true);
    expect(model.rival1.state).toBe('defeated');
    expect(model.opponent.state).not.toBe('defeated');
    expect(model.eliminations[0]?.fighter).toBe('rival1');
  });

  it('eliminates a zero-health Battle Royale wrestler without waiting for another major move', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: .8, z: 0 }; model.opponent.health = 1;
    expect(startMove(model.player, model.opponent, getMove('jab'))).toBe(true); model.player.attackPhase = 'active';
    expect(applyMoveHit(model, 'player', 'opponent', getMove('jab'))).toBe(true);
    expect(model.opponent.state).toBe('defeated'); expect(model.eliminations[0]?.fighter).toBe('opponent');
  });

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

  it('runs the UI-free toy test without health, score, or match progression', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.toyTestMode = true; model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    startMove(model.player, model.opponent, getMove('heavy')); model.player.attackPhase = 'active';
    expect(applyMoveHit(model, 'player', 'opponent', getMove('heavy'))).toBe(true);
    expect(model.opponent.health).toBe(100); expect(model.player.momentum).toBe(0); expect(model.hype).toBe(8); expect(model.playerStats.damageDealt).toBe(0); expect(model.result).toBeNull();
    expect(['staggered', 'downed', 'airborne']).toContain(model.opponent.state);
  });

  it('stamina cannot fall below zero', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.stamina = 4;
    expect(requestCommand(model, 'player', 'heavy')).toBe(false); expect(model.player.stamina).toBe(4);
    model.player.stamina = 8; requestCommand(model, 'player', 'dodge'); expect(model.player.stamina).toBe(0);
  });

  it('accepts jump input through normal articulated grounded bounce', () => {
    const model = createMatch('vex', 'atlas', 'standard', 'normal'); model.player.body.verticalOffset = .18;
    expect(requestCommand(model, 'player', 'jump')).toBe(true); expect(model.player.state).toBe('jumping');
    expect(requestCommand(model, 'player', 'jump')).toBe(false);
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

  it('chooses a left or right stiff-arm after a rope rebound', () => {
    const left = createMatch('atlas', 'vex', 'standard', 'normal'); left.player.position = { x: 4.8, z: 0 }; left.opponent.position = { x: 3.4, z: 0 }; left.player.ropeRebound = 1.1;
    expect(requestCommand(left, 'player', 'heavy', { x: -1, z: 0 }, true)).toBe(true); expect(left.player.moveId).toBe('rebound');
    const right = createMatch('atlas', 'vex', 'standard', 'normal'); right.player.position = { x: 4.8, z: 0 }; right.opponent.position = { x: 3.4, z: 0 }; right.player.ropeRebound = 1.1;
    expect(requestCommand(right, 'player', 'heavy', { x: 1, z: 0 }, true)).toBe(true); expect(right.player.moveId).toBe('stiff_arm');
    expect(getMove('stiff_arm').anticipationDuration).toBeLessThanOrEqual(.08); expect(getMove('stiff_arm').counterWindow?.[1]).toBeLessThanOrEqual(.08);
  });

  it('catches a blocked aerial attack and turns it into a countered slam', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 0.8, z: 0 }; model.player.state = 'climbing'; model.player.climbStage = 3;
    expect(requestCommand(model, 'player', 'context')).toBe(true); model.player.attackPhase = 'active'; model.opponent.state = 'blocking'; model.opponent.stamina = 25;
    expect(applyMoveHit(model, 'player', 'opponent', getMove('aerial'))).toBe(true);
    expect(model.player.state).toBe('downed'); expect(model.player.recoveryOrientation).toBe('back'); expect(model.opponent.moveId).toBe('counter');
  });

  it('prioritizes a valid pin over an accidental corner climb', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 4.8, z: 3.25 }; model.opponent.position = { x: 4.7, z: 3.1 }; model.opponent.state = 'downed';
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.state).toBe('pinning'); expect(model.opponent.state).toBe('pinned');
  });

  it('buffers commands FIFO and releases at most one legal action per fixed step', () => {
    const runtime = new BodyWorksRuntime(); const accepted: string[] = [];
    runtime.captureInput('player', { ...none, commands: ['grapple', 'heavy'] }, 0);
    expect(runtime.metrics.actionBuffered).toBe(2); expect(runtime.actionFeedback()?.status).toBe('buffered');
    runtime.resolveCommands('player', .01, (command) => { accepted.push(command.command); return true; });
    expect(accepted).toEqual(['grapple']); expect(runtime.pendingCommandCount()).toBe(1); expect(runtime.actionFeedback()).toMatchObject({ status: 'executed', event: { action: 'grapple' } });
    runtime.resolveCommands('player', .02, (command) => { accepted.push(command.command); return true; });
    expect(accepted).toEqual(['grapple', 'heavy']); expect(runtime.pendingCommandCount()).toBe(0); expect(runtime.metrics.actionExecuted).toBe(2); expect(runtime.metrics.actionMaximumWaitMs).toBe(20);
  });

  it('captures and executes a semantic action through the authoritative runtime buffer', () => {
    const runtime = new BodyWorksRuntime(); const accepted: string[] = [];
    const action = createActionEvent('quickStrike', { source: 'gamepad', timestamp: 50, sequence: 41, direction: { x: .25, z: -.5 } });
    runtime.captureInput('player', { ...none, commands: [], actions: [action] }, .05);
    expect(runtime.metrics.actionBuffered).toBe(1);
    expect(runtime.actionFeedback()).toMatchObject({ status: 'buffered', event: { action: 'quickStrike', source: 'gamepad', sequence: 41 } });
    runtime.resolveCommands('player', .06, (command) => { accepted.push(command.command); return { executed: true, displayName: 'CIRCUIT JAB' }; });
    expect(accepted).toEqual(['quick']);
    expect(runtime.metrics.actionExecuted).toBe(1);
    expect(runtime.actionFeedback()).toMatchObject({ status: 'executed', displayName: 'CIRCUIT JAB' });
  });

  it('expires stale buffered commands instead of executing them later', () => {
    const runtime = new BodyWorksRuntime(); const expired: string[] = []; let executed = false;
    runtime.captureInput('player', { ...none, commands: ['heavy'] }, 1);
    runtime.resolveCommands('player', 1.151, () => { executed = true; return true; }, (command) => expired.push(command.command));
    expect(executed).toBe(false); expect(expired).toEqual(['heavy']); expect(runtime.pendingCommandCount()).toBe(0); expect(runtime.metrics.actionExpired).toBe(1); expect(runtime.actionFeedback()?.status).toBe('expired');
  });

  it('uses a shorter context window and rejects pending control when the match pauses', () => {
    const runtime = new BodyWorksRuntime(); let executed = false;
    runtime.captureInput('player', { ...none, actions: [createActionEvent('contextAction', { source: 'keyboard', timestamp: 0, sequence: 51 })] }, 0);
    runtime.resolveCommands('player', .111, () => { executed = true; return true; });
    expect(executed).toBe(false); expect(runtime.metrics.actionExpired).toBe(1);
    runtime.captureInput('player', { ...none, actions: [createActionEvent('grapple', { source: 'keyboard', timestamp: 120, sequence: 52 })] }, .12);
    expect(runtime.rejectPendingActions('player', .13, 'Match paused')).toBe(1);
    expect(runtime.pendingCommandCount()).toBe(0); expect(runtime.metrics.actionRejected).toBe(1);
    expect(runtime.actionFeedback()).toMatchObject({ status: 'rejected', reason: 'Match paused', event: { action: 'grapple' } });
  });

  it('successful counter interrupts the incoming move', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    startMove(model.opponent, model.player, getMove('heavy')); model.opponent.phaseElapsed = .16; model.opponent.attackPhase = 'anticipation';
    expect(requestCommand(model, 'player', 'dodge')).toBe(true); expect(model.opponent.moveId).toBeNull(); expect(model.opponent.state).toBe('staggered'); expect(model.playerStats.counters).toBe(1);
  });

  it('pausing prevents combat simulation advancement', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.paused = true; const snapshot = structuredClone(model);
    advanceMatch(model, 1, { move: { x: 1, z: 0 }, run: true, block: false, commands: ['heavy'] });
    expect(model).toEqual(snapshot);
  });

  it('rematch clears all transient match state', () => {
    const model = createMatch('atlas', 'vex', 'chaos', 'hard'); const runtimeId = model.runtimeId; model.seed += 41; model.elapsed = 99; model.player.health = 3; model.player.momentum = 100; model.hype = 92; model.announcement = 'OLD';
    const reset = resetTransientState(model);
    expect(model.runtimeId).toBe(runtimeId); expect(reset.runtimeId).not.toBe(runtimeId); expect(reset.elapsed).toBe(0); expect(reset.player.health).toBe(100); expect(reset.player.momentum).toBe(0); expect(reset.result).toBeNull(); expect(reset.hitStop).toBe(0); expect(reset.ruleset).toBe('chaos');
  });

  it('AI never selects an illegal action for its state or stamina', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'hard'); model.opponent.stamina = 3; model.opponent.state = 'downed';
    const decision = chooseAiDecision(model, fighterById('nova'));
    if (decision.command) expect(isActionLegal(model, decision.command, 'opponent')).toBe(true);
  });

  it('AI deliberately disengages to recover instead of guard-looping at empty stamina', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal'); model.opponent.stamina = 4; model.opponent.position = { x: 0, z: 0 }; model.player.position = { x: 1, z: 0 };
    const decision = chooseAiDecision(model, fighterById('nova'));
    expect(decision.command).toBeNull(); expect(decision.move.x).toBeLessThan(0);
  });

  it('uses a legal point-blank strike to prevent a Battle Royale overtime deadlock', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal', 1337, 0, 0, 'battle_royale'); model.elapsed = 120;
    model.targets.opponent = 'player'; model.opponent.position = { x: 0, z: 0 }; model.player.position = { x: .2, z: 0 }; model.opponent.stamina = 90;
    const decision = chooseAiDecision(model, fighterById('nova'));
    const diagnostics = { decision, separation: Math.hypot(model.opponent.position.x - model.player.position.x, model.opponent.position.z - model.player.position.z), minimum: getMove('front_kick').minimumRange, target: model.targets.opponent, ropeRebound: model.opponent.ropeRebound, heldProp: model.opponent.heldPropId };
    expect(decision.command, JSON.stringify(diagnostics)).toBe('quick'); expect(decision.move).toEqual({ x: 0, z: 0 });
  });

  it('AI pursues and interacts with a real ringside prop in Chaos Circuit', () => {
    const model = createMatch('atlas', 'brick', 'chaos', 'normal'); model.elapsed = 8; model.opponent.health = 88; model.opponent.position = { x: 4.3, z: -2.4 };
    const approach = chooseAiDecision(model, fighterById('brick')); expect(approach.command).toBeNull(); expect(approach.move.x).toBeGreaterThan(0);
    model.opponent.position = { x: 6.9, z: -2.4 }; const pickup = chooseAiDecision(model, fighterById('brick'));
    expect(pickup.command).toBe('interact');
  });

  it('AI requests a physical apron transition while pursuing a ringside prop', () => {
    const model = createMatch('atlas', 'brick', 'chaos', 'normal'); model.elapsed = 8; model.opponent.health = 88; model.opponent.position = { x: 5.3, z: -2.4 };
    expect(chooseAiDecision(model, fighterById('brick')).command).toBe('context');
  });

  it('AI stays ringside to secure a nearby Chaos prop before returning to the ring', () => {
    const model = createMatch('atlas', 'brick', 'chaos', 'normal'); model.elapsed = 8; model.opponent.health = 88; model.opponent.position = { x: 6.3, z: -2.4 };
    expect(isActionLegal(model, 'context', 'opponent')).toBe(true);
    expect(chooseAiDecision(model, fighterById('brick')).command).toBe('interact');
  });

  it('AI prioritizes a legal weapon swing once a physical prop is secured', () => {
    const model = createMatch('atlas', 'nova', 'chaos', 'normal'); const chair = model.props.find((prop) => prop.kind === 'chair'); if (!chair) throw new Error('Missing chair');
    model.opponent.position = { x: 0, z: 0 }; model.player.position = { x: 1.2, z: 0 }; model.opponent.heldPropId = chair.id; chair.heldBy = 'opponent'; model.opponent.stamina = 30;
    expect(chooseAiDecision(model, fighterById('nova')).command).toBe('heavy');
  });

  it('AI cannot steal an early pin after a routine knockdown', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.state = 'downed'; model.player.health = 20; model.opponent.position = { ...model.player.position };
    expect(isActionLegal(model, 'context', 'opponent')).toBe(false);
    model.elapsed = 61; expect(isActionLegal(model, 'context', 'opponent')).toBe(true);
  });

  it('grapple visibly owns the target through grab, lift, and landing states', () => {
    const model = createMatch('chad', 'atlas', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    expect(requestCommand(model, 'player', 'grapple')).toBe(true); expect(model.opponent.state).toBe('grabbed');
    model.player.attackPhase = 'active'; expect(applyMoveHit(model, 'player', 'opponent', getMove(model.player.moveId ?? 'slam'))).toBe(true);
    expect(model.opponent.state).toBe('airborne');
    model.hitStop = 0; model.slowMotion = 0; advanceMatch(model, .4, none); expect(model.opponent.state).toBe('downed');
  });

  it('authors every grapple as a paired actor and victim sequence', () => {
    const grappleIds = ['slam', 'suplex', 'takedown', 'whip', 'arm_drag', 'skyhook', 'powerbomb', 'clutch', 'spinebuster', 'side_toss', 'mountain_drop', 'corner_smash'];
    for (const id of grappleIds) {
      const move = getMove(id);
      expect(getPairedPose(move, 'actor', 'anticipation', move.anticipationDuration * .8, 'atlas')).not.toBeNull();
      expect(getPairedPose(move, 'victim', 'active', move.anticipationDuration + move.activeDuration * .5, 'atlas')).not.toBeNull();
    }
  });

  it('gives all five wrestlers a distinct body-slam peak silhouette', () => {
    const slam = getMove('slam'); const elapsed = slam.anticipationDuration + slam.activeDuration * .25;
    const peaks = FIGHTERS.map((fighter) => getPairedPose(slam, 'victim', 'active', elapsed, fighter.id));
    expect(new Set(peaks.map((entry) => `${entry?.rootY.toFixed(3)}:${entry?.rootYaw.toFixed(3)}:${entry?.rootRoll.toFixed(3)}:${entry?.rootTilt.toFixed(3)}`)).size).toBe(5);
  });

  it('gives all five wrestlers a distinct signature taunt silhouette', () => {
    const taunt = getMove('taunt');
    const fingerprints = FIGHTERS.map((fighter) => JSON.stringify(getTauntPose(fighter.id, taunt, 'active', taunt.anticipationDuration + taunt.activeDuration * .35)));
    expect(new Set(fingerprints).size).toBe(FIGHTERS.length);
  });

  it('gives powerbombs, chokes, and suplexes visibly different victim staging', () => {
    const powerbomb = getMove('powerbomb'); const choke = getMove('clutch'); const suplex = getMove('suplex');
    const powerbombPose = getPairedPose(powerbomb, 'victim', 'active', powerbomb.anticipationDuration + .01, 'atlas');
    const chokePose = getPairedPose(choke, 'victim', 'active', choke.anticipationDuration + .01, 'chad');
    const suplexPose = getPairedPose(suplex, 'victim', 'active', suplex.anticipationDuration + .01, 'nova');
    expect(powerbombPose?.rootY).toBeGreaterThan(1.5); expect(chokePose?.rootY).toBeLessThan(1);
    expect(suplexPose?.rootTilt).not.toBe(powerbombPose?.rootTilt);
  });

  it('stages punch windup, contact, and articulated elbow follow-through', () => {
    const jab = getMove('jab');
    const windup = getStrikePose(jab, 'anticipation', jab.anticipationDuration * .7);
    const contact = getStrikePose(jab, 'active', jab.anticipationDuration + jab.activeDuration * .55);
    expect(windup).not.toBeNull(); expect(contact).not.toBeNull();
    expect(contact?.rightArm[0]).toBeLessThan(windup?.rightArm[0] ?? 0);
    expect(contact?.rightForearm).not.toEqual(windup?.rightForearm);
  });

  it('holds a strike contact silhouette without slowing combat authority', () => {
    const jab = getMove('jab');
    const earlyContact = strikePresentationProgress(jab, 'active', jab.anticipationDuration + jab.activeDuration * .55);
    const lateContact = strikePresentationProgress(jab, 'active', jab.anticipationDuration + jab.activeDuration * .95);
    const earlyRecovery = strikePresentationProgress(jab, 'recovery', jab.anticipationDuration + jab.activeDuration + jab.recoveryDuration * .2);
    const lateRecovery = strikePresentationProgress(jab, 'recovery', jab.anticipationDuration + jab.activeDuration + jab.recoveryDuration * .8);
    expect(earlyContact).toBeGreaterThanOrEqual(.72);
    expect(lateContact - earlyContact).toBeLessThan(.04);
    expect(earlyRecovery).toBe(.76);
    expect(lateRecovery).toBeGreaterThan(earlyRecovery);
  });

  it('snaps the victim into distinct light and heavy contact reactions', () => {
    const jab = getMove('jab'); const heavy = getMove('heavy');
    const jabReaction = getStrikeReactionPose(jab, 'active', jab.anticipationDuration + jab.activeDuration * .6);
    const heavyReaction = getStrikeReactionPose(heavy, 'active', heavy.anticipationDuration + heavy.activeDuration * .6);
    expect(jabReaction).not.toBeNull(); expect(heavyReaction).not.toBeNull();
    expect(Math.abs(heavyReaction?.rootTilt ?? 0)).toBeGreaterThan(Math.abs(jabReaction?.rootTilt ?? 0));
    expect(heavyReaction?.leftLeg).not.toEqual(jabReaction?.leftLeg);
  });

  it('keeps cinematic phase progress monotonic across anticipation, contact, and recovery', () => {
    const slam = getMove('slam');
    const anticipation = cinematicProgress(slam, 'anticipation', slam.anticipationDuration * .5);
    const contact = cinematicProgress(slam, 'active', slam.anticipationDuration + slam.activeDuration * .5);
    const recovery = cinematicProgress(slam, 'recovery', slam.anticipationDuration + slam.activeDuration + slam.recoveryDuration * .5);
    expect(anticipation).toBeLessThan(contact); expect(contact).toBeLessThan(recovery); expect(recovery).toBeLessThanOrEqual(1);
  });

  it('reports explicit anticipation, active, recovery phases', () => {
    const move = getMove('heavy');
    // heavy: anticipation .26, active .16 (active ends at .42), recovery .38 (ends at .80)
    expect(getAttackPhase(move, .1)).toBe('anticipation'); expect(getAttackPhase(move, .34)).toBe('active'); expect(getAttackPhase(move, .56)).toBe('recovery'); expect(getAttackPhase(move, 2)).toBeNull();
  });

  it('simulation is deterministic from identical state and input', () => {
    const a = createMatch('brick', 'nova', 'chaos', 'normal', 44); const b = structuredClone(a);
    for (let index = 0; index < 90; index += 1) { advanceMatch(a, 1 / 30, none); advanceMatch(b, 1 / 30, none); }
    expect(a).toEqual(b);
  });

  it('completes a finisher knockout and resets for an immediate rematch', () => {
    const model = createMatch('brick', 'atlas', 'chaos', 'hard'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    model.player.momentum = 100; model.opponent.health = 8; model.opponent.state = 'staggered';
    expect(requestCommand(model, 'player', 'context')).toBe(true); model.player.attackPhase = 'active';
    expect(applyMoveHit(model, 'player', 'opponent', getMove('finisher'))).toBe(true);
    expect(model.result).toMatchObject({ winner: 'player', method: 'KNOCKOUT' });
    const rematch = resetTransientState(model);
    expect(rematch.resolved).toBe(false); expect(rematch.result).toBeNull(); expect(rematch.player.health).toBe(100); expect(rematch.opponent.health).toBe(100);
  });

  it('locks the victim into a paired signature sequence before finisher contact', () => {
    const model = createMatch('chad', 'atlas', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    model.player.momentum = 100; model.opponent.state = 'staggered';
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.opponent.state).toBe('grabbed');
    advanceMatch(model, .2, none); expect(model.opponent.state).toBe('grabbed'); expect(model.player.moveId).toBe('finisher');
  });

  it('registers The Claw as a complete playable fighter', () => {
    const chad = fighterById('chad'); const model = createMatch('chad', 'atlas', 'standard', 'hard');
    expect(chad.name).toContain('THE CLAW'); expect(chad.signature).toBe('CLAW HAMMER'); expect(chad.stats.charisma).toBeGreaterThan(90);
    expect(model.player.definitionId).toBe('chad'); expect(chooseAiDecision(createMatch('atlas', 'chad', 'chaos', 'hard'), chad).nextSeed).not.toBe(1337);
  });

  it('gives every fighter a distinct stamina cap and caps the five-beer boost', () => {
    const sober = createMatch('chad', 'atlas', 'standard', 'normal', 1, 0).player;
    const fiveBeers = createMatch('chad', 'atlas', 'standard', 'normal', 1, 5).player;
    const attemptedSix = createMatch('chad', 'atlas', 'standard', 'normal', 1, 6).player;
    expect(sober.staminaCap).toBeLessThan(Math.min(...FIGHTERS.filter((fighter) => fighter.id !== 'chad').map((fighter) => 55 + fighter.stats.stamina * .45)));
    expect(fiveBeers.staminaCap - sober.staminaCap).toBe(25);
    expect(attemptedSix.beersDrunk).toBe(5); expect(attemptedSix.staminaCap).toBe(fiveBeers.staminaCap);
  });

  it('blocks strikes with chip damage and guard stamina loss', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    expect(requestCommand(model, 'player', 'block')).toBe(true);
    const stamina = model.player.stamina;
    startMove(model.opponent, model.player, getMove('heavy')); model.opponent.attackPhase = 'active';
    expect(applyMoveHit(model, 'opponent', 'player', getMove('heavy'))).toBe(true);
    expect(model.player.health).toBeGreaterThan(98); expect(model.player.stamina).toBeLessThan(stamina); expect(model.lastImpact?.kind).toBe('blocked');
  });

  it('admits a reachable glove-to-glove strike without widening ordinary body-hit range', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); const jab = getMove('jab');
    model.opponent.position = { x: 0, z: 0 }; model.player.position = { x: 0, z: 2.6 };
    model.player.state = 'blocking';
    expect(startMove(model.opponent, model.player, jab)).toBe(true);
    model.opponent.state = 'idle'; model.opponent.moveId = null; model.opponent.attackPhase = null; model.opponent.stamina = model.opponent.staminaCap;
    model.player.state = 'idle';
    expect(startMove(model.opponent, model.player, jab)).toBe(false);
  });

  it('lets AI strike a raised guard from the physical glove-engagement lane', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337);
    model.player.position = { x: 0, z: 0 }; model.player.state = 'blocking'; model.opponent.position = { x: 0, z: 2.25 };
    const decision = chooseAiDecision(model, fighterById(model.opponent.definitionId));
    expect(decision.command).toMatch(/quick|heavy/);
  });

  it('stuffs a grapple until pressure breaks an exhausted guard', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    requestCommand(model, 'player', 'block'); expect(requestCommand(model, 'opponent', 'grapple')).toBe(true);
    expect(model.opponent.state).toBe('staggered'); expect(model.player.state).toBe('blocking');
    model.opponent.state = 'idle'; model.player.stamina = 5;
    expect(requestCommand(model, 'opponent', 'grapple')).toBe(true);
    expect(model.player.state).toBe('grabbed'); expect(model.player.stamina).toBe(0);
  });

  it('maps direction plus each attack button to distinct grapple outcomes', () => {
    const moveIds = new Set([
      selectDirectionalGrapple({ x: 0, z: -1 }, 'quick'), selectDirectionalGrapple({ x: 0, z: -1 }, 'heavy'), selectDirectionalGrapple({ x: 0, z: -1 }, 'grapple'),
      selectDirectionalGrapple({ x: -1, z: 0 }, 'quick'), selectDirectionalGrapple({ x: 1, z: 0 }, 'quick'), selectDirectionalGrapple({ x: 0, z: 1 }, 'grapple'),
    ]);
    expect(moveIds.size).toBe(6); for (const id of moveIds) expect(getMove(id).category).toBe('grapple');
  });

  it('maps deliberate directions to high punch, uppercut, low kick, high kick, and roundhouse', () => {
    expect(selectDirectionalStrike({ x: 0, z: -1 }, 'quick')).toBe('high_punch');
    expect(selectDirectionalStrike({ x: 0, z: -1 }, 'heavy')).toBe('uppercut');
    expect(selectDirectionalStrike({ x: 0, z: 1 }, 'quick')).toBe('low_kick');
    expect(selectDirectionalStrike({ x: 1, z: 0 }, 'heavy')).toBe('high_kick');
    expect(selectDirectionalStrike({ x: -1, z: 0 }, 'heavy')).toBe('roundhouse');
    for (const id of ['high_punch', 'uppercut', 'low_kick', 'high_kick', 'roundhouse']) expect(getStrikePose(getMove(id), 'active', getMove(id).anticipationDuration + .03)).not.toBeNull();
  });

  it('keeps directionless rescue controls punch-first and kick-first', () => {
    expect(selectDirectionalStrike({ x: 0, z: 0 }, 'quick', 0)).toBe('jab');
    expect(selectDirectionalStrike({ x: 0, z: 0 }, 'quick', 1)).toBe('combo');
    expect(selectDirectionalStrike({ x: 0, z: 0 }, 'quick', 2)).toBe('jab');
    expect(selectDirectionalStrike({ x: 0, z: 0 }, 'heavy')).toBe('front_kick');
  });

  it('turns a downed counter input into a visible stamina-bound kick-up', () => {
    const model = createMatch('vex', 'atlas', 'standard', 'normal'); model.player.state = 'downed'; model.player.downTimer = 2;
    const stamina = model.player.stamina;
    expect(isActionLegal(model, 'dodge', 'player')).toBe(true); expect(requestCommand(model, 'player', 'dodge')).toBe(true);
    expect(model.player.state).toBe('recovering'); expect(model.player.moveId).toBe('kick_up'); expect(model.player.stamina).toBe(stamina - getMove('kick_up').staminaCost);
    expect(getStrikePose(getMove('kick_up'), 'active', getMove('kick_up').anticipationDuration + .05)).not.toBeNull();
  });

  it('guarantees a knockdown when a rebound stiff-arm registers', () => {
    const model = createMatch('brick', 'atlas', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 }; model.player.ropeRebound = 1;
    expect(requestCommand(model, 'player', 'heavy', { x: 0, z: 1 }, true)).toBe(true); expect(model.player.moveId).toBe('stiff_arm');
    model.player.attackPhase = 'active'; expect(applyMoveHit(model, 'player', 'opponent', getMove('stiff_arm'))).toBe(true);
    expect(['airborne', 'downed']).toContain(model.opponent.state);
  });

  it('uses F at a center rope opening to exit and re-enter without requiring a corner', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 4.9, z: 0 };
    expect(isActionLegal(model, 'context', 'player')).toBe(true); expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.position.x).toBeGreaterThan(6);
    model.player.state = 'idle'; expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.position.x).toBeLessThan(5.2);
  });

  it('offers distinct quick, power, and context aerials from the top turnbuckle', () => {
    for (const [command, moveId] of [['quick', 'aerial_elbow'], ['heavy', 'aerial_kick'], ['context', 'aerial']] as const) {
      const model = createMatch('vex', 'atlas', 'standard', 'normal'); model.player.position = { x: -5.1, z: -3.6 }; model.opponent.position = { x: 0, z: 0 }; model.player.state = 'climbing'; model.player.climbStage = 3;
      expect(requestCommand(model, 'player', command)).toBe(true); expect(model.player.moveId).toBe(moveId); expect(model.player.state).toBe('attacking');
    }
  });

  it('makes AI choose a directional finish while it owns a grapple lock', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'hard', 99); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    expect(requestCommand(model, 'opponent', 'grapple', { x: 0, z: -1 })).toBe(true);
    const decision = chooseAiDecision(model, fighterById('nova'));
    expect(['quick', 'heavy', 'grapple']).toContain(decision.command);
    // Neutral and directional selections remain valid after the default slam establishes the lock.
    const moveMag = Math.hypot(decision.move.x, decision.move.z);
    expect(moveMag === 0 || Math.abs(moveMag - 1) < .001).toBe(true);
    expect(decision.command && isActionLegal(model, decision.command, 'opponent')).toBe(true);
  });

  it('adds a restrained slow-motion beat to major grapple impacts', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    expect(startMove(model.player, model.opponent, getMove('skyhook'))).toBe(true); model.player.attackPhase = 'active';
    expect(applyMoveHit(model, 'player', 'opponent', getMove('skyhook'))).toBe(true); expect(model.slowMotion).toBeGreaterThan(0);
  });

  it('never breaks the commentary desk from move proximity alone', () => {
    const model = createMatch('atlas', 'vex', 'chaos', 'normal'); model.player.position = { x: 0, z: -7.1 }; model.opponent.position = { x: .8, z: -7.1 };
    startMove(model.player, model.opponent, getMove('skyhook')); model.player.attackPhase = 'active';
    expect(applyMoveHit(model, 'player', 'opponent', getMove('skyhook'))).toBe(true);
    expect(model.props.find((prop) => prop.kind === 'table')?.failureStage).toBe('intact');
  });

  it('progressively fails the table only from a measured physical landing contact', () => {
    const model = createMatch('atlas', 'vex', 'chaos', 'normal'); model.physicsAuthority = true; model.player.position = { x: 0, z: -7.1 }; model.opponent.position = { x: .8, z: -7.1 };
    startMove(model.player, model.opponent, getMove('skyhook')); model.player.attackPhase = 'recovery';
    const contact = { id: 1, time: model.elapsed, sourceFighter: 'player' as const, sourceSegment: 'chest' as const, targetFighter: 'opponent' as const, targetSegment: 'chest' as const, targetRegion: 'chest' as const, totalForce: 330, maximumForce: 250, forceDirection: [0, -1, 0] as const, relativeSpeed: 4.8, attackInstanceId: model.player.attackInstanceId, moveId: 'skyhook', attackPhaseAtContact: null, sourceObjectId: null, targetSurface: 'table', isLanding: true };
    expect(applyPhysicalContact(model, contact)).toBe(true);
    expect(model.props.find((prop) => prop.kind === 'table')).toMatchObject({ failureStage: 'failed', broken: true });
    expect(model.highlights.some((moment) => moment.kind === 'table')).toBe(true);
  });

  it('does not score a grapple from incidental body contact before the landing', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.physicsAuthority = true; model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    startMove(model.player, model.opponent, getMove('slam')); model.player.attackPhase = 'active'; const health = model.opponent.health;
    const contact = { id: 1, time: model.elapsed, sourceFighter: 'player' as const, sourceSegment: 'chest' as const, targetFighter: 'opponent' as const, targetSegment: 'chest' as const, targetRegion: 'chest' as const, totalForce: 120, maximumForce: 90, forceDirection: [1, 0, 0] as const, relativeSpeed: 2, attackInstanceId: model.player.attackInstanceId, moveId: 'slam', attackPhaseAtContact: 'active' as const, sourceObjectId: null, targetSurface: null, isLanding: false };
    expect(applyPhysicalContact(model, contact)).toBe(false); expect(model.opponent.health).toBe(health);
  });

  it('accepts real upper-arm contact from the chest-led Domefall dive', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.physicsAuthority = true; model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    startMove(model.player, model.opponent, getMove('aerial')); model.player.attackPhase = 'active'; const health = model.opponent.health;
    const contact = { id: 1, time: model.elapsed, sourceFighter: 'player' as const, sourceSegment: 'leftUpperArm' as const, targetFighter: 'opponent' as const, targetSegment: 'chest' as const, targetRegion: 'chest' as const, totalForce: 120, maximumForce: 90, forceDirection: [1, 0, 0] as const, relativeSpeed: 2, attackInstanceId: model.player.attackInstanceId, moveId: 'aerial', attackPhaseAtContact: 'active' as const, sourceObjectId: null, targetSurface: null, isLanding: false };
    expect(applyPhysicalContact(model, contact)).toBe(true); expect(model.opponent.health).toBeLessThan(health);
  });

  it('honors a fresh active-window manifold consumed on the recovery boundary', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.physicsAuthority = true; model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    startMove(model.player, model.opponent, getMove('jab')); model.player.attackPhase = 'recovery'; model.opponent.state = 'blocking'; const health = model.opponent.health;
    const contact = { id: 1, time: model.elapsed, sourceFighter: 'player' as const, sourceSegment: 'rightHand' as const, targetFighter: 'opponent' as const, targetSegment: 'leftForearm' as const, targetRegion: 'leftArm' as const, totalForce: 120, maximumForce: 90, forceDirection: [0, 0, 1] as const, relativeSpeed: 2, attackInstanceId: model.player.attackInstanceId, moveId: 'jab', attackPhaseAtContact: 'active' as const, sourceObjectId: null, targetSurface: null, isLanding: false };
    expect(applyPhysicalContact(model, contact)).toBe(true);
    expect(model.lastImpact?.kind).toBe('blocked'); expect(model.opponent.health).toBeLessThan(health); expect(model.opponent.health).toBeGreaterThan(98);
  });

  it('rejects a stale contact even when it carries an old active-window stamp', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.physicsAuthority = true; model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 }; model.elapsed = 1;
    startMove(model.player, model.opponent, getMove('jab')); model.player.attackPhase = 'recovery'; const health = model.opponent.health;
    const contact = { id: 1, time: .9, sourceFighter: 'player' as const, sourceSegment: 'rightHand' as const, targetFighter: 'opponent' as const, targetSegment: 'chest' as const, targetRegion: 'chest' as const, totalForce: 120, maximumForce: 90, forceDirection: [0, 0, 1] as const, relativeSpeed: 2, attackInstanceId: model.player.attackInstanceId, moveId: 'jab', attackPhaseAtContact: 'active' as const, sourceObjectId: null, targetSurface: null, isLanding: false };
    expect(applyPhysicalContact(model, contact)).toBe(false); expect(model.opponent.health).toBe(health);
  });

  it('allows a grapple selection during the visible lock without duplicate base cost', () => {
    const model = createMatch('nova', 'brick', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    requestCommand(model, 'player', 'grapple'); const afterLock = model.player.stamina;
    expect(requestCommand(model, 'player', 'quick', { x: -1, z: 0 })).toBe(true);
    expect(model.player.moveId).toBe('clutch'); expect(model.player.stamina).toBe(afterLock);
  });

  it('starts a neutral collar lock with the default body slam while preserving piledriver depth', () => {
    const model = createMatch('brick', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    expect(requestCommand(model, 'player', 'grapple')).toBe(true); expect(model.player.moveId).toBe('slam'); expect(model.grapple?.phase).toBe('reach');
    expect(requestCommand(model, 'player', 'grapple')).toBe(true); expect(model.player.moveId).toBe('piledriver');
  });

  it('uses the shared physical collar-tie range for a neutral grapple', () => {
    const reachable = createMatch('brick', 'vex', 'standard', 'normal'); reachable.player.position = { x: 0, z: 0 }; reachable.opponent.position = { x: 1.65, z: 0 };
    expect(requestCommand(reachable, 'player', 'grapple')).toBe(true);
    const tooFar = createMatch('brick', 'vex', 'standard', 'normal'); tooFar.player.position = { x: 0, z: 0 }; tooFar.opponent.position = { x: 1.66, z: 0 };
    expect(requestCommand(tooFar, 'player', 'grapple')).toBe(false);
  });

  it('completes one hundred neutral body slams across the full weight and approach matrix without a stuck attacker', () => {
    const fighters = FIGHTERS.map((fighter) => fighter.id);
    let attempts = 0;
    for (const attacker of fighters) for (const defender of fighters) for (const side of [-1, 1] as const) for (const lane of [-.32, .32] as const) {
      const model = createMatch(attacker, defender, 'standard', 'hard', 900 + attempts); model.labMode = true;
      model.player.position = { x: side * .2, z: -.2 + lane }; model.opponent.position = { x: side * .88, z: -.12 + lane };
      model.player.facing = side > 0 ? Math.PI / 2 : -Math.PI / 2; model.player.stamina = model.player.staminaCap;
      expect(requestCommand(model, 'player', 'grapple')).toBe(true);
      expect(model.player.moveId).toBe('slam'); expect(model.grapple?.phase).toBe('reach');
      for (let frame = 0; frame < 240; frame += 1) advanceMatch(model, 1 / 60, none);
      expect(model.opponent.health).toBeLessThan(100); expect(model.player.moveId).toBeNull();
      expect(['idle', 'locomotion']).toContain(model.player.state); expect(model.grapple).toBeNull();
      attempts += 1;
    }
    expect(attempts).toBe(100);
  });

  it('climbs a turnbuckle before launching a playable aerial attack', () => {
    const model = createMatch('vex', 'atlas', 'standard', 'normal'); model.player.position = { x: 5, z: 3.5 }; model.opponent.position = { x: 1, z: 0 }; model.opponent.state = 'downed';
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.state).toBe('climbing'); expect(model.player.climbStage).toBe(1);
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.climbStage).toBe(2); expect(model.player.moveId).toBeNull();
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.climbStage).toBe(3); expect(model.player.moveId).toBeNull();
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.moveId).toBe('aerial'); expect(model.player.state).toBe('attacking'); expect(model.player.climbStage).toBe(0);
  });

  it('rewards only a completed taunt and preserves a top-turnbuckle perch', () => {
    const model = createMatch('chad', 'atlas', 'standard', 'normal'); model.labMode = true; model.player.position = { x: 5, z: 3.5 }; model.opponent.position = { x: 1, z: 0 };
    requestCommand(model, 'player', 'context'); requestCommand(model, 'player', 'context'); requestCommand(model, 'player', 'context');
    const beforeMomentum = model.player.momentum; const beforeHype = model.hype;
    expect(requestCommand(model, 'player', 'taunt')).toBe(true); expect(model.player.state).toBe('climbing');
    for (let frame = 0; frame < 90; frame += 1) advanceMatch(model, 1 / 60, none);
    expect(model.player.state).toBe('climbing'); expect(model.player.climbStage).toBe(3);
    expect(model.player.momentum).toBeGreaterThan(beforeMomentum); expect(model.hype).toBeGreaterThan(beforeHype);
    expect(model.opponent.health).toBe(100); expect(model.opponent.state).toBe('idle');
  });

  it('lets inward movement safely cancel a staged climb', () => {
    const model = createMatch('vex', 'atlas', 'standard', 'normal'); model.player.position = { x: 5, z: 3.5 }; model.opponent.position = { x: 0, z: 0 };
    requestCommand(model, 'player', 'context'); model.player.stateElapsed = .4;
    advanceMatch(model, 1 / 60, { ...none, move: { x: -1, z: -1 } });
    expect(model.player.state).toBe('locomotion'); expect(model.player.climbStage).toBe(0);
  });

  it('converts running heavy offense into a knockdown stiff-arm', () => {
    const model = createMatch('brick', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 }; model.player.velocity = { x: 4.2, z: 0 };
    expect(requestCommand(model, 'player', 'heavy', { x: 0, z: 1 }, true)).toBe(true); expect(model.player.moveId).toBe('stiff_arm');
  });

  it('converts an elastic rope rebound into the named stiff-arm', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal'); model.player.position = { x: 4.8, z: 0 }; model.opponent.position = { x: 3.3, z: 0 }; model.player.ropeRebound = 1.1;
    expect(requestCommand(model, 'player', 'heavy')).toBe(true); expect(model.player.moveId).toBe('stiff_arm');
  });

  it('turns directional power into a physical front kick and a running grapple into a spear', () => {
    const kick = createMatch('vex', 'atlas', 'standard', 'normal'); kick.player.position = { x: 0, z: 0 }; kick.opponent.position = { x: 1.3, z: 0 };
    expect(requestCommand(kick, 'player', 'heavy', { x: 0, z: 1 })).toBe(true); expect(kick.player.moveId).toBe('front_kick');
    const spear = createMatch('brick', 'nova', 'standard', 'normal'); spear.player.position = { x: 0, z: 0 }; spear.opponent.position = { x: .9, z: 0 }; spear.player.velocity = { x: 4.4, z: 0 };
    expect(requestCommand(spear, 'player', 'grapple', { x: 0, z: 1 }, true)).toBe(true); expect(spear.player.moveId).toBe('spear'); expect(spear.grapple).toBeNull();
  });

  it('turns a distant prop release into a bounded physical throw window', () => {
    const model = createMatch('brick', 'vex', 'chaos', 'normal'); const chair = model.props.find((prop) => prop.kind === 'chair');
    if (!chair) throw new Error('Chaos match must provide a chair');
    model.player.position = { ...chair.position }; expect(requestCommand(model, 'player', 'interact')).toBe(true);
    model.opponent.position = { x: 1, z: 0 }; model.player.position = { x: -2, z: 0 };
    expect(requestCommand(model, 'player', 'interact', { x: 1, z: 0 })).toBe(true);
    expect(model.player).toMatchObject({ heldPropId: null, moveId: 'prop_throw', attackPhase: 'anticipation' });
    expect(chair.heldBy).toBeNull();
  });

  it('preserves beer choice but clears guard, climb, AI, and impact transients on rematch', () => {
    const model = createMatch('chad', 'atlas', 'chaos', 'hard', 4, 5); model.player.state = 'climbing'; model.aiBlockTimer = 2; model.hitStop = .4;
    const reset = resetTransientState(model);
    expect(reset.player.beersDrunk).toBe(5); expect(reset.player.state).toBe('idle'); expect(reset.aiBlockTimer).toBe(0); expect(reset.hitStop).toBe(0);
  });

  it('keeps guard and climb transitions explicit and safe', () => {
    expect(canTransition('idle', 'blocking')).toBe(true); expect(canTransition('locomotion', 'climbing')).toBe(true); expect(canTransition('downed', 'grabbed')).toBe(true);
    expect(canTransition('pinned', 'attacking')).toBe(false); expect(canTransition('victorious', 'climbing')).toBe(false);
  });

  it('supports deliberate ringside exit and re-entry without a control lock', () => {
    const model = createMatch('brick', 'vex', 'chaos', 'normal'); model.player.position = { x: 5.3, z: 0 }; model.opponent.position = { x: 0, z: 0 };
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.position.x).toBeGreaterThan(6); expect(model.player.state).toBe('locomotion');
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.position.x).toBeLessThan(5.8); expect(model.player.state).toBe('locomotion');
  });

  it('allows only a late major impact to trigger an exhaustion knockout', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 }; model.opponent.health = 48; model.opponent.stamina = 8;
    startMove(model.player, model.opponent, getMove('heavy')); model.player.attackPhase = 'active'; applyMoveHit(model, 'player', 'opponent', getMove('heavy'));
    expect(model.result).toBeNull();
    model.elapsed = 76; model.player.state = 'idle'; model.player.moveId = null; model.player.attackPhase = null; model.player.hitTargets = [];
    startMove(model.player, model.opponent, getMove('heavy')); model.player.attackPhase = 'active'; applyMoveHit(model, 'player', 'opponent', getMove('heavy'));
    expect(model.result).toMatchObject({ winner: 'player', method: 'KNOCKOUT' });
  });
});
