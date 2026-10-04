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
  it('keeps idle elbow changes small across a full breathing cycle', () => {
    let previous = authoredIdlePose(POSES.combatIdle, 2);
    let changed = false;
    for (let frame = 1; frame <= 900; frame++) {
      const current = authoredIdlePose(POSES.combatIdle, 2 + frame / 60);
      for (const joint of ['leftForearm', 'rightForearm'] as const) {
        const delta = Math.abs(current[joint][0] - previous[joint][0]);
        expect(delta).toBeLessThan(.02);
        changed ||= delta > .00001;
        expect(current[joint].slice(1)).toEqual([0, 0]);
      }
      previous = current;
    }
    expect(changed).toBe(true);
  });

  it('drives the selected arm for each rope clothesline instead of reusing the right-arm pose', () => {
    const right = getMove('stiff_arm'); const left = getMove('rebound');
    const rightPose = getStrikePose(right, 'active', right.anticipationDuration + right.activeDuration * .6);
    const leftPose = getStrikePose(left, 'active', left.anticipationDuration + left.activeDuration * .6);
    if (!rightPose || !leftPose) throw new Error('Missing rope strike choreography');
    expect(rightPose.rightForearm[0]).toBeGreaterThan(-.3);
    expect(leftPose.leftForearm[0]).toBeGreaterThan(-.3);
    expect(leftPose.leftArm[0]).toBeCloseTo(rightPose.rightArm[0], 6);
    expect(leftPose.rightArm[0]).toBeCloseTo(rightPose.leftArm[0], 6);
    expect(leftPose.rootRoll).toBeLessThan(0);
  });

});
