import { describe, expect, it } from 'vitest';
import { MOTOR_PROFILES, motorStrengthFor, selectMotorProfile } from '../game/physics/motorProfiles';
import { createFighterRuntime } from '../game/systems/combat';

describe('BodyWorks motor profiles', () => {
  it('keeps knockout actuation near zero while preserving a protected head chain', () => {
    const fighter = createFighterRuntime('atlas', { x: 0, z: 0 }); fighter.state = 'defeated';
    const profile = selectMotorProfile(fighter);
    expect(profile.id).toBe('knockout'); expect(profile.rootMode).toBe('physical');
    expect(profile.chains.core.stiffness).toBeLessThan(MOTOR_PROFILES.combat.chains.core.stiffness * .08);
    expect(profile.chains.head.strength).toBeGreaterThan(profile.chains.core.strength);
  });

  it('reduces strength through stamina and muscle without adding input latency', () => {
    const fresh = createFighterRuntime('chad', { x: 0, z: 0 }); const exhausted = createFighterRuntime('chad', { x: 0, z: 0 });
    exhausted.stamina = 0; exhausted.body.muscle = .18;
    expect(motorStrengthFor(exhausted, MOTOR_PROFILES.lift, 'chest')).toBeLessThan(motorStrengthFor(fresh, MOTOR_PROFILES.lift, 'chest') * .55);
    expect(motorStrengthFor(exhausted, MOTOR_PROFILES.lift, 'chest')).toBeGreaterThan(0);
  });

  it('uses distinct physical authority for locomotion, guard, lift, fall, and get-up', () => {
    const fighter = createFighterRuntime('nova', { x: 0, z: 0 });
    fighter.state = 'locomotion'; fighter.velocity.x = 4.5; expect(selectMotorProfile(fighter).id).toBe('running');
    fighter.state = 'blocking'; expect(selectMotorProfile(fighter).id).toBe('blocking');
    fighter.state = 'grappling'; fighter.moveId = 'slam'; fighter.attackPhase = 'anticipation'; expect(selectMotorProfile(fighter).id).toBe('lift');
    fighter.moveId = null; fighter.state = 'airborne'; expect(selectMotorProfile(fighter).id).toBe('protectedFall');
    fighter.state = 'recovering'; expect(selectMotorProfile(fighter).id).toBe('getUp');
  });

  it('gives a missed grapple a physical reach profile instead of a presentation-only pose', () => {
    const fighter = createFighterRuntime('atlas', { x: 0, z: 0 });
    fighter.state = 'attacking'; fighter.moveId = 'grapple_miss'; fighter.attackPhase = 'active';
    expect(selectMotorProfile(fighter).id).toBe('grappleReach');
  });
});
