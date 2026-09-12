import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { HUD } from '../ui/HUD';
import { afterEach, describe, expect, it } from 'vitest';
import { AttackOutcomeTracker } from '../game/input/attackOutcome';
import { bodyWorksRuntime, type BodyWorksContact } from '../game/physics/physicsRuntime';
import { useMatchStore } from '../game/state/matchStore';
import { getMove } from '../game/data/moves';
import { startMove } from '../game/systems/combat';

const still = { move: { x: 0, z: 0 }, run: false, block: false, commands: [] } as const;
const setup = () => {
  useMatchStore.getState().configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
  const model = useMatchStore.getState().model;
  model.physicsAuthority = true;
  model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
  model.aiThinkTimer = 999; model.aiControllers.opponent.thinkTimer = 999;
  return model;
};
const contact = (source: 'player' | 'opponent', instanceId: number, moveId = 'jab'): BodyWorksContact => ({
  id: 1, time: useMatchStore.getState().model.elapsed, sourceFighter: source, sourceSegment: 'rightHand',
  targetFighter: source === 'player' ? 'opponent' : 'player', targetSegment: 'head', targetRegion: 'head',
  totalForce: 1500, maximumForce: 1200, forceDirection: [1, 0, 0], relativeSpeed: 3,
  attackInstanceId: instanceId, moveId, attackPhaseAtContact: 'active', sourceObjectId: null, targetSurface: null, isLanding: false,
});

afterEach(() => { cleanup(); bodyWorksRuntime.reset(); });

