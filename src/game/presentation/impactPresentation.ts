import type { ImpactEvent } from '../types/game';

export interface ImpactPresentation {
  position: [number, number, number]; ground: boolean; color: string;
  particles: number; radius: number; duration: number;
}

/** Keep collision height intact; noncontact events use the actual venue floor. */
export function impactPresentation(impact: ImpactEvent, floorY: number, reducedMotion: boolean, lowFlash: boolean): ImpactPresentation {
  const ground = ['grapple', 'table', 'nearfall', 'finisher', 'ko'].includes(impact.kind);
  const point = impact.contactPoint;
  const exact = point?.every(Number.isFinite) ? point : null;
  const fallbackHeight = ground ? .05 : impact.region === 'head' ? 1.85 : impact.region?.includes('Leg') ? .55 : 1.2;
  return {
    position: exact ? [exact[0], exact[1], exact[2]] : [impact.position.x, floorY + fallbackHeight, impact.position.z],
    ground,
    color: impact.kind === 'blocked' || impact.kind === 'counter' ? '#77dce5' : impact.kind === 'table' ? '#bd976d' : ground ? '#c6c0ad' : '#f4dbb3',
    particles: reducedMotion ? 0 : lowFlash ? 4 : ground ? 16 : 7,
    radius: ground ? .38 : .15,
    duration: ground ? .65 : impact.kind === 'light' ? .17 : .24,
  };
}
