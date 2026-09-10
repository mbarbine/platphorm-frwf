import { FIGHTER_SLOTS, type MatchModel } from '../game/types/game';

/** Health describes current damage, not the probability of winning a wrestling match. */
export function matchStanding(model: MatchModel) {
  const health = Math.max(0, Math.ceil(model.player.health));
  const target = Math.max(0, Math.ceil(model[model.targets.player].health));
  const remaining = FIGHTER_SLOTS.filter(slot => model[slot].state !== 'defeated').length;
  const defeated = model.player.state === 'defeated';
  const won = model.resolved && model.result?.winner === 'player';
  const tone = won ? 'ahead' : defeated || health <= 30 ? 'danger' : health > target + 10 ? 'ahead' : health < target - 10 ? 'behind' : 'even';
  const label = won ? 'YOU WIN' : defeated ? 'YOU ARE OUT' : model.resolved ? 'YOU LOST' : health <= 30 ? 'LOW HEALTH' : tone === 'ahead' ? 'HEALTH ADVANTAGE' : tone === 'behind' ? 'HEALTH DISADVANTAGE' : 'EVEN HEALTH';
  const objective = model.matchMode === 'battle_royale' ? `${remaining} LEFT · LAST WRESTLER WINS` : 'PIN OR KNOCK OUT TO WIN';
  return { health, target, remaining, label, tone, objective };
}
