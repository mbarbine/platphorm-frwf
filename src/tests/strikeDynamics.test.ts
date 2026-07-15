import { describe, expect, it } from 'vitest';
import { computeStrikeForce, guardInterceptDriveProfile, guardInterceptSurfaceTarget, strikeDriveProfile, strikePelvisAcceleration, sweptPlanarPathHitsTarget } from '../game/physics/strikeDynamics';
import { selectDirectionalStrike } from '../game/systems/moveSelection';

describe('physical strike drive', () => {
  it('drives a jab hand toward its target without exceeding muscle acceleration', () => {
    const profile = strikeDriveProfile('jab');
    expect(profile).not.toBeNull();
    if (!profile) return;
    const mass = 2.4;
    const force = computeStrikeForce({ x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, mass, profile);
    expect(force.x).toBeGreaterThan(0);
    expect(Math.hypot(force.x, force.y, force.z)).toBeLessThanOrEqual(profile.maximumAcceleration * mass + .001);
  });

  it('does not create a physical strike task for grapples or taunts', () => {
    expect(strikeDriveProfile('slam')).toBeNull();
    expect(strikeDriveProfile('taunt')).toBeNull();
  });

  it('maps neutral punch and kick controls to distinct physical limb drives', () => {
    const neutral = { x: 0, z: 0 };
    const punch = strikeDriveProfile(selectDirectionalStrike(neutral, 'quick', 0));
    const followUp = strikeDriveProfile(selectDirectionalStrike(neutral, 'quick', 1));
    const kick = strikeDriveProfile(selectDirectionalStrike(neutral, 'heavy'));

    expect(punch).toMatchObject({ source: 'rightHand', target: 'chest' });
    expect(followUp).toMatchObject({ source: 'leftHand', target: 'chest' });
    expect(kick).toMatchObject({ source: 'rightFoot', target: 'chest' });
  });

  it('bounds whole-body travel and near-field limb speed into a physical guard', () => {
    const jab = strikeDriveProfile('jab');
    expect(jab).not.toBeNull();
    if (!jab) return;

    expect(strikePelvisAcceleration(jab, false)).toBe(jab.pelvisAcceleration);
    expect(strikePelvisAcceleration(jab, true, .23)).toBeLessThan(1);
    expect(strikePelvisAcceleration(jab, true, .23)).toBeGreaterThan(0);
    expect(guardInterceptDriveProfile(jab, .23)).toMatchObject({
      source: jab.source,
      target: jab.target,
      speed: expect.closeTo(1.68),
      response: expect.closeTo(18.66),
      maximumAcceleration: expect.closeTo(195.6),
    });
    expect(guardInterceptDriveProfile(jab, 4)).toMatchObject(jab);
    expect(strikePelvisAcceleration(jab, true, 1.4)).toBe(jab.pelvisAcceleration);
    expect(guardInterceptSurfaceTarget({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toEqual({ x: 0, y: 0, z: .92 });
    expect(guardInterceptSurfaceTarget({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: .07 })).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('commits the full torso to a domefall dive', () => {
    const aerial = strikeDriveProfile('aerial');
    expect(aerial).toMatchObject({ source: 'chest', target: 'chest' });
    expect(aerial?.pelvisAcceleration).toBeGreaterThan(strikeDriveProfile('front_kick')?.pelvisAcceleration ?? 0);
  });

  it('keeps a high-speed rebound contact when the attacker crosses the target between phases', () => {
    expect(sweptPlanarPathHitsTarget({ x: 4.9, z: 0 }, { x: 2.7, z: .05 }, { x: 3.8, z: -.04 }, 1.32)).toBe(true);
    expect(sweptPlanarPathHitsTarget({ x: 4.9, z: 0 }, { x: 2.7, z: .05 }, { x: 3.8, z: 1.7 }, 1.32)).toBe(false);
    expect(sweptPlanarPathHitsTarget({ x: 4.9, z: 0 }, { x: 4.88, z: 0 }, { x: 3.8, z: 0 }, 1.32)).toBe(false);
  });
});
