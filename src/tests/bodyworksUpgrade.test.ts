import { describe, expect, it } from 'vitest';
import { recoveryPose } from '../game/animation/recoveryMotion';
import { POSES } from '../game/animation/poses';
import { resolveRuntimeQuality } from '../game/runtime/quality';
import { createMatch, requestCommand } from '../game/systems/combat';

describe('Bodyworks playability upgrade', () => {
  it('selects deterministic constrained and quality rendering profiles without changing physics', () => {
    const constrained = resolveRuntimeQuality({ preference: 'auto', width: 390, devicePixelRatio: 3, hardwareConcurrency: 4, deviceMemoryGb: 4, reducedMotion: false, physicsLab: false });
    const quality = resolveRuntimeQuality({ preference: 'quality', width: 1440, devicePixelRatio: 2, hardwareConcurrency: 10, deviceMemoryGb: 16, reducedMotion: false, physicsLab: false });
    expect(constrained.tier).toBe('performance'); expect(constrained.shadows).toBe(false); expect(constrained.crowdCount).toBeLessThan(quality.crowdCount);
    expect(quality.tier).toBe('quality'); expect(quality.antialias).toBe(true);
  });

  it('authors distinct back, front, and side recoveries that converge on the standing stance', () => {
    const back = recoveryPose('back', 'downed', 0); const front = recoveryPose('front', 'downed', 0); const side = recoveryPose('left', 'downed', 0);
    expect(front.rootYaw).not.toBe(back.rootYaw); expect(side.rootRoll).not.toBe(back.rootRoll);
    expect(recoveryPose('right', 'recovering', .7)).toEqual(POSES.combatIdle);
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
});

