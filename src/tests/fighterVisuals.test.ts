import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../game/data/fighters';
import { FIGHTER_VISUALS, fighterVisual } from '../game/presentation/fighterVisuals';

describe('blockbuster fighter presentation profiles', () => {
  it('defines one complete profile for every playable wrestler', () => {
    expect(Object.keys(FIGHTER_VISUALS).sort()).toEqual(FIGHTERS.map((fighter) => fighter.id).sort());
    for (const fighter of FIGHTERS) expect(fighterVisual(fighter.id)).toBe(FIGHTER_VISUALS[fighter.id]);
  });

  it('keeps silhouettes, attire, hair, eyes, and soles individually recognizable', () => {
    const profiles = Object.values(FIGHTER_VISUALS);
    expect(new Set(profiles.map((profile) => profile.attire)).size).toBe(FIGHTERS.length);
    expect(new Set(profiles.map((profile) => profile.hair)).size).toBe(FIGHTERS.length);
    expect(new Set(profiles.map((profile) => profile.eyeColor)).size).toBe(FIGHTERS.length);
    expect(new Set(profiles.map((profile) => profile.soleColor)).size).toBe(FIGHTERS.length);
    expect(new Set(profiles.map((profile) => `${profile.chestScale}:${profile.waistScale}:${profile.stanceWidth}`)).size).toBe(FIGHTERS.length);
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
