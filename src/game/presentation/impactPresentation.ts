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
  const isHeavyHit = impact.kind === 'heavy' || impact.kind === 'finisher' || impact.kind === 'ko' || impact.kind === 'weapon';
  return {
    position: exact ? [exact[0], exact[1], exact[2]] : [impact.position.x, floorY + fallbackHeight, impact.position.z],
    ground,
    color: impact.kind === 'blocked' || impact.kind === 'counter' ? '#77dce5'
      : impact.kind === 'table' ? '#bd976d'
      : impact.kind === 'finisher' || impact.kind === 'ko' ? '#ffcc33'
      : impact.kind === 'heavy' || impact.kind === 'weapon' ? '#ff5522'
      : ground ? '#d8d2be'
      : '#f4dbb3',
    particles: reducedMotion ? 0 : lowFlash ? 8 : impact.kind === 'finisher' || impact.kind === 'ko' ? 64 : ground ? 42 : isHeavyHit ? 36 : 22,
    radius: ground ? .78 : isHeavyHit ? .58 : .34,
    duration: ground ? 1.05 : impact.kind === 'light' ? .32 : .55,
  };
}
