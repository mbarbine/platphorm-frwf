import { describe, expect, it } from 'vitest';
import { computeStrikeForce, strikeDriveProfile } from '../game/physics/strikeDynamics';

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
});
