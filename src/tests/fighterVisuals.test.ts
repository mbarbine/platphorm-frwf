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

  it('gives each woman a different silhouette, hair and gear profile', () => {
    const women = ['nova', 'gil', 'chelsea', 'britt'] as const;
    const profiles = women.map(fighterVisual);
    expect(new Set(profiles.map(profile => profile.hair)).size).toBe(women.length);
    expect(new Set(profiles.map(profile => profile.attire)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(profiles.map(profile => `${profile.chestScale}:${profile.waistScale}:${profile.shoulderScale}:${profile.thighScale}`)).size).toBe(women.length);
    expect(fighterVisual('chelsea').hair).toBe('longFlow');
    expect(fighterVisual('britt').hair).toBe('twinBraid');
  });

  it('does not reuse women’s core physical or gameplay attributes', () => {
    const women = ['nova', 'gil', 'chelsea', 'britt'] as const;
    const identities = women.map(id => {
      const fighter = FIGHTERS.find(entry => entry.id === id);
      expect(fighter).toBeDefined();
      return JSON.stringify({ physics: fighter?.physics, stats: fighter?.stats, personality: fighter?.personality, palette: fighter?.palette });
    });
    expect(new Set(identities).size).toBe(women.length);
  });
});
