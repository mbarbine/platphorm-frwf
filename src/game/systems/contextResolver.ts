import { getMove } from '../data/moves';
import { BALANCE } from '../data/balance';
import type { FighterSlot, MatchModel, Vec2 } from '../types/game';
import { distance } from '../utils/math';

export type ContextActionId =
  | 'kickout'
  | 'finisher'
  | 'pin'
  | 'top_rope_aerial'
  | 'corner_move'
  | 'environmental_wrestling_move'
  | 'turnbuckle_climb'
  | 'ring_traversal'
  | 'stand_opponent'
  | 'drag_opponent'
  | 'ordinary_contextual_action';

export type PropActionId = 'swing_held_prop' | 'throw_held_prop' | 'drop_held_prop' | 'pick_up_prop' | 'reposition_prop';

export interface ResolvedContextAction {
  actionId: ContextActionId | PropActionId;
  displayName: string;
  target: string | null;
  reason: string;
  priority: number;
  legalState: boolean;
  rejectionReason: string | null;
}

const resolved = (actionId: ResolvedContextAction['actionId'], displayName: string, target: string | null, reason: string, priority: number): ResolvedContextAction => ({
  actionId, displayName, target, reason, priority, legalState: true, rejectionReason: null,
});

const rejected = (actionId: ResolvedContextAction['actionId'], displayName: string, reason: string, priority: number): ResolvedContextAction => ({
  actionId, displayName, target: null, reason, priority, legalState: false, rejectionReason: reason,
});

export const canTraverseRopes = (position: Vec2): boolean => {
  const x = Math.abs(position.x); const z = Math.abs(position.z);
  return (x > 4.62 && x < 6.9 && z < 3.55) || (z > 3.05 && z < 5.6 && x < 5.15);
};

const pinAlreadyActive = (model: MatchModel): boolean => (['player', 'opponent', 'rival1', 'rival2', 'rival3'] as const)
  .some((slot) => model[slot].state === 'pinning' || model[slot].state === 'pinned');

export const resolveContextAction = (model: MatchModel, actorKey: FighterSlot, direction: Vec2 = { x: 0, z: 0 }): ResolvedContextAction => {
  const actor = model[actorKey]; const targetKey = model.targets[actorKey]; const target = model[targetKey]; const separation = distance(actor.position, target.position);
  if (model.paused) return rejected('ordinary_contextual_action', 'NO ACTION', 'Match is paused', 11);
  if (model.resolved || ['defeated', 'victorious'].includes(actor.state)) return rejected('ordinary_contextual_action', 'NO ACTION', 'Fighter is no longer active', 11);

  // F1 — kickout always outranks every environmental or traversal option.
  if (actor.state === 'pinned') return resolved('kickout', 'KICK OUT', targetKey, 'Shoulders are down', 1);

  // F2 — finisher outranks pin and every location-driven action.
  if (actor.momentum >= 100 && !model.grapple && ['staggered', 'downed'].includes(target.state) && separation <= getMove('finisher').maximumRange) {
    return resolved('finisher', getMove('finisher').displayName.toUpperCase(), targetKey, 'Momentum full and target vulnerable', 2);
  }

  // F3 — pin outranks climbing and exiting the ring.
  const pinEligible = actorKey === 'player' || (model.elapsed >= BALANCE.ai.earliestPinSeconds && target.health <= BALANCE.ai.pinHealthThreshold);
  if (pinEligible && !pinAlreadyActive(model) && target.state === 'downed' && separation <= 1.7) {
    return resolved('pin', 'PIN SHOULDERS', targetKey, 'Downed target is in pin range', 3);
  }

  // F4 — a wrestler already on top resolves the aerial before any corner/traversal branch.
  if (actor.state === 'climbing' && actor.climbStage === 3 && separation <= getMove('aerial').maximumRange && !['defeated', 'victorious'].includes(target.state)) {
    return resolved('top_rope_aerial', getMove('aerial').displayName.toUpperCase(), targetKey, 'Top-rope target is in aerial range', 4);
  }

  const cornerX = Math.sign(target.position.x || actor.position.x || 1) * 5.35; const cornerZ = Math.sign(target.position.z || actor.position.z || 1) * 3.85;
  const targetCornerDistance = Math.hypot(target.position.x - cornerX, target.position.z - cornerZ);
  if (actor.state === 'grappling' && actor.attackPhase === 'anticipation' && model.grapple?.attacker === actorKey && targetCornerDistance <= 3.15) {
    return resolved('corner_move', getMove('corner_smash').displayName.toUpperCase(), targetKey, 'Secured clinch is inside the corner-call lane', 5);
  }

  const table = model.props.find((prop) => prop.kind === 'table' && !prop.broken);
  const tableDistance = table ? distance(target.position, table.position) : Number.POSITIVE_INFINITY;
  if (actor.state === 'grappling' && actor.attackPhase === 'anticipation' && model.grapple?.attacker === actorKey && table && tableDistance <= 2.6) {
    return resolved('environmental_wrestling_move', 'COMMENTARY DESK SPOT', table.id, 'Secured clinch is aligned with the commentary desk', 6);
  }

  if (actor.state === 'climbing' && actor.climbStage < 3) {
    return resolved('turnbuckle_climb', actor.climbStage === 1 ? 'CLIMB MIDDLE ROPE' : 'CLIMB TOP ROPE', 'turnbuckle', 'Continue the active staged climb', 7);
  }
  const nearCorner = Math.abs(actor.position.x) > 4.35 && Math.abs(actor.position.z) > 2.95;
  if (nearCorner && ['idle', 'locomotion'].includes(actor.state)) {
    return resolved('turnbuckle_climb', 'CLIMB LOWER ROPE', 'turnbuckle', 'Standing inside the turnbuckle climb lane', 7);
  }

  if (canTraverseRopes(actor.position) && ['idle', 'locomotion'].includes(actor.state) && !model.grapple) {
    const ringside = Math.abs(actor.position.x) > 5.82 || Math.abs(actor.position.z) > 4.32;
    return resolved('ring_traversal', ringside ? 'ENTER RING' : 'EXIT RING', 'center_rope', ringside ? 'Ringside at a supported center-rope lane' : 'Inside at a supported center-rope lane', 8);
  }

  if (target.state === 'downed' && separation <= 1.7) {
    const directional = Math.hypot(direction.x, direction.z) >= .35;
    return rejected(directional ? 'drag_opponent' : 'stand_opponent', directional ? 'DRAG OPPONENT' : 'STAND OPPONENT', directional ? 'Opponent dragging is not implemented yet' : 'Standing an opponent is not implemented yet', directional ? 10 : 9);
  }
  return rejected('ordinary_contextual_action', 'NO CONTEXT ACTION', 'No legal contextual action is in range', 11);
};

