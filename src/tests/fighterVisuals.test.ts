import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../game/data/fighters';
import { FIGHTER_VISUALS, fighterVisual } from '../game/presentation/fighterVisuals';

describe('blockbuster fighter presentation profiles', () => {
  it('defines one complete profile for every playable wrestler', () => {
    expect(Object.keys(FIGHTER_VISUALS).sort()).toEqual(FIGHTERS.map((fighter) => fighter.id).sort());
    for (const fighter of FIGHTERS) expect(fighterVisual(fighter.id)).toBe(FIGHTER_VISUALS[fighter.id]);
  });

  it('keeps complete identities distinct while allowing shared natural colors', () => {
    const profiles = Object.values(FIGHTER_VISUALS);
    // Wrestlers may share clothing or hair styles while retaining a distinct complete look.
    expect(new Set(profiles.map((profile) => JSON.stringify(profile))).size).toBe(FIGHTERS.length);
    // Real people can share eye color and black boot soles. Actual distinct
    // body meshes, weights and texture hashes are checked in characterAssets.
    for (const profile of profiles) {
      expect(profile.eyeColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(profile.soleColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(new Set(profiles.map(profile => `${profile.chestScale}:${profile.waistScale}:${profile.stanceWidth}`)).size).toBeGreaterThan(5);
  });

  it('uses finite, human-safe proportions and motion parameters', () => {
    for (const profile of Object.values(FIGHTER_VISUALS)) {
      const numeric = [
        profile.chestScale, profile.waistScale, profile.shoulderScale, profile.armScale, profile.thighScale, profile.calfScale,
        profile.bootScale, ...profile.headScale, profile.stanceWidth, profile.motionTempo, profile.stepWeight, profile.guardHeight,
        profile.fatigueDroop, profile.skinRoughness, profile.gearMetalness,
      ];
      expect(numeric.every(Number.isFinite)).toBe(true);
      expect(Math.min(...numeric)).toBeGreaterThan(.15);
      expect(Math.max(...numeric)).toBeLessThan(1.6);
    }
  });
});