describe('shared attack outcomes', () => {
  it('does not mistake acceptance or a contact for a submitted character pose', () => {
    const tracker = new AttackOutcomeTracker(); const attack = { moveId: 'front_kick', instanceId: 1 };
    tracker.begin(7, attack, 0);
    tracker.recordContact(attack, 'hit', .1);
    expect(tracker.snapshot()).toMatchObject({ poseFrames: 0, contact: 'hit' });
    tracker.recordPose(attack);
    expect(tracker.snapshot()?.poseFrames).toBe(1);
  });

  it('rejects stale instance and wrong-move evidence, even when the same move repeats', () => {
    const tracker = new AttackOutcomeTracker(); tracker.begin(8, { moveId: 'jab', instanceId: 2 }, 0);
    tracker.recordPose({ moveId: 'jab', instanceId: 1 });
    tracker.recordContact({ moveId: 'jab', instanceId: 1 }, 'hit', .1);
    tracker.recordPose({ moveId: 'front_kick', instanceId: 2 });
    expect(tracker.snapshot()).toMatchObject({ poseFrames: 0, contact: 'none' });
    tracker.reset(); expect(tracker.snapshot()).toBeNull();
  });

  it.each(['jab', 'front_kick', 'slam'])('tracks %s interruption without claiming a pose or contact occurred', moveId => {
    const tracker = new AttackOutcomeTracker(); tracker.begin(1, { moveId, instanceId: 1 }, 0);
    tracker.observe({ moveId: null, attackInstanceId: 1, attackPhase: null, state: 'staggered' }, .02, 'Stopped by uppercut');
    tracker.recordPose({ moveId, instanceId: 1 });
    expect(tracker.snapshot()).toMatchObject({ outcome: 'interrupted', poseFrames: 0, contact: 'none', reason: 'Stopped by uppercut' });
  });

  it('does not let a stale move ID hide a physical knockdown', () => {
    const tracker = new AttackOutcomeTracker(); tracker.begin(1, { moveId: 'jab', instanceId: 1 }, 0);
    tracker.observe({ moveId: 'jab', attackInstanceId: 1, attackPhase: 'active', state: 'downed' }, .1);
    expect(tracker.snapshot()?.outcome).toBe('interrupted');
  });

  it('keeps a completed miss separate from interruption and damage', () => {
    const tracker = new AttackOutcomeTracker(); tracker.begin(1, { moveId: 'jab', instanceId: 1 }, 0);
    tracker.observe({ moveId: 'jab', attackInstanceId: 1, attackPhase: 'recovery', state: 'attacking' }, .4);
    tracker.observe({ moveId: null, attackInstanceId: 1, attackPhase: null, state: 'idle' }, .6);
    expect(tracker.snapshot()).toMatchObject({ outcome: 'ended', contact: 'none', reason: null });
  });

  it('changes accepted heavy feedback to interrupted when a validated incoming contact cancels it', () => {
    const model = setup();
    useMatchStore.getState().advance(1 / 60, { ...still, commands: ['heavy'] });
    expect(bodyWorksRuntime.actionFeedback()?.status).toBe('executed');
    expect(startMove(model.opponent, model.player, getMove('jab'))).toBe(true);
    model.opponent.attackPhase = 'active';
    useMatchStore.getState().resolvePhysicsContacts([contact('opponent', model.opponent.attackInstanceId)]);
    expect(model.player.health).toBeLessThan(100);
    expect(bodyWorksRuntime.actionFeedback()).toMatchObject({ status: 'interrupted', reason: 'Stopped by Circuit Jab', event: { action: 'heavyStrike' } });
    expect(bodyWorksRuntime.attackOutcome()).toMatchObject({ moveId: 'front_kick', outcome: 'interrupted', poseFrames: 0, contact: 'none' });
    render(React.createElement(HUD, { device: 'keyboard', paused: false }));
    expect(screen.getByTestId('action-strip').textContent).toContain('MOVE STOPPED');
    expect(screen.getByTestId('action-strip').textContent).toContain('STOPPED BY CIRCUIT JAB');
  });

  it.each(['hit', 'blocked'] as const)('records %s only after the contact bridge accepts matching evidence', result => {
    const model = setup();
    useMatchStore.getState().advance(1 / 60, { ...still, commands: ['quick'] });
    model.player.attackPhase = 'active';
    if (result === 'blocked') { model.opponent.state = 'blocking'; model.opponent.stateElapsed = 1; }
    const hit = contact('player', model.player.attackInstanceId);
    if (result === 'blocked') hit.targetSegment = 'leftForearm';
    useMatchStore.getState().resolvePhysicsContacts([{ ...hit, attackInstanceId: hit.attackInstanceId === null ? 0 : hit.attackInstanceId - 1 }]);
    expect(bodyWorksRuntime.attackOutcome()?.contact).toBe('none'); expect(model.opponent.health).toBe(100);
    useMatchStore.getState().resolvePhysicsContacts([hit]);
    expect(bodyWorksRuntime.attackOutcome()?.contact).toBe(result);
    const health = model.opponent.health;
    useMatchStore.getState().resolvePhysicsContacts([hit]); expect(model.opponent.health).toBe(health);
  });

  it('reports a parried attack as countered rather than as a landed hit', () => {
    const model = setup();
    useMatchStore.getState().advance(1 / 60, { ...still, commands: ['quick'] });
    model.player.attackPhase = 'active'; model.opponent.state = 'blocking'; model.opponent.stateElapsed = 0;
    const hit = { ...contact('player', model.player.attackInstanceId), targetSegment: 'leftForearm' as const };
    useMatchStore.getState().resolvePhysicsContacts([hit]);
    expect(bodyWorksRuntime.attackOutcome()).toMatchObject({ contact: 'countered', outcome: 'interrupted' });
    expect(bodyWorksRuntime.actionFeedback()).toMatchObject({ status: 'interrupted', reason: 'Your move was countered' });
    expect(model.opponent.health).toBe(100);
  });

  it('does not overwrite feedback for a newer queued input when an older move is interrupted', () => {
    const model = setup();
    useMatchStore.getState().advance(1 / 60, { ...still, commands: ['heavy'] });
    bodyWorksRuntime.captureInput('player', { ...still, commands: ['quick'] }, model.elapsed);
    model.player.moveId = null; model.player.attackPhase = null; model.player.state = 'staggered';
    bodyWorksRuntime.observePlayerAttack(model.player, model.elapsed);
    expect(bodyWorksRuntime.actionFeedback()).toMatchObject({ status: 'buffered', event: { action: 'quickStrike' } });
    expect(bodyWorksRuntime.attackOutcome()?.outcome).toBe('interrupted');
  });
});
