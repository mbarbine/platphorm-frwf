import { VOLT_DOME } from './arena';
import type { MatchModel, PropRuntime } from '../types/game';

export type CombatVenue = 'dome' | 'yard' | 'backstage' | 'underground';
export const VENUES = {
  underground: { name: 'FRWF Underground', hasRing: false, halfWidth: 9, halfDepth: 7, floorY: VOLT_DOME.ring.deckY },
  dome: { name: 'Volt Dome', hasRing: true, halfWidth: VOLT_DOME.playable.halfWidth, halfDepth: VOLT_DOME.playable.halfDepth, floorY: VOLT_DOME.ring.deckY },
  yard: { name: 'Backyard Fight Pit', hasRing: false, halfWidth: 9, halfDepth: 7, floorY: VOLT_DOME.ring.deckY },
  backstage: { name: 'Backstage Fight Club', hasRing: false, halfWidth: 7, halfDepth: 6, floorY: VOLT_DOME.ring.deckY },
} as const;
export const venueFor = (model: Pick<MatchModel, 'venue'>) => VENUES[model.venue ?? 'dome'];
export function configureCombatVenue(model: MatchModel, venue: CombatVenue): void {
  model.venue = venue;
  if (venue === 'dome') return;
  const prop = (id: string, kind: PropRuntime['kind'], x: number, z: number, durability: number): PropRuntime => ({ id, kind, position: { x, z }, durability, stress: 0, failureStage: 'intact', heldBy: null, broken: false });
  model.props = [prop('table-1', 'table', 0, -3.6, 1)];
  if (model.ruleset === 'chaos') model.props.push(prop('chair-1', 'chair', -3.6, 1.8, 3), prop('trash-1', 'trash', 3.6, 2, 4), prop('chair-2', 'chair', 2.6, -.8, 3));
  model.propsById = Object.fromEntries(model.props.map(p => [p.id, p]));
  model.announcement = `${VENUES[venue].name.toUpperCase()} — WRESTLE!`;
}
