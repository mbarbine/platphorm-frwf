import { describe, expect, it } from 'vitest';
import { RELEASE_IDENTITY } from '../game/release/releaseIdentity';
import { RELEASE_MANIFEST, releaseManifestCounts } from '../game/release/releaseManifest';

describe('public-safe release identity', () => {
  it('binds the running build to versioned fighter, move, arena, and asset manifests', () => {
    expect(RELEASE_IDENTITY.applicationVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(RELEASE_IDENTITY.gitSha.length).toBeGreaterThanOrEqual(7);
    expect(Date.parse(RELEASE_IDENTITY.buildTimestamp)).not.toBeNaN();
    expect(RELEASE_IDENTITY).toMatchObject({
      fighterManifestVersion: RELEASE_MANIFEST.fighterVersion,
      moveManifestVersion: RELEASE_MANIFEST.moveVersion,
      arenaManifestVersion: RELEASE_MANIFEST.arenaVersion,
      assetManifestVersion: RELEASE_MANIFEST.assetVersion,
      presentationRigVersion: RELEASE_MANIFEST.presentationRigVersion,
      fighterCount: 5,
      moveCount: 34,
      criticalAssetCount: 1,
    });
  });

  it('keeps registry counts and ids deterministic', () => {
    expect(releaseManifestCounts).toEqual({ fighters: 5, moves: 34, criticalAssets: 1 });
    expect(new Set(RELEASE_MANIFEST.fighterIds).size).toBe(5);
    expect(new Set(RELEASE_MANIFEST.moveIds).size).toBe(34);
  });
});
