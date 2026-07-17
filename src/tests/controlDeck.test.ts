import { describe, expect, it } from 'vitest';
import { createMatch } from '../game/systems/combat';
import { buildControlLabels, buildControlReadout, buildVisibleControls, controlPrompt } from '../ui/ControlDeck';

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
    expect(top.callout).toContain('R3 DOMEFALL');
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

  it('lights the physical key intent immediately before the rig reaches full speed', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal');
    const walking = buildControlReadout(model.player, model.opponent, 0, 3, false, 'keyboard', { x: 0, z: -1 });
    expect(walking.state).toContain('STRAFE'); expect(walking.state).toContain('OPPONENT LOCKED'); expect(walking.active.has('move')).toBe(true);
    const running = buildControlReadout(model.player, model.opponent, 0, 3, false, 'keyboard', { x: 1, z: 0 }, true);
    expect(running.state).toContain('SPRINTING'); expect(running.active.has('run')).toBe(true);
  });

  it('shows the exact directional strikes instead of generic quick and power labels', () => {
    const model = createMatch('vex', 'atlas', 'standard', 'normal');
    const up = buildControlLabels(model.player, model.opponent, 0, 1.4, { x: 0, z: -1 });
    // BLOCKBUSTER: J=Punch, K=Kick. up is quick=VOLTAGE UPPERCUT (arm), heavy=HALO HIGH KICK (leg)
    expect(up.quick).toBe('VOLTAGE UPPERCUT'); expect(up.heavy).toBe('HALO HIGH KICK');
    const left = buildControlLabels(model.player, model.opponent, 0, 1.4, { x: -1, z: 0 });
    expect(left.heavy).toBe('ARC ROUNDHOUSE');
    const right = buildControlLabels(model.player, model.opponent, 0, 1.4, { x: 1, z: 0 });
    expect(right.heavy).toBe('HALO HIGH KICK');
    const down = buildControlLabels(model.player, model.opponent, 0, 1.4, { x: 0, z: 1 });
    expect(down.quick).toBe('HARDLINE HEADBUTT');
  });

  it('keeps the moving strike labels exact while a released input is still braking', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal');
    model.player.state = 'locomotion'; model.player.velocity = { x: 0, z: -2.4 };
    const labels = buildControlLabels(model.player, model.opponent, 2.4, 3, { x: 0, z: 0 });
    // BLOCKBUSTER: up quick is VOLTAGE UPPERCUT, up heavy is HALO HIGH KICK
    expect(labels.quick).toBe('VOLTAGE UPPERCUT');
    expect(labels.heavy).toBe('HALO HIGH KICK');
  });

  it('surfaces wrestler-facing button names in the neutral standing deck', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal');
    const labels = buildControlLabels(model.player, model.opponent, 0, 1.4);
    expect(labels.quick).toBe('CIRCUIT JAB');
    expect(labels.heavy).toBe('PISTON BOOT');
    expect(labels.grapple).toBe('COLLAR LOCK');
    expect(labels.context).toBe('NO CONTEXT ACTION');
    expect(labels.taunt).toBe('SIGNATURE TAUNT');
    expect(controlPrompt('keyboard', 'context')).toBe('F');
    expect(controlPrompt('keyboard', 'jump')).toBe('C');
    expect(controlPrompt('keyboard', 'counter')).toBe('SPACE');
  });

  it('matches the visible body-slam prompt to the real collar-tie range', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal');
    // BLOCKBUSTER: grapple range increased from 1.65 / 1.66 to 2.15 / 2.16
    expect(buildControlLabels(model.player, model.opponent, 0, 2.15).grapple).toBe('COLLAR LOCK');
    expect(buildControlLabels(model.player, model.opponent, 0, 2.16).grapple).toBe('CLOSE DISTANCE');
  });

  it('renders four compact core controls and takes context labels from the authoritative resolvers', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal');
    const readout = buildControlReadout(model.player, model.opponent, 0, 1.4, false);
    const controls = buildVisibleControls(readout, 'keyboard', 'compact', 'PIN SHOULDERS', 'PICK UP CHAIR');
    expect(controls.map((control) => control.id)).toEqual(['quick', 'heavy', 'grapple', 'context']);
    expect(controls.find((control) => control.id === 'context')).toMatchObject({ key: 'F', label: 'PIN SHOULDERS' });
    expect(controls.some((control) => control.id === 'interact')).toBe(false);
  });

  it('names the exact neutral combo strike before it is pressed', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal'); model.player.comboStep = 1;
    expect(buildControlLabels(model.player, model.opponent, 0, 1.4).quick).toBe('NEON ONE-TWO');
  });

  it('switches the whole action deck for grapple, turnbuckle, rope exit, and kick-up states', () => {
    const model = createMatch('chad', 'atlas', 'standard', 'normal');
    model.player.state = 'grappling'; model.player.moveId = 'slam'; model.player.attackPhase = 'anticipation';
    const grapple = buildControlLabels(model.player, model.opponent, 0, 1, { x: 1, z: 0 });
    expect(grapple.quick).toBe('SIDEWINDER TOSS'); expect(grapple.heavy).toBe('VOLTAGE SLAM'); expect(grapple.grapple).toBe('ARC SUPLEX');
    model.player.state = 'climbing'; model.player.climbStage = 3; model.player.moveId = null;
    const corner = buildControlLabels(model.player, model.opponent, 0, 4);
    expect(corner.quick).toBe('NEON DROP ELBOW'); expect(corner.heavy).toBe('TOP-ROPE MISSILE KICK'); expect(corner.context).toBe('DOMEFALL DIVE');
    model.player.state = 'downed'; model.player.climbStage = 0;
    expect(buildControlLabels(model.player, model.opponent, 0, 2).counter).toBe('LIVEWIRE KICK-UP');
    model.player.state = 'idle'; model.player.position = { x: 4.9, z: 0 };
    expect(buildControlLabels(model.player, model.opponent, 0, 2).context).toBe('EXIT CENTER ROPE');
  });
});
