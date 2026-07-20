import { describe, expect, it } from 'vitest';
import { createMatch, requestCommand } from '../game/systems/combat';
import { resolveContextAction, resolvePropAction } from '../game/systems/contextResolver';

describe('F context resolver priority', () => {
  it('resolves kickout before every location-driven action', () => {
    const model = createMatch('atlas', 'vex', 'chaos', 'normal');
    model.player.state = 'pinned'; model.opponent.state = 'pinning'; model.player.position = { x: 4.8, z: 3.2 };
    expect(resolveContextAction(model, 'player')).toMatchObject({ actionId: 'kickout', displayName: 'KICK OUT', priority: 1, legalState: true, target: 'opponent' });
  });

  it('resolves a legal finisher before pin or corner climb', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal');
    model.player.position = { x: 4.75, z: 3.2 }; model.opponent.position = { x: 4.7, z: 3.15 }; model.opponent.state = 'downed'; model.player.momentum = 100;
    expect(resolveContextAction(model, 'player')).toMatchObject({ actionId: 'finisher', priority: 2, legalState: true });
    expect(requestCommand(model, 'player', 'context')).toBe(true);
    expect(model.player.moveId).toBe('finisher');
  });

  it('resolves pin before turnbuckle climb or rope traversal', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal');
    model.player.position = { x: 4.8, z: 3.25 }; model.opponent.position = { x: 4.7, z: 3.1 }; model.opponent.state = 'downed';
    expect(resolveContextAction(model, 'player')).toMatchObject({ actionId: 'pin', priority: 3, legalState: true });
  });

  it('resolves staged turnbuckle climbing before ring traversal', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal');
    model.player.position = { x: 4.8, z: 3.2 }; model.opponent.position = { x: 0, z: 0 };
    expect(resolveContextAction(model, 'player')).toMatchObject({ actionId: 'turnbuckle_climb', priority: 7, legalState: true });
  });

  it('blocks ordinary ring traversal while a grapple exists', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal');
    model.player.position = { x: 4.9, z: 0 }; model.opponent.position = { x: 4.2, z: 0 }; model.player.state = 'grappling'; model.player.attackPhase = 'anticipation'; model.player.moveId = 'slam';
    model.grapple = { attacker: 'opponent', defender: 'player', position: 'underhook', leverage: 0, tension: 0, rotation: 0, lift: 0, struggle: 0, age: 0, gripCount: 0, phase: 'clinch' };
    expect(resolveContextAction(model, 'player')).toMatchObject({ legalState: false });
    expect(resolveContextAction(model, 'player').actionId).not.toBe('ring_traversal');
  });
});

describe('E prop resolver priority', () => {
  const heldModel = () => {
    const model = createMatch('atlas', 'vex', 'chaos', 'normal');
    const chair = model.props.find((prop) => prop.kind === 'chair');
    if (!chair) throw new Error('Expected Chaos chair');
    model.player.heldPropId = chair.id; chair.heldBy = 'player';
    return model;
  };

  it('swings before throwing when a target is in range', () => {
    const model = heldModel(); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1.2, z: 0 };
    expect(resolvePropAction(model, 'player', { x: 1, z: 0 })).toMatchObject({ actionId: 'swing_held_prop', priority: 1, legalState: true });
  });

  it('requires a direction modifier to throw and otherwise drops', () => {
    const model = heldModel(); model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 5, z: 0 };
    expect(resolvePropAction(model, 'player', { x: 1, z: 0 })).toMatchObject({ actionId: 'throw_held_prop', priority: 2 });
    expect(resolvePropAction(model, 'player')).toMatchObject({ actionId: 'drop_held_prop', priority: 3 });
    expect(requestCommand(model, 'player', 'interact')).toBe(true);
    expect(model.player.heldPropId).toBeNull();
  });

  it('picks up the nearest eligible prop', () => {
    const model = createMatch('atlas', 'vex', 'chaos', 'normal'); const chair = model.props.find((prop) => prop.kind === 'chair');
    if (!chair) throw new Error('Expected Chaos chair');
    model.player.position = { ...chair.position };
    expect(resolvePropAction(model, 'player')).toMatchObject({ actionId: 'pick_up_prop', target: chair.id, priority: 4, legalState: true });
    expect(requestCommand(model, 'player', 'interact')).toBe(true); expect(model.player.heldPropId).toBe(chair.id);
  });
});
