import { FALL_REASONS } from '../types/game';
import type { FallReason, FighterSlot, MatchModel } from '../types/game';

const FALL_STATES = new Set(['airborne', 'downed']);
const RECOVERY_STATES = new Set(['recovering', 'pinned']);

/** Starts one bounded, auditable fall episode. State changes remain owned by combat/physics. */
export const beginFall = (model: MatchModel, fighterSlot: FighterSlot, reason: FallReason): void => {
  const fighter = model[fighterSlot];
  if (fighter.fallReason !== null && (FALL_STATES.has(fighter.state) || RECOVERY_STATES.has(fighter.state))) return;
  model.fallSequence += 1;
  fighter.fallReason = reason;
  fighter.lastFallReason = reason;
  fighter.fallSequence = model.fallSequence;
  const state = fighter.state === 'airborne' ? 'airborne' : 'downed';
  model.falls.push({ sequence: model.fallSequence, fighter: fighterSlot, reason, time: model.elapsed, state });
  if (model.falls.length > 128) model.falls.splice(0, model.falls.length - 128);
};

/** Audits every fixed-step fall and clears only after the wrestler regains a stable state. */
export const auditFallState = (model: MatchModel, fighterSlot: FighterSlot, dt: number): void => {
  const fighter = model[fighterSlot];
  if (FALL_STATES.has(fighter.state) && fighter.fallReason === null) beginFall(model, fighterSlot, FALL_REASONS.Unknown);
  if (FALL_STATES.has(fighter.state) && fighter.fallReason === FALL_REASONS.Unknown) model.unstableWithoutCauseSeconds += dt;
  if (!FALL_STATES.has(fighter.state) && !RECOVERY_STATES.has(fighter.state)) fighter.fallReason = null;
};

export const fallCount = (model: MatchModel, ...reasons: readonly FallReason[]): number => (
  model.falls.filter((event) => reasons.includes(event.reason)).length
);
