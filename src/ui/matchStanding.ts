import { FIGHTER_SLOTS, type MatchModel } from '../game/types/game';

/** Actual health and eliminations; this is not a win probability. */
export function matchStanding(model: MatchModel) {
  const health = Math.ceil(model.player.health);
  const target = Math.ceil(model[model.targets.player].health);
  const remaining = FIGHTER_SLOTS.filter(slot => model[slot].state !== 'defeated').length;
  const defeated = model.player.state === 'defeated';
  const tone = defeated || health <= 30 ? 'danger' : health > target + 10 ? 'ahead' : health < target - 10 ? 'behind' : 'even';
  const label = defeated ? 'YOU ARE OUT' : model.resolved && model.winner === 'player' ? 'YOU WIN' : health <= 30 ? 'LOW HEALTH · DEFEND & RECOVER' : model.matchMode === 'battle_royale' ? `${remaining} WRESTLERS LEFT` : tone === 'ahead' ? 'HEALTH ADVANTAGE' : tone === 'behind' ? 'HEALTH DISADVANTAGE' : 'EVEN HEALTH';
  const impact = model.lastImpact;
  const recent = impact && model.elapsed - impact.time < 1.2;
  const feedback = recent && impact.targetFighter === 'player' ? 'YOU TOOK A HIT' : recent && impact.sourceFighter === 'player' ? impact.kind === 'blocked' ? 'OPPONENT BLOCKED' : 'YOUR HIT CONNECTED' : '';
  return { health, target, remaining, label, tone, feedback };
}
