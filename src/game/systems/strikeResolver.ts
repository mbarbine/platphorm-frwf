import { getMove } from '../data/moves';
import { venueFor } from '../data/venues';
import { isRingside } from '../physics/ringDynamics';
import type { FighterRuntime, FighterSlot, MatchModel, Vec2 } from '../types/game';
import { distance } from '../utils/math';
import { combatDirection, selectDirectionalStrike, type StrikeButton } from './moveSelection';
import { resolvePropAction } from './contextResolver';

/** The same selection drives execution and every button label. */
export function situationalStrike(actor: FighterRuntime, target: FighterRuntime, button: StrikeButton, direction: Vec2 = { x: 0, z: 0 }, running = false): string {
  if (button === 'quick' && actor.heldPropId) return 'prop';
  if (target.state === 'downed' && distance(actor.position, target.position) <= 1.8) return button === 'heavy' ? 'ground' : 'ground_punch';
  if (button === 'heavy') {
    if (actor.heldPropId) return 'prop';
    if (actor.ropeRebound > 0 || running && Math.hypot(actor.velocity.x, actor.velocity.z) > 3.6) return combatDirection(direction) === 'left' ? 'rebound' : 'stiff_arm';
    if (combatDirection(direction) === 'neutral') {
      const gap = distance(actor.position, target.position);
      if (gap < 1.05 || actor.stamina < getMove('front_kick').staminaCost) return 'low_kick';
      if (target.state === 'staggered' && gap > 1.35 && actor.stamina >= getMove('high_kick').staminaCost) return 'high_kick';
    }
  }
  return selectDirectionalStrike(direction, button, actor.comboStep);
}

/** A brief reachable interception, not a remote or permanently held counter. */
export function reversalAvailable(defender: FighterRuntime, attacker: FighterRuntime, rushingOnly = false): boolean {
  if (!['idle', 'locomotion', 'blocking', 'grabbed', 'staggered'].includes(defender.state) || defender.stamina < 10 || !attacker.moveId) return false;
  const gap = distance(defender.position, attacker.position);
  if (gap > 2.1 || gap < .05) return false;
  const dx = (attacker.position.x - defender.position.x) / gap; const dz = (attacker.position.z - defender.position.z) / gap;
  if (Math.sin(defender.facing) * dx + Math.cos(defender.facing) * dz < .35) return false;
  const closing = -(attacker.velocity.x * dx + attacker.velocity.z * dz);
  if (rushingOnly && (closing < 2.6 || !['stiff_arm', 'rebound', 'spear'].includes(attacker.moveId))) return false;
  const incoming = getMove(attacker.moveId);
  const window = incoming.counterWindow;
  return Boolean(window && attacker.attackPhase === 'anticipation' && attacker.phaseElapsed >= window[0] && attacker.phaseElapsed <= window[1]);
}

export function quickPickup(model: MatchModel, actorKey: FighterSlot): string | null {
  const actor = model[actorKey];
  if (actor.heldPropId) return null;
  const action = resolvePropAction(model, actorKey);
  if (!action.legalState || action.actionId !== 'pick_up_prop' || !action.target) return null;
  const prop = model.propsById[action.target];
  if (!prop || distance(actor.position, prop.position) > 1.3) return null;
  if (venueFor(model).hasRing && isRingside(actor.position) !== isRingside(prop.position)) return null;
  // A foe already in fist range takes precedence over an incidental nearby chair.
  const target = model[model.targets[actorKey]];
  if (!['downed', 'defeated', 'victorious'].includes(target.state) && distance(actor.position, target.position) < 1.25) return null;
  return action.displayName;
}
