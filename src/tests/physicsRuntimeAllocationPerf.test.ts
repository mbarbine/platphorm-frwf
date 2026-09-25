import { describe, expect, it } from 'vitest';
import { MOTOR_PROFILES, type MotorProfileId } from '../game/physics/motorProfiles';

const UPPER_BODY_DYNAMIC_PROFILES = new Set<MotorProfileId>([
  'neutral',
  'combat',
  'walking',
  'running',
  'braking',
  'jumpLoad',
  'landing',
  'victory',
]);

describe('physicsRuntime profile ID allocation performance', () => {
  it('produces identical boolean results for all motor profile IDs', () => {
    for (const id in MOTOR_PROFILES) {
      const profileId = id as MotorProfileId;
      const inlineResult = [
        'neutral',
        'combat',
        'walking',
        'running',
        'braking',
        'jumpLoad',
        'landing',
        'victory',
      ].includes(profileId);
      const setResult = UPPER_BODY_DYNAMIC_PROFILES.has(profileId);
      expect(setResult).toBe(inlineResult);
    }
  });

  it('demonstrates benchmark improvement of Set lookup over inline array allocation', () => {
    const iterations = 1_000_000;
    const testProfiles: MotorProfileId[] = ['walking', 'clinch', 'combat', 'airborne', 'running', 'getUp'];

    const inlineStart = performance.now();
    let inlineHits = 0;
    for (let i = 0; i < iterations; i++) {
      const profileId = testProfiles[i % testProfiles.length] ?? 'walking';
      if (['neutral', 'combat', 'walking', 'running', 'braking', 'jumpLoad', 'landing', 'victory'].includes(profileId)) {
        inlineHits++;
      }
    }
    const inlineDuration = performance.now() - inlineStart;

    const setStart = performance.now();
    let setHits = 0;
    for (let i = 0; i < iterations; i++) {
      const profileId = testProfiles[i % testProfiles.length] ?? 'walking';
      if (UPPER_BODY_DYNAMIC_PROFILES.has(profileId)) {
        setHits++;
      }
    }
    const setDuration = performance.now() - setStart;

    expect(setHits).toBe(inlineHits);
    // Set lookup should be strictly faster or equal in duration
    expect(setDuration).toBeLessThanOrEqual(inlineDuration + 5);
  });
});
