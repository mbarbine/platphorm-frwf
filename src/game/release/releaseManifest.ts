import { FIGHTERS } from '../data/fighters';
import { MOVES } from '../data/moves';
import { PRESENTATION_RIG_VERSION } from '../presentation/presentationManifest';

export const RELEASE_MANIFEST = {
  fighterVersion: 'ringfall-fighters-2.0.0',
  moveVersion: 'ringfall-moves-2.1.0',
  arenaVersion: 'volt-dome-2.0.0',
  assetVersion: 'ringfall-assets-2.0.0',
  presentationRigVersion: PRESENTATION_RIG_VERSION,
  fighterIds: FIGHTERS.map((fighter) => fighter.id),
  moveIds: Object.keys(MOVES),
  criticalAssetPaths: ['/favicon.svg'],
} as const;

export const releaseManifestCounts = {
  fighters: RELEASE_MANIFEST.fighterIds.length,
  moves: RELEASE_MANIFEST.moveIds.length,
  criticalAssets: RELEASE_MANIFEST.criticalAssetPaths.length,
} as const;
