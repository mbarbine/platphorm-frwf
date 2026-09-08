import { describe, expect, it } from 'vitest';
import { locomotionPose } from '../game/animation/locomotion';
import { impactPresentation } from '../game/presentation/impactPresentation';
import { throwDirection, throwMotionFor } from '../game/physics/throwMotion';
import { advanceMatch, createMatch, requestCommand } from '../game/systems/combat';
import { buildControlReadout } from '../ui/ControlDeck';

describe('readable wrestling motion', () => {
  it('backs up and side steps in facing space instead of walking forward in every direction', () => {
    const forward = locomotionPose({ x: 0, z: 3 }, 0, Math.PI / 2);
    const back = locomotionPose({ x: 0, z: -3 }, 0, Math.PI / 2);
    expect(back.leftLeg[0]).toBeLessThan(0);
    expect(Math.abs(back.leftLeg[0])).toBeLessThan(forward.leftLeg[0]);
    const lateral = locomotionPose({ x: 3, z: 0 }, 0, Math.PI / 2);
    expect(lateral.leftLeg[0]).toBeCloseTo(0);
    // Side shuffles must keep each boot on its side of the pelvis.
    expect(lateral.leftLeg[2]).toBeLessThanOrEqual(.035);
    const outward = locomotionPose({ x: 3, z: 0 }, 0, -Math.PI / 2);
    expect(outward.leftLeg[2]).toBeLessThan(-.1);
    expect(outward.rightLeg[2]).toBeGreaterThan(.1);
    expect(lateral.leftLeg[2]).toBeCloseTo(-lateral.rightLeg[2]);
    const turned = locomotionPose({ x: 3, z: 0 }, Math.PI / 2, Math.PI / 2);
    expect(turned.leftLeg[0]).toBeCloseTo(forward.leftLeg[0]);
    expect(turned.leftLeg[2]).toBeCloseTo(0);
  });
  it('fades to stillness and keeps sprint stride and knee bends compact', () => {
    const still = locomotionPose({ x: 0, z: 0 }, 0, 2);
    expect(still.leftLeg).toEqual([0, 0, 0]); expect(still.rootY).toBe(0);
    for (let phase = 0; phase < 7; phase += .1) {
      const pose = locomotionPose({ x: 4, z: 4 }, 0, phase);
      expect(Math.abs(pose.leftLeg[0])).toBeLessThan(.55);
      expect(Math.abs(pose.leftLeg[2])).toBeLessThan(.36);
      expect(pose.leftShin[0]).toBeLessThanOrEqual(0);
      expect(pose.leftShin[0]).toBeGreaterThan(-.8);
    }
  });
  it('gives neutral suplex and side toss different lanes while preserving deliberate direction', () => {
    expect(throwDirection({ x: 0, z: 1 }, { x: 0, z: 0 }, 'slam').z).toBeCloseTo(1);
    expect(throwDirection({ x: 0, z: 1 }, { x: 0, z: 0 }, 'suplex').z).toBeCloseTo(-1);
    expect(throwDirection({ x: 0, z: 1 }, { x: 0, z: 0 }, 'side_toss').x).toBeCloseTo(1);
    expect(throwDirection({ x: 0, z: 1 }, { x: -1, z: 0 }, 'suplex')).toEqual({ x: -1, z: 0 });
    expect(throwMotionFor('powerbomb').speed).toBeLessThan(throwMotionFor('side_toss').speed);
  });
  it('anchors head, ringside and table effects to the recorded three-dimensional manifold', () => {
    for (const y of [.45, 2.79, 3.55]) {
      const result = impactPresentation({ id: 1, position: { x: 3, z: -7 }, kind: 'table', intensity: 2, contactPoint: [3.2, y, -7.1] }, 1.845, false, false);
      expect(result.position).toEqual([3.2, y, -7.1]);
    }
    const legacy = impactPresentation({ id: 2, position: { x: 0, z: -7 }, kind: 'grapple', intensity: 1 }, .4, true, true);
    expect(legacy.position[1]).toBeCloseTo(.45); expect(legacy.particles).toBe(0);
  });
  it('holds a readable lift but lets release input advance immediately without awarding damage', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'easy');
    model.physicsAuthority = true; model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 1, z: 0 };
    expect(requestCommand(model, 'player', 'grapple')).toBe(true);
    if (!model.grapple) throw new Error('Missing grapple');
    model.grapple.phase = 'lift'; model.grapple.gripCount = 2; model.grapple.liftElapsed = .2;
    model.player.phaseElapsed = .8; model.opponent.state = 'grabbed';
    advanceMatch(model, .05, { move: { x: 0, z: 0 }, run: false, block: false, commands: [] });
    expect(model.player.attackPhase).toBe('anticipation');
    expect(requestCommand(model, 'player', 'quick')).toBe(true);
    expect(model.player.attackPhase).toBe('active');
    expect(model.opponent.health).toBe(100);
    expect(model.playerStats.grapples).toBe(0);
  });
  it('only offers release after the physical lift, not when the animation clock predicts it', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'easy');
    model.player.state = 'grappling'; model.player.moveId = 'slam'; model.player.attackPhase = 'anticipation'; model.player.phaseElapsed = .95;
    const read = (phase: 'acquire' | 'lift') => buildControlReadout(model.player, model.opponent, 0, 1, false, 'keyboard', { x: 0, z: 0 }, false, 'arcade', true, phase);
    expect(read('acquire').labels.quick).not.toBe('RELEASE THROW');
    expect(read('lift').labels.quick).toBe('RELEASE THROW');
    expect(read('lift').callout).toContain('J RELEASE');
  });
});