export const resolvePropAction = (model: MatchModel, actorKey: FighterSlot, direction: Vec2 = { x: 0, z: 0 }): ResolvedContextAction => {
  const actor = model[actorKey]; const targetKey = model.targets[actorKey]; const target = model[targetKey];
  if (model.ruleset !== 'chaos') return rejected('reposition_prop', 'NO PROP ACTION', 'Props require Chaos Circuit rules', 5);
  if (model.paused || model.resolved || !['idle', 'locomotion'].includes(actor.state)) return rejected('reposition_prop', 'NO PROP ACTION', 'Fighter cannot use a prop in the current state', 5);
  if (actor.heldPropId) {
    if (distance(actor.position, target.position) <= 2.3 && actor.stamina >= getMove('prop').staminaCost) {
      return resolved('swing_held_prop', getMove('prop').displayName.toUpperCase(), targetKey, 'Held prop and target are in swing range', 1);
    }
    if (Math.hypot(direction.x, direction.z) >= .35 && actor.stamina >= getMove('prop_throw').staminaCost) {
      return resolved('throw_held_prop', getMove('prop_throw').displayName.toUpperCase(), targetKey, 'Held prop has a deliberate throw direction', 2);
    }
    return resolved('drop_held_prop', 'DROP PROP', actor.heldPropId, 'Held prop has no legal swing target or throw modifier', 3);
  }
  const prop = model.props
    .filter((candidate) => !candidate.broken && !candidate.heldBy && candidate.kind !== 'table')
    .sort((left, right) => distance(actor.position, left.position) - distance(actor.position, right.position))[0];
  if (prop && distance(actor.position, prop.position) <= 2.2) return resolved('pick_up_prop', `PICK UP ${prop.kind.toUpperCase()}`, prop.id, 'Nearest eligible prop is in pickup range', 4);
  const supported = model.props.find((candidate) => candidate.kind === 'table' && !candidate.broken && distance(actor.position, candidate.position) <= 1.8);
  if (supported) return rejected('reposition_prop', 'REPOSITION TABLE', 'Supported prop repositioning is not implemented yet', 5);
  return rejected('pick_up_prop', 'NO PROP IN RANGE', 'No eligible prop is within pickup range', 4);
};
