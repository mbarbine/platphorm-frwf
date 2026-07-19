import { describe, expect, it } from 'vitest';
import { resolveCombatOrientation } from '../game/animation/combatOrientation';
import { createMatch } from '../game/systems/combat';

describe('neutral combat orientation', () => {
  it('tracks an off-axis opponent with bounded chest and head yaw', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal');
    model.player.position = { x: 0, z: 0 }; model.player.facing = 0; model.opponent.position = { x: 2, z: 0 };
    const orientation = resolveCombatOrientation(model.player, model.opponent);
    expect(orientation.tracking).toBe(true);
    expect(orientation.torsoYaw).toBeCloseTo(.52);
    expect(orientation.headYaw).toBeGreaterThan(0);
    expect(Math.abs(orientation.headTargetError)).toBeLessThan(.36);
  });

  it('preserves a player-selected movement heading independently of combat facing', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal');
    model.player.position = { x: 0, z: 0 }; model.player.facing = 0; model.player.velocity = { x: -3, z: 0 }; model.player.state = 'locomotion'; model.opponent.position = { x: 0, z: 2 };
    const orientation = resolveCombatOrientation(model.player, model.opponent);
    expect(orientation.movementHeading).toBeCloseTo(-Math.PI / 2);
    expect(orientation.combatFacing).toBe(0);
    expect(orientation.torsoYaw).toBe(0);
  });

  it('bounds tracking instead of snapping the physical facing toward a rear target', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal');
    model.player.position = { x: 0, z: 0 }; model.player.facing = 0; model.opponent.position = { x: 0, z: -2 };
    const orientation = resolveCombatOrientation(model.player, model.opponent);
    expect(orientation.combatFacing).toBe(0);
    expect(Math.abs(orientation.torsoYaw)).toBeCloseTo(.52);
    expect(Math.abs(orientation.headYaw)).toBeCloseTo(.72);
    expect(Math.abs(orientation.headTargetError)).toBeGreaterThan(1.8);
  });
});
