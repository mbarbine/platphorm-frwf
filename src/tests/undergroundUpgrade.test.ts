import { describe, expect, it } from 'vitest';
import { createMatch, requestCommand } from '../game/systems/combat';
import { configureCombatVenue } from '../game/data/venues';
import { FIGHTERS } from '../game/data/fighters';
import { getMove } from '../game/data/moves';
import { WRESTLING_STYLES, signatureMoveId } from '../game/data/wrestlingStyles';
import { getPairedPose } from '../game/animation/choreography';
import { locomotionPose } from '../game/animation/locomotion';
import { resolveContextAction, resolvePropAction } from '../game/systems/contextResolver';
import { climbVerticalDelta } from '../game/systems/climbing';

describe('underground wrestling upgrade', () => {
  it('provides reachable weapons, table climbing and broken-object rejection', () => {
    const model = createMatch('josh', 'vex', 'chaos', 'easy'); configureCombatVenue(model, 'underground');
    model.opponent.position = { x: 6, z: 5 };
    const chair = model.props.find(p => p.kind === 'chair')!;
    model.player.position = { ...chair.position };
    expect(requestCommand(model, 'player', 'quick')).toBe(true);
    expect(model.player.heldPropId).toBe(chair.id);
    model.player.heldPropId = null; model.player.state = 'idle';
    model.player.position = { x: 0, z: -2.4 };
    expect(resolveContextAction(model, 'player').actionId).toBe('object_climb');
    expect(requestCommand(model, 'player', 'context')).toBe(true);
    expect(model.player.climbObjectId).toBe('table-1');
    model.player.state = 'idle'; model.propsById['table-1']!.broken = true;
    expect(resolveContextAction(model, 'player').legalState).toBe(false);
  });
  it('does not offer remote corner climbs or pickups through the ring apron', () => {
    const model = createMatch('atlas', 'vex', 'chaos', 'easy');
    model.player.position = { x: 10, z: 8 }; model.opponent.position = { x: 0, z: 0 };
    expect(resolveContextAction(model, 'player').actionId).not.toBe('turnbuckle_climb');
    model.player.position = { x: -5, z: 2.8 };
    model.props = model.props.filter(p => p.id === 'chair-1');
    expect(resolvePropAction(model, 'player').legalState).toBe(false);
  });
  it('can overcome downward gravity while keeping ascent velocity bounded', () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
      let y = 0, velocity = 0;
      for (let t = 0; t < 2; t += dt) { velocity += climbVerticalDelta(1.5 - y, velocity, dt) - 18 * dt; y += velocity * dt; }
      expect(y).toBeCloseTo(1.5, 2); expect(Math.abs(velocity)).toBeLessThan(.1);
    }
  });
  it('gives every wrestler a distinct gait and an executable named paired signature', () => {
    const gait = new Set<string>();
    for (const fighter of FIGHTERS) {
      gait.add(JSON.stringify(locomotionPose({ x: 0, z: 3.5 }, 0, .9, true, fighter.id)));
      const move = getMove(signatureMoveId(fighter.id));
      expect(move.displayName).toBe(fighter.signature);
      expect(move.signatureBase).toBe(WRESTLING_STYLES[fighter.id].signatureBase);
      expect(getPairedPose(move, 'actor', 'anticipation', move.anticipationDuration * .7, fighter.id)).not.toBeNull();
      expect(getPairedPose(move, 'victim', 'active', .1, fighter.id)).not.toBeNull();
      const model = createMatch(fighter.id, fighter.id === 'vex' ? 'atlas' : 'vex', 'standard', 'easy');
      model.player.momentum = 100; model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 0, z: 1 }; model.opponent.state = 'staggered';
      expect(requestCommand(model, 'player', 'context')).toBe(true);
      expect(model.player.moveId).toBe(move.id);
      expect(model.grapple?.position).toBeTruthy();
    }
    expect(gait.size).toBe(FIGHTERS.length);
  });
});
