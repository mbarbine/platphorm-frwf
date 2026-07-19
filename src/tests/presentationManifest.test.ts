import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../game/data/fighters';
import { MOVES } from '../game/data/moves';
import { PRESENTATION_MANIFEST, selectFighterDetail } from '../game/presentation/presentationManifest';

describe('wrestler presentation manifest', () => {
  it('keeps one compatible shared hierarchy and five unique visual identities', () => {
    expect(PRESENTATION_MANIFEST.joints).toContain('root');
    expect(PRESENTATION_MANIFEST.joints).toContain('leftForearm');
    expect(PRESENTATION_MANIFEST.fighters.map(({ id }) => id)).toEqual(FIGHTERS.map(({ id }) => id));
    expect(new Set(PRESENTATION_MANIFEST.fighters.map(({ visual }) => JSON.stringify(visual))).size).toBe(5);
    expect(PRESENTATION_MANIFEST.debugFallback).toBe(false);
  });

  it('maps every public move to a real presentation family', () => {
    expect(PRESENTATION_MANIFEST.moves).toHaveLength(Object.keys(MOVES).length);
    expect(PRESENTATION_MANIFEST.moves.every(({ family }) => family.length > 8 && !family.includes('placeholder'))).toBe(true);
    expect(PRESENTATION_MANIFEST.fighters.every(({ finisher, taunt }) => finisher.length > 3 && taunt.length > 12)).toBe(true);
  });

  it('selects mature LODs without exposing debug capsules', () => {
    expect(selectFighterDetail('quality', 8)).toBe('full');
    expect(selectFighterDetail('balanced', 8)).toBe('standard');
    expect(selectFighterDetail('performance', 8)).toBe('reduced');
    expect(selectFighterDetail('quality', 30)).toBe('reduced');
  });
});
