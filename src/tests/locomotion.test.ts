import { describe, expect, it } from 'vitest';
import { fighterById } from '../game/data/fighters';
import { integrateLocomotion, locomotionProfile } from '../game/physics/bodyDynamics';
import { createMatch } from '../game/systems/combat';

const STEP = 1 / 60;

describe('arcade locomotion feel', () => {
  it('acknowledges a valid movement input on the first fixed step', () => {
    const model = createMatch('brick', 'vex', 'standard', 'normal'); const before = { ...model.player.velocity };
    integrateLocomotion(model.player, fighterById('brick'), { x: 1, z: 0 }, false, STEP);
    expect(model.player.velocity.x).toBeGreaterThan(before.x); expect(model.player.state).toBe('idle');
  });

  it('brakes predictably when input is released', () => {
    const model = createMatch('brick', 'vex', 'standard', 'normal'); model.player.velocity = { x: 3.7, z: 0 }; const before = Math.hypot(model.player.velocity.x, model.player.velocity.z);
    integrateLocomotion(model.player, fighterById('brick'), { x: 0, z: 0 }, false, STEP);
    expect(Math.hypot(model.player.velocity.x, model.player.velocity.z)).toBeLessThan(before); expect(model.player.body.stride).toBeGreaterThanOrEqual(0);
    for (let frame = 0; frame < 15; frame += 1) integrateLocomotion(model.player, fighterById('brick'), { x: 0, z: 0 }, false, STEP);
    expect(Math.hypot(model.player.velocity.x, model.player.velocity.z)).toBeLessThan(.05); expect(model.player.body.leftFoot.planted).toBe(true); expect(model.player.body.rightFoot.planted).toBe(true);
  });

  it('running is decisively faster than walking', () => {
    const walk = createMatch('vex', 'atlas', 'standard', 'normal').player; const run = createMatch('vex', 'atlas', 'standard', 'normal').player; const definition = fighterById('vex');
    for (let frame = 0; frame < 30; frame += 1) { integrateLocomotion(walk, definition, { x: 1, z: 0 }, false, STEP); integrateLocomotion(run, definition, { x: 1, z: 0 }, true, STEP); }
    expect(Math.hypot(run.velocity.x, run.velocity.z)).toBeGreaterThan(Math.hypot(walk.velocity.x, walk.velocity.z) * 1.35);
  });

  it('gives agile fighters faster acceleration and turning than heavy fighters', () => {
    const atlas = locomotionProfile(fighterById('atlas')); const vex = locomotionProfile(fighterById('vex'));
    expect(vex.acceleration).toBeGreaterThan(atlas.acceleration); expect(vex.turnRate).toBeGreaterThan(atlas.turnRate); expect(vex.walkSpeed).toBeGreaterThan(atlas.walkSpeed);
    expect(atlas.walkSpeed).toBeGreaterThan(3); expect(vex.walkSpeed).toBeLessThan(3.5);
    expect(atlas.runSpeed).toBeGreaterThan(5.4); expect(vex.runSpeed).toBeLessThan(6.1);
  });
});
