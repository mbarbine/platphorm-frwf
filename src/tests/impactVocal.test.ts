import { describe, expect, it } from 'vitest';
import { impactVocalCue } from '../game/audio/impactVocal';
import type { ImpactEvent } from '../game/types/game';

const event = (kind: ImpactEvent['kind'], intensity: number, id = 1): ImpactEvent => ({
  id, kind, intensity, position: { x: 0, z: 0 }, moveId: 'jab',
});

describe('procedural impact vocal cues', () => {
  it('adds short, deterministic breath cues to meaningful contacts', () => {
    expect(impactVocalCue(event('heavy', 1, 7))).toEqual({ pitch: 120, duration: .23, gain: .042, noiseOffset: 0 });
    expect(impactVocalCue(event('light', .7))).toMatchObject({ duration: .14, gain: .0294 });
  });

  it('keeps soft glances and non-contact events quiet', () => {
    expect(impactVocalCue(event('light', .4))).toBeNull();
    expect(impactVocalCue(event('rope', 1))).toBeNull();
  });
});
