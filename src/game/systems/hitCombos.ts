import type { FighterRuntime, FighterSlot, MoveDefinition } from '../types/game';
import { WRESTLING_STYLES } from '../data/wrestlingStyles';

export type StrikeInput = 'quick' | 'heavy';
export const COMBO_LINK_SECONDS = 1.45;
export const COMBO_MAX_HITS = 6;
export const COMBO_RECOVERY_SECONDS = .075;

/** Recipes describe confirmed strikes, never buffered button presses. */
export const HIT_COMBOS = [
  { inputs: 'PPPPPP', name: 'SIX PACK', finish: 'uppercut' },
  { inputs: 'PPK', name: 'ONE-TWO BOOT', finish: 'front_kick' },
  { inputs: 'PKPP', name: 'RIB RATTLE', finish: 'heavy' },
  { inputs: 'PKPK', name: 'CIRCUIT BREAKER', finish: 'roundhouse' },
  { inputs: 'KPPK', name: 'LOW TO HIGH', finish: 'high_kick' },
  { inputs: 'PPPPK', name: 'FIVE STAR', finish: 'roundhouse' },
] as const;

export function comboCode(inputs: readonly StrikeInput[]): string {
  return inputs.map(input => input === 'quick' ? 'P' : 'K').join('');
}

export function clearHitCombo(actor: FighterRuntime): void {
  actor.comboStep = 0; actor.comboInputs = []; actor.comboTarget = null;
  actor.comboExpiresAt = 0; actor.comboAttackId = -1; actor.comboName = null;
}

export function expireHitCombo(actor: FighterRuntime, now: number, target: FighterSlot): void {
  if (actor.comboStep && (now > actor.comboExpiresAt || actor.comboTarget !== target)) clearHitCombo(actor);
}

export function comboStrike(actor: FighterRuntime, input: StrikeInput): string | null {
  const inputs = actor.comboStep >= COMBO_MAX_HITS || actor.comboName ? [] : actor.comboInputs;
  const code = comboCode([...inputs, input]);
  const recipe = HIT_COMBOS.find(combo => combo.inputs === code);
  if (recipe) return recipe.finish;
  if (input === 'heavy') return inputs.length ? 'low_kick' : null;
  // Alternate arms between each character's distinctive opening and finisher.
  if (inputs.length === 0) return 'jab';
  if (inputs.length === 1) return 'combo';
  if (inputs.length === 2) return inputs.includes('heavy') ? 'high_punch' : WRESTLING_STYLES[actor.definitionId].chain[1] ?? 'high_punch';
  if (inputs.length === 3) return 'combo';
  return 'heavy';
}

export function confirmComboHit(actor: FighterRuntime, target: FighterSlot, now: number, move: MoveDefinition): void {
  if (!actor.strikeInput || !['quick', 'heavy'].includes(move.category)) return;
  if (actor.comboAttackId === actor.attackInstanceId) return;
  expireHitCombo(actor, now, target);
  if (actor.comboStep >= COMBO_MAX_HITS || actor.comboName) clearHitCombo(actor);
  actor.comboInputs = [...actor.comboInputs, actor.strikeInput];
  actor.comboStep = actor.comboInputs.length;
  actor.comboTarget = target; actor.comboExpiresAt = now + COMBO_LINK_SECONDS;
  actor.comboAttackId = actor.attackInstanceId;
  actor.comboName = HIT_COMBOS.find(combo => combo.inputs === comboCode(actor.comboInputs))?.name ?? null;
}

/** Only a clean hit can shorten recovery; whiffs, blocks and finishers commit. */
export function canLinkStrike(actor: FighterRuntime, move: MoveDefinition): boolean {
  return actor.state === 'attacking' && actor.attackPhase === 'recovery'
    && actor.comboStep > 0 && !actor.comboName && actor.comboStep < COMBO_MAX_HITS
    && actor.comboAttackId === actor.attackInstanceId && ['quick', 'heavy'].includes(move.category)
    && actor.phaseElapsed >= move.anticipationDuration + move.activeDuration + COMBO_RECOVERY_SECONDS;
}
