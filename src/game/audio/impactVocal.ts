import type { ImpactEvent } from '../types/game';

export interface ImpactVocalCue {
  pitch: number;
  duration: number;
  gain: number;
  noiseOffset: number;
}

/** Stable per-impact breath/grunt cues; generated locally, with no recorded performer audio. */
export function impactVocalCue(event: ImpactEvent): ImpactVocalCue | null {
  if (!['light', 'heavy', 'grapple', 'weapon', 'finisher', 'table', 'ko', 'counter'].includes(event.kind)) return null;
  if (event.kind === 'light' && event.intensity < .58) return null;
  const intensity = Math.max(.55, Math.min(1.35, event.intensity));
  return {
    pitch: 102 + (event.id % 5) * 9,
    duration: event.kind === 'light' ? .14 : .23,
    gain: .042 * intensity,
    noiseOffset: (event.id % 7) * .13,
  };
}
