import { describe, expect, it } from 'vitest';
import { chooseAiDecision, isActionLegal } from '../game/ai/utilityAI';
import { cinematicProgress, getPairedPose, getStrikePose, getStrikeReactionPose } from '../game/animation/choreography';
import { FIGHTERS, fighterById } from '../game/data/fighters';
import { getMove } from '../game/data/moves';
import { advanceMatch, applyMoveHit, applyPhysicalContact, createMatch, getAttackPhase, requestCommand, resetTransientState, selectDirectionalGrapple, startMove } from '../game/systems/combat';
import { canTransition } from '../game/systems/stateMachine';
import type { FrameInput } from '../game/systems/combat';
import { BodyWorksRuntime } from '../game/physics/physicsRuntime';

const none: FrameInput = { move: { x: 0, z: 0 }, run: false, block: false, commands: [] };

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

  it('prioritizes a valid pin over an accidental corner climb', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 4.8, z: 3.25 }; model.opponent.position = { x: 4.7, z: 3.1 }; model.opponent.state = 'downed';
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.state).toBe('pinning'); expect(model.opponent.state).toBe('pinned');
  });

  it('buffers commands FIFO and releases at most one legal action per fixed step', () => {
    const runtime = new BodyWorksRuntime(); const accepted: string[] = [];
    runtime.captureInput('player', { ...none, commands: ['grapple', 'heavy'] }, 0);
    runtime.resolveCommands('player', .01, (command) => { accepted.push(command.command); return true; });
    expect(accepted).toEqual(['grapple']); expect(runtime.pendingCommandCount()).toBe(1);
    runtime.resolveCommands('player', .02, (command) => { accepted.push(command.command); return true; });
    expect(accepted).toEqual(['grapple', 'heavy']); expect(runtime.pendingCommandCount()).toBe(0);
  });

  it('expires stale buffered commands instead of executing them later', () => {
    const runtime = new BodyWorksRuntime(); const expired: string[] = []; let executed = false;
    runtime.captureInput('player', { ...none, commands: ['heavy'] }, 1);
    runtime.resolveCommands('player', 1.17, () => { executed = true; return true; }, (command) => expired.push(command.command));
    expect(executed).toBe(false); expect(expired).toEqual(['heavy']); expect(runtime.pendingCommandCount()).toBe(0);
  });

  it('successful counter interrupts the incoming move', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    startMove(model.opponent, model.player, getMove('heavy')); model.opponent.phaseElapsed = .25; model.opponent.attackPhase = 'anticipation';
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
    const grappleIds = ['slam', 'suplex', 'takedown', 'whip', 'arm_drag', 'skyhook', 'powerbomb', 'clutch', 'spinebuster', 'side_toss', 'mountain_drop'];
    for (const id of grappleIds) {
      const move = getMove(id);
      expect(getPairedPose(move, 'actor', 'anticipation', move.anticipationDuration * .8, 'atlas')).not.toBeNull();
      expect(getPairedPose(move, 'victim', 'active', move.anticipationDuration + move.activeDuration * .5, 'atlas')).not.toBeNull();
    }
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
    expect(getAttackPhase(move, .1)).toBe('anticipation'); expect(getAttackPhase(move, .45)).toBe('active'); expect(getAttackPhase(move, .7)).toBe('recovery'); expect(getAttackPhase(move, 2)).toBeNull();
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

  it('makes AI choose a directional finish while it owns a grapple lock', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'hard', 99); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    expect(requestCommand(model, 'opponent', 'grapple', { x: 0, z: -1 })).toBe(true);
    const decision = chooseAiDecision(model, fighterById('nova'));
    expect(['quick', 'heavy', 'grapple']).toContain(decision.command); expect(Math.hypot(decision.move.x, decision.move.z)).toBe(1);
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
    const contact = { id: 1, time: 2, sourceFighter: 'player' as const, sourceSegment: 'chest' as const, targetFighter: 'opponent' as const, targetSegment: 'chest' as const, targetRegion: 'chest' as const, totalForce: 330, maximumForce: 250, forceDirection: [0, -1, 0] as const, relativeSpeed: 4.8, attackInstanceId: model.player.attackInstanceId, moveId: 'skyhook', sourceObjectId: null, targetSurface: 'table', isLanding: true };
    expect(applyPhysicalContact(model, contact)).toBe(true);
    expect(model.props.find((prop) => prop.kind === 'table')).toMatchObject({ failureStage: 'failed', broken: true });
    expect(model.highlights.some((moment) => moment.kind === 'table')).toBe(true);
  });

  it('does not score a grapple from incidental body contact before the landing', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal'); model.physicsAuthority = true; model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    startMove(model.player, model.opponent, getMove('slam')); model.player.attackPhase = 'active'; const health = model.opponent.health;
    const contact = { id: 1, time: 1, sourceFighter: 'player' as const, sourceSegment: 'chest' as const, targetFighter: 'opponent' as const, targetSegment: 'chest' as const, targetRegion: 'chest' as const, totalForce: 120, maximumForce: 90, forceDirection: [1, 0, 0] as const, relativeSpeed: 2, attackInstanceId: model.player.attackInstanceId, moveId: 'slam', sourceObjectId: null, targetSurface: null, isLanding: false };
    expect(applyPhysicalContact(model, contact)).toBe(false); expect(model.opponent.health).toBe(health);
  });

  it('allows a grapple selection during the visible lock without duplicate base cost', () => {
    const model = createMatch('nova', 'brick', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    requestCommand(model, 'player', 'grapple'); const afterLock = model.player.stamina;
    expect(requestCommand(model, 'player', 'quick', { x: -1, z: 0 })).toBe(true);
    expect(model.player.moveId).toBe('clutch'); expect(model.player.stamina).toBe(afterLock);
  });

  it('climbs a turnbuckle before launching a playable aerial attack', () => {
    const model = createMatch('vex', 'atlas', 'standard', 'normal'); model.player.position = { x: 5, z: 3.5 }; model.opponent.position = { x: 1, z: 0 }; model.opponent.state = 'downed';
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.state).toBe('climbing');
    expect(requestCommand(model, 'player', 'context')).toBe(true); expect(model.player.moveId).toBe('aerial'); expect(model.player.state).toBe('attacking');
  });

  it('converts running heavy offense into a knockdown stiff-arm', () => {
    const model = createMatch('brick', 'vex', 'standard', 'normal'); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 }; model.player.velocity = { x: 4.2, z: 0 };
    expect(requestCommand(model, 'player', 'heavy')).toBe(true); expect(model.player.moveId).toBe('stiff_arm');
  });

  it('converts an elastic rope rebound into the named stiff-arm', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal'); model.player.position = { x: 4.8, z: 0 }; model.opponent.position = { x: 3.3, z: 0 }; model.player.ropeRebound = 1.1;
    expect(requestCommand(model, 'player', 'heavy')).toBe(true); expect(model.player.moveId).toBe('stiff_arm');
  });

  it('turns directional power into a physical front kick and a running grapple into a spear', () => {
    const kick = createMatch('vex', 'atlas', 'standard', 'normal'); kick.player.position = { x: 0, z: 0 }; kick.opponent.position = { x: 1.3, z: 0 };
    expect(requestCommand(kick, 'player', 'heavy', { x: 0, z: 1 })).toBe(true); expect(kick.player.moveId).toBe('front_kick');
    const spear = createMatch('brick', 'nova', 'standard', 'normal'); spear.player.position = { x: 0, z: 0 }; spear.opponent.position = { x: 1.4, z: 0 }; spear.player.velocity = { x: 4.4, z: 0 };
    expect(requestCommand(spear, 'player', 'grapple')).toBe(true); expect(spear.player.moveId).toBe('spear'); expect(spear.grapple).toBeNull();
  });

  it('turns a distant prop release into a bounded physical throw window', () => {
    const model = createMatch('brick', 'vex', 'chaos', 'normal'); const chair = model.props.find((prop) => prop.kind === 'chair');
    if (!chair) throw new Error('Chaos match must provide a chair');
    model.player.position = { ...chair.position }; expect(requestCommand(model, 'player', 'interact')).toBe(true);
    model.opponent.position = { x: 1, z: 0 }; model.player.position = { x: -2, z: 0 };
    expect(requestCommand(model, 'player', 'interact')).toBe(true);
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
