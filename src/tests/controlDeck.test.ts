import { describe, expect, it } from 'vitest';
import { createMatch } from '../game/systems/combat';
import { buildControlReadout } from '../ui/ControlDeck';

describe('live wrestling control deck', () => {
  it('makes a rope rebound and stiff-arm window explicit', () => {
    const model = createMatch('brick', 'vex', 'standard', 'normal');
    model.player.ropeRebound = 1.1;
    const readout = buildControlReadout(model.player, model.opponent, 5.1, 3, false);
    expect(readout.state).toContain('ROPES LOADED');
    expect(readout.callout).toContain('K NOW');
    expect(readout.active.has('heavy')).toBe(true);
    expect(readout.active.has('run')).toBe(true);
  });

  it('shows each staged corner action and gamepad binding', () => {
    const model = createMatch('chad', 'atlas', 'standard', 'normal');
    model.player.state = 'climbing';
    model.player.climbStage = 2;
    const middle = buildControlReadout(model.player, model.opponent, 0, 4, false, 'gamepad');
    expect(middle.state).toContain('STAGE 2 / 3');
    expect(middle.callout).toContain('R3 AGAIN');
    expect(middle.active.has('context')).toBe(true);

    model.player.climbStage = 3;
    const top = buildControlReadout(model.player, model.opponent, 0, 4, false, 'gamepad');
    expect(top.callout).toContain('R3 DIVE');
    expect(top.callout).toContain('RB POSE');
    expect(top.active.has('taunt')).toBe(true);
  });

  it('confirms physical jumping and pausing without suggesting illegal play', () => {
    const model = createMatch('vex', 'atlas', 'chaos', 'hard');
    model.player.state = 'jumping';
    expect(buildControlReadout(model.player, model.opponent, 1.2, 2.5, false).active.has('jump')).toBe(true);
    const paused = buildControlReadout(model.player, model.opponent, 0, 2.5, true);
    expect(paused.state).toBe('MATCH PAUSED');
    expect(paused.callout).toContain('SIMULATION STOPPED');
  });
});
