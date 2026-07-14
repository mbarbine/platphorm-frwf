import { describe, expect, it } from 'vitest';
import { impactHapticPattern } from '../game/input/gamepadHaptics';

describe('impact haptics', () => {
  it('keeps rumble bounded and makes main-event impacts materially stronger', () => {
    const jab = impactHapticPattern({ kind: 'light', intensity: .6 });
    const slam = impactHapticPattern({ kind: 'grapple', intensity: 1.5 });
    const finisher = impactHapticPattern({ kind: 'finisher', intensity: 2.2 });
    expect(jab.strongMagnitude).toBeLessThan(slam.strongMagnitude);
    expect(slam.strongMagnitude).toBeLessThan(finisher.strongMagnitude);
    expect(finisher.duration).toBeGreaterThan(slam.duration);
    expect(finisher.strongMagnitude).toBeLessThanOrEqual(1);
    expect(finisher.weakMagnitude).toBeLessThanOrEqual(1);
  });
});
