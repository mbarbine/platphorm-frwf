import { describe, expect, it } from 'vitest';
import { PlayerController } from '../game/input/playerController';
import { createMatch } from '../game/systems/combat';
import { createActionEvent } from '../game/input/actionLayer';

const input = { move: { x: 0, z: 0 }, run: false, block: false, actions: [] };
describe('arcade wrestling approach', () => {
  it('gives lateral steering back immediately instead of dragging the player toward a queued attack', () => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    model.player.position.x = -1; model.opponent.position.x = 1;
    const controller = new PlayerController();
    controller.read({ ...input, actions: [createActionEvent('quickStrike', { source: 'keyboard', timestamp: 0 })] }, model, 'arcade');
    const strafe = { x: 0, z: 1 };
    expect(controller.read({ ...input, move: strafe }, model, 'arcade').move).toEqual(strafe);
    model.player.position.x = .3;
    expect(controller.read(input, model, 'arcade').actions).toHaveLength(0);
  });
  it('steps into a grapple from the starting gap and only submits it in physical reach', () => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    const controller = new PlayerController();
    const event = createActionEvent('grapple', { source: 'keyboard', timestamp: 0 });
    const approaching = controller.read({ ...input, actions: [event] }, model, 'arcade');
    expect(approaching.move.x).toBe(1);
    expect(approaching.actions).toHaveLength(0);
    model.player.position.x = .3;
    const acquired = controller.read(input, model, 'arcade');
    expect(acquired.actions?.[0]?.action).toBe('grapple');
    expect(controller.read(input, model, 'arcade').actions).toHaveLength(0);
  });
  it('cancels an approach when the player retreats, and never grabs after a pause', () => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    const controller = new PlayerController();
    const event = createActionEvent('grapple', { source: 'keyboard', timestamp: 0 });
    controller.read({ ...input, actions: [event] }, model, 'arcade');
    controller.read({ ...input, move: { x: -1, z: 0 } }, model, 'arcade');
    model.player.position.x = .3;
    expect(controller.read(input, model, 'arcade').actions).toHaveLength(0);
    model.player.position.x = -1.8;
    controller.read({ ...input, actions: [event] }, model, 'arcade');
    model.paused = true; controller.read(input, model, 'arcade');
    model.paused = false; model.player.position.x = .3;
    expect(controller.read(input, model, 'arcade').actions).toHaveLength(0);
  });
  it('steps into quick-strike reach and cancels the queued strike on guard', () => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    model.player.position.x = -1; model.opponent.position.x = 1;
    const controller = new PlayerController();
    const event = createActionEvent('quickStrike', { source: 'keyboard', timestamp: 0 });
    expect(controller.read({ ...input, actions: [event] }, model, 'arcade').actions).toHaveLength(0);
    expect(controller.read(input, model, 'arcade').move.x).toBe(1);
    controller.read({ ...input, block: true }, model, 'arcade');
    model.player.position.x = .3;
    expect(controller.read(input, model, 'arcade').actions).toHaveLength(0);
  });
  it('approaches a downed rival to pin but cancels if they get up', () => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    model.opponent.state = 'downed';
    const controller = new PlayerController();
    const event = createActionEvent('contextAction', { source: 'keyboard', timestamp: 0 });
    expect(controller.read({ ...input, actions: [event] }, model, 'arcade').move.x).toBe(1);
    model.opponent.state = 'idle';
    expect(controller.read(input, model, 'arcade').actions).toHaveLength(0);
    expect(controller.read(input, model, 'arcade').move).toEqual(input.move);
  });
});
