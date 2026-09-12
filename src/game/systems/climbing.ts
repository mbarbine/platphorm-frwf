import { VOLT_DOME } from '../data/arena';
import { venueFor } from '../data/venues';
import type { FighterRuntime, MatchModel } from '../types/game';

export function cornerClimbAvailable(actor: FighterRuntime): boolean {
  const x = Math.abs(actor.position.x), z = Math.abs(actor.position.z);
  return x >= 4.35 && x <= 5.75 && z >= 2.95 && z <= 4.25;
}

/** The same surface dimensions are used by the visible table and its landing collider. */
export function objectClimbTarget(model: MatchModel, id: string) {
  const prop = model.propsById[id];
  if (!prop || prop.kind !== 'table' || prop.broken) return null;
  const topY = venueFor(model).hasRing ? VOLT_DOME.commentaryTable.topY : venueFor(model).floorY + .965;
  return { x: prop.position.x, z: prop.position.z, topY };
}

export function nearbyClimbableObject(model: MatchModel, actor: FighterRuntime): string | null {
  if (actor.heldPropId) return null;
  for (const prop of model.props) {
    const target = objectClimbTarget(model, prop.id);
    if (!target) continue;
    const dx = Math.max(0, Math.abs(actor.position.x - target.x) - 1.5);
    const dz = Math.max(0, Math.abs(actor.position.z - target.z) - .65);
    if (Math.hypot(dx, dz) <= .85 && (!venueFor(model).hasRing || Math.abs(actor.position.x) > 5.8 || Math.abs(actor.position.z) > 4.3)) return prop.id;
  }
  return null;
}

/** Velocity motor must overcome gravity at every fixed step before driving upward. */
export function climbVerticalDelta(error: number, velocityY: number, dt: number): number {
  const desired = Math.max(-2.5, Math.min(2.5, error * 5));
  return Math.max(-42 * dt, Math.min(42 * dt, desired - velocityY + 18 * dt));
}
