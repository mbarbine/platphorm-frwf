import { FIGHTERS } from '../data/fighters';
import { MOVES } from '../data/moves';

export const RELEASE_MANIFEST = {
  fighterVersion: 'ringfall-fighters-1.1.0',
  moveVersion: 'ringfall-moves-1.1.0',
  arenaVersion: 'volt-dome-1.1.0',
  assetVersion: 'ringfall-assets-1.1.0',
  fighterIds: FIGHTERS.map((fighter) => fighter.id),
  moveIds: Object.keys(MOVES),
  criticalAssetPaths: ['/favicon.svg'],
} as const;

export const releaseManifestCounts = {
  fighters: RELEASE_MANIFEST.fighterIds.length,
  moves: RELEASE_MANIFEST.moveIds.length,
  criticalAssets: RELEASE_MANIFEST.criticalAssetPaths.length,
} as const;
