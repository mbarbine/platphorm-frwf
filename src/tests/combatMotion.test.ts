import { describe, expect, it } from 'vitest';
import data from '../game/animation/generated/combat-motions.json';
import { authoredIdlePose, sampleCombatMotion } from '../game/animation/combatMotion';
import { getStrikePose } from '../game/animation/choreography';
import { POSES } from '../game/animation/poses';
import { getMove } from '../game/data/moves';

describe('user-supplied combat motion', () => {
  it('keeps source provenance and strips captured root travel from physical targets', () => {
    for (const clip of Object.values(data.clips)) {
      expect(clip.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(data.inventory.some(source => source.file === clip.source && source.sha256 === clip.sourceSha256)).toBe(true);
      expect(clip.sourceStart).toBeGreaterThan(0); // Excludes the source T-pose.
      for (const frame of clip.frames) {
        expect([frame.pose.rootX, frame.pose.rootY, frame.pose.rootZ]).toEqual([0, 0, 0]);
        for (const value of Object.values(frame.pose).flat()) expect(Number.isFinite(value)).toBe(true);
        for (const joint of ['leftForearm', 'rightForearm', 'leftShin', 'rightShin'] as const) {
          expect(frame.pose[joint][0]).toBeLessThanOrEqual(0);
          expect(frame.pose[joint].slice(1)).toEqual([0, 0]);
        }
      }
    }
  });

  it.each(['jab', 'combo', 'front_kick', 'roundhouse'])('%s returns to a supported neutral pose after the source clip', id => {
    const move = getMove(id);
    const end = getStrikePose(move, 'recovery', move.anticipationDuration + move.activeDuration + move.recoveryDuration);
    expect(end).not.toBeNull();
    if (!end) throw new Error(`Missing recovery pose for ${id}`);
    const expected = Object.values(POSES.combatIdle).flat();
    Object.values(end).flat().forEach((value, i) => expect(value).toBeCloseTo(expected[i], 6));
    const strike = getStrikePose(move, 'active', move.anticipationDuration + move.activeDuration * .6);
    if (!strike) throw new Error(`Missing strike pose for ${id}`);
    expect(strike).not.toEqual(POSES.combatIdle);
    expect(Math.abs(strike.rootTilt)).toBeLessThanOrEqual(.22);
    expect(Math.abs(strike.rootRoll)).toBeLessThanOrEqual(.18);
  });

  it('uses a live fighting stance without moving either planted leg', () => {
    const a = authoredIdlePose(POSES.combatIdle, 2); const b = authoredIdlePose(POSES.combatIdle, 7);
    expect(a.leftArm).not.toEqual(b.leftArm);
    expect(a.leftLeg).toEqual(POSES.combatIdle.leftLeg);
    expect(a.rightLeg).toEqual(POSES.combatIdle.rightLeg);
    expect(sampleCombatMotion('unknown', 0)).toBeNull();
  });
});
