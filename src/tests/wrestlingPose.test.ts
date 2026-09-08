import { describe, expect, it } from 'vitest';
import { hasPhysicalCover, kneeFlexion, type CoverEvidence } from '../game/physics/wrestlingPose';
import { selectDirectionalStrike } from '../game/systems/moveSelection';
const established: CoverEvidence = { separation: .1, chestClearance: .45, shoulderHeight: .3, defenderUpY: .1, defenderFrontY: .99, attackerUpY: .1 };
describe('wrestling anatomy and cover evidence', () => {
  it('flexes knees within the hinge rather than driving through the stop', () => {
    expect(kneeFlexion(-.8)).toBe(.8); expect(kneeFlexion(.1)).toBe(0); expect(kneeFlexion(-4)).toBe(2.45);
  });
  it('requires overlapping bodies, grounded shoulders and a supine defender', () => {
    expect(hasPhysicalCover(established)).toBe(true);
    for (const wrong of [{ separation: .7 }, { chestClearance: 1 }, { chestClearance: -.1 }, { shoulderHeight: 1 }, { defenderUpY: .9 }, { defenderFrontY: -.9 }, { attackerUpY: 1 }, { separation: NaN }]) expect(hasPhysicalCover({ ...established, ...wrong })).toBe(false);
  });
  it('makes the rising uppercut reachable as the third neutral quick strike', () => {
    expect([0, 1, 2, 3].map(step => selectDirectionalStrike({ x: 0, z: 0 }, 'quick', step))).toEqual(['jab', 'combo', 'uppercut', 'jab']);
  });
});
