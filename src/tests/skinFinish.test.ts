import { describe, expect, it } from 'vitest';
import { skinRoughnessForEffort } from '../game/presentation/skinFinish';

describe('exertion-scaled fighter skin finish', () => {
  it('keeps a fresh fighter at their authored matte skin finish', () => {
    expect(skinRoughnessForEffort(.58, 100, 100, false)).toBe(.58);
  });

  it('adds restrained specular sheen as a fighter tires or enters combat', () => {
    const rested = skinRoughnessForEffort(.58, 100, 100, false);
    const active = skinRoughnessForEffort(.58, 100, 100, true);
    const exhausted = skinRoughnessForEffort(.58, 0, 100, false);
    expect(active).toBeLessThan(rested);
    expect(exhausted).toBeLessThan(active);
    expect(exhausted).toBeGreaterThanOrEqual(.34);
  });

  it('clamps malformed stamina and keeps a finite finish for characters without a stamina cap', () => {
    expect(skinRoughnessForEffort(.58, -50, 100, false)).toBe(skinRoughnessForEffort(.58, 0, 100, false));
    expect(skinRoughnessForEffort(.58, 0, 0, false)).toBe(.58);
    expect(skinRoughnessForEffort(2, 0, 100, true)).toBe(.78);
  });
});
