import type { MatchResult } from '../types/game';

export const CIRCUIT_OBJECTIVES = [
  { id: 'victory', label: 'Win the bout', detail: 'Pin or knock out your rival.' },
  { id: 'wrestler', label: 'Chain wrestler', detail: 'Win after completing at least two grapples.' },
  { id: 'showstopper', label: 'Showstopper', detail: 'Win by pinfall, or land a finisher.' },
] as const;
export type CircuitMedal = typeof CIRCUIT_OBJECTIVES[number]['id'];
export interface CircuitRecord { bouts: number; wins: number }
export function earnedMedals(result: MatchResult): CircuitMedal[] {
  if (result.winner !== 'player' || result.method === 'FORFEIT') return [];
  const medals: CircuitMedal[] = ['victory'];
  if (Number.isFinite(result.playerStats.grapples) && result.playerStats.grapples >= 2) medals.push('wrestler');
  if (result.method === 'PINFALL' || (Number.isFinite(result.playerStats.finishers) && result.playerStats.finishers > 0)) medals.push('showstopper');
  return medals;
}
export function circuitProgress(records: Record<string, CircuitRecord>, medals: Record<string, CircuitMedal[]>) {
  const victories = Object.values(records).filter(r => r.wins > 0).length;
  const mastery = Object.values(medals).reduce((sum, values) => sum + values.filter(id => id !== 'victory').length, 0);
  const reputation = victories * 100 + mastery * 40;
  const ranks = [{ title: 'New arrival', threshold: 0 }, { title: 'Yard regular', threshold: 100 }, { title: 'Crowd favorite', threshold: 300 }, { title: 'Main-event contender', threshold: 600 }, { title: 'Showground legend', threshold: 1000 }];
  const rank = ranks.filter(r => reputation >= r.threshold).at(-1) ?? { title: 'New arrival', threshold: 0 };
  const next = ranks.find(r => r.threshold > reputation);
  return { victories, reputation, rank: rank.title, next, fraction: next ? (reputation - rank.threshold) / (next.threshold - rank.threshold) : 1 };
}
