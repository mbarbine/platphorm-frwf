import { describe, expect, it } from 'vitest';
import { RECOVERY_DURATION, recoveryPose } from '../game/animation/recoveryMotion';
import { POSES } from '../game/animation/poses';
import { stepBodyDynamics } from '../game/physics/bodyDynamics';
import { authoredDeckPoseOwnsRoot, visiblePelvisDrop } from '../game/presentation/matPresentation';
import { resolveRuntimeQuality, shouldUsePerformanceFallback } from '../game/runtime/quality';
import { createMatch, requestCommand } from '../game/systems/combat';

describe('Bodyworks playability upgrade', () => {
  it('selects deterministic constrained and quality rendering profiles without changing physics', () => {
    const constrained = resolveRuntimeQuality({ preference: 'auto', width: 390, devicePixelRatio: 3, hardwareConcurrency: 4, deviceMemoryGb: 4, reducedMotion: false, physicsLab: false });
    const quality = resolveRuntimeQuality({ preference: 'quality', width: 1440, devicePixelRatio: 2, hardwareConcurrency: 10, deviceMemoryGb: 16, reducedMotion: false, physicsLab: false });
    expect(constrained.tier).toBe('performance'); expect(constrained.shadows).toBe(false); expect(constrained.crowdCount).toBeLessThan(quality.crowdCount);
    expect(quality.tier).toBe('quality'); expect(quality.antialias).toBe(true);
  });

  it('drops decorative rendering only after sustained unreadable frame timing', () => {
    expect(shouldUsePerformanceFallback({ sampleCount: 5, frameP95Ms: 120, frameP99Ms: 180, framesOver100Ms: 4 })).toBe(false);
    expect(shouldUsePerformanceFallback({ sampleCount: 60, frameP95Ms: 18, frameP99Ms: 30, framesOver100Ms: 0 })).toBe(false);
    expect(shouldUsePerformanceFallback({ sampleCount: 12, frameP95Ms: 65, frameP99Ms: 110, framesOver100Ms: 3 })).toBe(true);
  });

  it('keeps the selected render quality in the lab while dropping the decorative crowd', () => {
    const input = { preference: 'quality' as const, width: 1440, devicePixelRatio: 2, hardwareConcurrency: 10, reducedMotion: false, physicsLab: false };
    const match = resolveRuntimeQuality(input); const lab = resolveRuntimeQuality({ ...input, physicsLab: true });
    expect(lab.dpr).toEqual(match.dpr);
    expect(lab.antialias).toBe(true); expect(lab.shadows).toBe(true); expect(lab.crowdCount).toBe(0);
  });

  it('authors distinct back, front, and side recoveries that converge on the standing stance', () => {
    const back = recoveryPose('back', 'downed', 0); const front = recoveryPose('front', 'downed', 0); const side = recoveryPose('left', 'downed', 0);
    expect(front.rootYaw).not.toBe(back.rootYaw); expect(side.rootRoll).not.toBe(back.rootRoll);
    expect(recoveryPose('right', 'recovering', RECOVERY_DURATION)).toEqual(POSES.combatIdle);
  });

  it('puts a real trash can in Chaos and exposes a nearby secured corner rail shot', () => {
    const model = createMatch('atlas', 'nova', 'chaos', 'normal', 999);
    expect(model.props.some((prop) => prop.kind === 'trash' && prop.durability === 4)).toBe(true);
    model.player.position = { x: 3.72, z: 2.45 }; model.opponent.position = { x: 4.45, z: 3.02 };
    expect(requestCommand(model, 'player', 'grapple')).toBe(true);
    expect(model.player.state).toBe('grappling');
    expect(requestCommand(model, 'player', 'context')).toBe(true);
    expect(model.player.moveId).toBe('corner_smash'); expect(model.announcement).toContain('RAIL SHOT');
  });

  it('settles a tiny post-impact hover back to the mat', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal');
    model.player.state = 'idle';
    model.player.body.verticalOffset = .04;
    model.player.body.verticalVelocity = .14;
    for (let frame = 0; frame < 20; frame += 1) stepBodyDynamics(model.player, 1 / 60);
    expect(model.player.body.verticalOffset).toBe(0);
    expect(model.player.body.verticalVelocity).toBe(0);
  });

  it('never applies standing pelvis compression on top of a deck recovery pose', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal');
    model.player.body.pelvisDrop = .45;
    model.player.body.leanForward = .8; model.player.body.leanSide = -.6;
    model.player.body.leanVelocity = 1.2; model.player.body.sideVelocity = -.9;
    model.player.state = 'downed';
    expect(authoredDeckPoseOwnsRoot(model.player)).toBe(true);
    expect(visiblePelvisDrop(model.player)).toBe(0);
    for (let frame = 0; frame < 24; frame += 1) stepBodyDynamics(model.player, 1 / 60);
    expect(model.player.body.pelvisDrop).toBeLessThan(.002);
    expect(Math.abs(model.player.body.leanForward)).toBeLessThan(.002);
    expect(Math.abs(model.player.body.leanSide)).toBeLessThan(.002);
    model.player.state = 'idle'; model.player.body.pelvisDrop = .45;
    expect(visiblePelvisDrop(model.player)).toBe(.22);
  });
});
