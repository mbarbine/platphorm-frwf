import { getMove, MOVES } from '../data/moves';
import { BALANCE } from '../data/balance';
import { distance, seededRandom } from '../utils/math';
import type { FighterDefinition, GameCommand, MatchModel } from '../types/game';

export interface AiDecision { command: GameCommand | null; move: { x: number; z: number }; run: boolean; nextSeed: number }

export const isActionLegal = (model: MatchModel, command: GameCommand, actorKey: 'player' | 'opponent'): boolean => {
  const actor = model[actorKey];
  const target = actorKey === 'player' ? model.opponent : model.player;
  if (model.paused || model.resolved || actor.state === 'pinned' || actor.state === 'pinning' || actor.state === 'defeated' || actor.state === 'victorious') return false;
  const targetDistance = distance(actor.position, target.position);
  if (command === 'block') return actor.stamina > 2 && ['idle', 'locomotion', 'blocking', 'staggered'].includes(actor.state);
  if (command === 'dodge') return actor.stamina >= 8 && ['idle', 'locomotion', 'climbing', 'staggered', 'grabbed'].includes(actor.state);
  if (command === 'taunt') return ['idle', 'locomotion'].includes(actor.state);
  if (command === 'interact') return model.ruleset === 'chaos' && ['idle', 'locomotion'].includes(actor.state);
  if (command === 'context') {
    if (actor.state === 'climbing') return ['staggered', 'downed'].includes(target.state) && targetDistance <= getMove('aerial').maximumRange;
    if (actor.momentum >= 100) return targetDistance <= getMove('finisher').maximumRange && ['staggered', 'downed'].includes(target.state);
    const nearCorner = Math.abs(actor.position.x) > 4.65 && Math.abs(actor.position.z) > 3.2;
    if (nearCorner && ['idle', 'locomotion'].includes(actor.state)) return true;
    const pinEligible = actorKey === 'player' || (model.elapsed >= BALANCE.ai.earliestPinSeconds && target.health <= BALANCE.ai.pinHealthThreshold);
    return pinEligible && target.state === 'downed' && targetDistance <= 1.6;
  }
  const move = command === 'quick' ? MOVES.jab : command === 'heavy' ? MOVES.heavy : MOVES.slam;
  if (!move) return false;
  return move.requiredActorStates.includes(actor.state) && actor.stamina >= move.staminaCost && (command !== 'grapple' || targetDistance <= move.maximumRange);
};

export const chooseAiDecision = (model: MatchModel, definition: FighterDefinition): AiDecision => {
  const actor = model.opponent;
  const target = model.player;
  const delta = { x: target.position.x - actor.position.x, z: target.position.z - actor.position.z };
  const separation = distance(actor.position, target.position);
  const magnitude = Math.max(.001, Math.hypot(delta.x, delta.z));
  const toward = { x: delta.x / magnitude, z: delta.z / magnitude };
  const [roll, nextSeed] = seededRandom(model.seed);
  const hard = model.difficulty === 'hard';
  const counterChance = hard ? .68 : .38;
  const incomingMajor = target.attackPhase === 'anticipation' && target.moveId !== 'jab' && separation < 2.2;
  if (incomingMajor && roll < counterChance && isActionLegal(model, 'dodge', 'opponent')) return { command: 'dodge', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (target.attackPhase === 'anticipation' && separation < 2.05 && roll < (hard ? .88 : .67) && isActionLegal(model, 'block', 'opponent')) return { command: 'block', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (actor.stamina < 24) return { command: separation < 2.5 ? 'dodge' : null, move: { x: -toward.x * .45, z: -toward.z * .45 }, run: false, nextSeed };
  if (target.state === 'downed' && separation < 1.7 && isActionLegal(model, 'context', 'opponent')) return { command: 'context', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (actor.momentum >= 100 && isActionLegal(model, 'context', 'opponent')) return { command: 'context', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (separation > 1.65) {
    const propBias = model.ruleset === 'chaos' && !actor.heldPropId && roll > .82;
    if (propBias && isActionLegal(model, 'interact', 'opponent')) return { command: 'interact', move: toward, run: false, nextSeed };
    return { command: null, move: toward, run: separation > 3.4, nextSeed };
  }
  const bias = definition.tendency;
  const command: GameCommand = target.state === 'downed'
    ? (roll > .55 ? 'quick' : 'context')
    : bias === 'technical' && roll < .5 ? 'grapple'
    : bias === 'opportunistic' && roll > .62 ? 'heavy'
    : roll < .48 ? 'quick' : roll < .75 ? 'grapple' : 'heavy';
  return { command: isActionLegal(model, command, 'opponent') ? command : 'quick', move: { x: 0, z: 0 }, run: false, nextSeed };
};
