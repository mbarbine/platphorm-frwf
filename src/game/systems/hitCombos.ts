import type { FighterRuntime, FighterSlot, MoveDefinition } from '../types/game';

export type StrikeInput = 'quick' | 'heavy';
export const COMBO_LINK_SECONDS = 1.60;
export const COMBO_MAX_HITS = 6;
export const COMBO_RECOVERY_SECONDS = .060;

/** Recipes describe confirmed strikes, never buffered button presses. */
export const HIT_COMBOS = [
  { inputs: 'PPPPPP', name: 'SIX PACK', finish: 'uppercut' },
  { inputs: 'PPK', name: 'ONE-TWO BOOT', finish: 'front_kick' },
  { inputs: 'PKPP', name: 'RIB RATTLE', finish: 'side_kick' },
  { inputs: 'PKPK', name: 'CIRCUIT BREAKER', finish: 'roundhouse' },
  { inputs: 'KPPK', name: 'LOW TO HIGH', finish: 'high_kick' },
  { inputs: 'PPPPK', name: 'FIVE STAR', finish: 'spin_side_kick' },
  { inputs: 'PPPK', name: 'FLASH SUPERKICK', finish: 'superkick' },
  { inputs: 'KPK', name: 'CYCLONE COMBO', finish: 'question_mark_kick' },
  { inputs: 'PKK', name: 'AXE DROP', finish: 'axe_kick' },
  { inputs: 'KKP', name: 'ENZUIGIRI RUSH', finish: 'hook_kick' },
  { inputs: 'KKKK', name: 'BICYCLE SPLIT', finish: 'jumping_knee' },
  { inputs: 'KPPP', name: 'PRISM DRIVE', finish: 'sweep_kick' },
  { inputs: 'KKKP', name: 'HALO OVERHEAD', finish: 'overhead_kick' },
] as const;

const HIT_COMBO_MAP = new Map<string, typeof HIT_COMBOS[number]>(HIT_COMBOS.map(combo => [combo.inputs, combo]));

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
  const recipe = HIT_COMBO_MAP.get(code);
  if (recipe) return recipe.finish;
  if (input === 'heavy') return inputs.length ? 'low_kick' : null;
  // Build a readable boxing cadence from distinct authored moves. A clean
  // straight jab sets up the cross; alternating hooks turn the opponent before
  // the rising uppercut closes the six-hit chain.
  if (inputs.length === 0) return 'jab';
  if (inputs.length === 1) return 'combo';
  if (inputs.length === 2) return 'high_punch';
  if (inputs.length === 3) return 'left_hook';
  if (inputs.length === 4) return 'right_hook';
  return 'uppercut';
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
  actor.comboName = HIT_COMBO_MAP.get(comboCode(actor.comboInputs))?.name ?? null;
}

/** Only a clean hit can shorten recovery; whiffs, blocks and finishers commit. */
export function canLinkStrike(actor: FighterRuntime, move: MoveDefinition): boolean {
  return actor.state === 'attacking' && actor.attackPhase === 'recovery'
    && actor.comboStep > 0 && !actor.comboName && actor.comboStep < COMBO_MAX_HITS
    && actor.comboAttackId === actor.attackInstanceId && ['quick', 'heavy'].includes(move.category)
    && actor.phaseElapsed >= move.anticipationDuration + move.activeDuration + COMBO_RECOVERY_SECONDS;
}
