import { describe, expect, it } from 'vitest';
import { createMatch, requestCommand, performCounter } from '../game/systems/combat';
import { quickPickup, reversalAvailable, situationalStrike } from '../game/systems/strikeResolver';
import { strikeDriveProfile } from '../game/physics/strikeDynamics';

const bout = () => {
  const model = createMatch('atlas', 'vex', 'chaos', 'normal');
  model.player.position = { x: 0, z: 0 }; model.player.facing = 0;
  model.opponent.position = { x: 0, z: 1.2 }; model.opponent.facing = Math.PI;
  return model;
};

describe('situational attack families', () => {
  it('K stomps a nearby grounded opponent with the boot; J uses a hammerfist', () => {
    const model = bout(); model.opponent.state = 'downed';
    expect(situationalStrike(model.player, model.opponent, 'heavy')).toBe('ground');
    expect(requestCommand(model, 'player', 'heavy')).toBe(true);
    expect(model.player.moveId).toBe('ground');
    expect(strikeDriveProfile('ground')?.source).toBe('rightFoot');
    model.player.state = 'idle'; model.player.moveId = null;
    expect(requestCommand(model, 'player', 'quick')).toBe(true);
    expect(model.player.moveId).toBe('ground_punch');
    expect(strikeDriveProfile('ground_punch')?.source).toBe('rightHand');
  });
  it('does not stomp from across the ring and selects low, mid and vulnerable high kicks', () => {
    const model = bout(); model.opponent.position.z = 4; model.opponent.state = 'downed';
    expect(situationalStrike(model.player, model.opponent, 'heavy')).toBe('front_kick');
    model.opponent.state = 'idle'; model.opponent.position.z = .9;
    expect(situationalStrike(model.player, model.opponent, 'heavy')).toBe('low_kick');
    model.opponent.position.z = 1.6;
    expect(situationalStrike(model.player, model.opponent, 'heavy')).toBe('front_kick');
    model.opponent.state = 'staggered';
    expect(situationalStrike(model.player, model.opponent, 'heavy')).toBe('high_kick');
  });
  it('J picks up a reachable weapon then swings it, but prioritizes an engaged opponent', () => {
    const model = bout(); const chair = model.props.find(p => p.kind === 'chair'); if (!chair) throw Error('Missing chair');
    chair.position = { x: .7, z: 0 }; model.opponent.position.z = 3;
    expect(quickPickup(model, 'player')).toBe('PICK UP CHAIR');
    expect(requestCommand(model, 'player', 'quick')).toBe(true);
    expect(model.player.heldPropId).toBe(chair.id); expect(chair.heldBy).toBe('player');
    model.player.state = 'idle'; model.player.moveId = null;
    expect(requestCommand(model, 'player', 'quick')).toBe(true); expect(model.player.moveId).toBe('prop');
    model.player.heldPropId = null; model.player.state = 'idle'; chair.heldBy = null; model.opponent.position.z = 1;
    expect(quickPickup(model, 'player')).toBeNull();
  });
  it('rejects pickup through the apron or under rules that prohibit weapons', () => {
    const model = bout(); const chair = model.props.find(p => p.kind === 'chair'); if (!chair) throw Error('Missing chair');
    model.player.position = { x: 5.5, z: 0 }; chair.position = { x: 6, z: 0 };
    expect(quickPickup(model, 'player')).toBeNull();
    model.player.position.x = 6; model.ruleset = 'standard'; expect(quickPickup(model, 'player')).toBeNull();
  });
  it('a rushing reversal requires facing, reach and the short timing window', () => {
    const model = bout(); const attacker = model.opponent;
    attacker.state = 'attacking'; attacker.moveId = 'spear'; attacker.attackPhase = 'anticipation'; attacker.phaseElapsed = .12; attacker.velocity = { x: 0, z: -4 };
    expect(reversalAvailable(model.player, attacker, true)).toBe(true);
    attacker.position.z = 5; expect(performCounter(model, 'player', 'opponent')).toBe(false);
    attacker.position.z = 1.2; model.player.facing = Math.PI; expect(reversalAvailable(model.player, attacker, true)).toBe(false);
    model.player.facing = 0; attacker.phaseElapsed = .9; expect(reversalAvailable(model.player, attacker, true)).toBe(false);
    attacker.phaseElapsed = .12;
    expect(requestCommand(model, 'player', 'quick')).toBe(true); expect(model.player.moveId).toBe('counter');
    expect(model.player.attackInstanceId).toBe(1); expect(model.fighterStats.player.counters).toBe(1);
  });
});
