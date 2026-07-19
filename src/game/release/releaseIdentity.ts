export interface ReleaseIdentity {
  applicationVersion: string;
  gitSha: string;
  shortGitSha: string;
  buildTimestamp: string;
  fighterManifestVersion: string;
  moveManifestVersion: string;
  arenaManifestVersion: string;
  assetManifestVersion: string;
  presentationRigVersion: string;
  deploymentEnvironment: string;
  fighterCount: number;
  moveCount: number;
  criticalAssetCount: number;
}

declare const __RINGFALL_RELEASE__: ReleaseIdentity;

export const RELEASE_IDENTITY: ReleaseIdentity = __RINGFALL_RELEASE__;
