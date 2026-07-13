import { getMove, MOVES } from '../data/moves';
import { BALANCE } from '../data/balance';
import { distance, seededRandom } from '../utils/math';
import type { FighterDefinition, GameCommand, MatchModel } from '../types/game';

export interface AiDecision { command: GameCommand | null; move: { x: number; z: number }; run: boolean; nextSeed: number }

const grappleDirectionFor = (tendency: FighterDefinition['tendency'], roll: number): { x: number; z: number } => {
  if (tendency === 'aggressive') return roll < .65 ? { x: 0, z: -1 } : { x: 0, z: 1 };
  if (tendency === 'technical') return roll < .5 ? { x: -1, z: 0 } : { x: 0, z: 1 };
  return roll < .5 ? { x: 1, z: 0 } : { x: 0, z: -1 };
};

export const isActionLegal = (model: MatchModel, command: GameCommand, actorKey: 'player' | 'opponent'): boolean => {
  const actor = model[actorKey];
  const target = actorKey === 'player' ? model.opponent : model.player;
  if (model.paused || model.resolved || actor.state === 'pinned' || actor.state === 'pinning' || actor.state === 'defeated' || actor.state === 'victorious') return false;
  const targetDistance = distance(actor.position, target.position);
  if (command === 'block') return actor.stamina > 2 && ['idle', 'locomotion', 'blocking', 'staggered'].includes(actor.state);
  if (command === 'jump') return actor.stamina >= 8 && actor.body.verticalOffset <= .05 && ['idle', 'locomotion'].includes(actor.state);
  if (actor.state === 'grappling' && actor.attackPhase === 'anticipation' && ['quick', 'heavy', 'grapple'].includes(command)) return true;
  if (command === 'dodge') return actor.stamina >= 8 && ['idle', 'locomotion', 'climbing', 'staggered', 'grabbed'].includes(actor.state);
  if (command === 'taunt') return ['idle', 'locomotion'].includes(actor.state);
  if (command === 'interact') return model.ruleset === 'chaos' && ['idle', 'locomotion'].includes(actor.state);
  if (command === 'context') {
    if (actor.state === 'climbing') return !['defeated', 'victorious'].includes(target.state) && targetDistance <= getMove('aerial').maximumRange;
    if (actor.momentum >= 100) return targetDistance <= getMove('finisher').maximumRange && ['staggered', 'downed'].includes(target.state);
    const nearCorner = Math.abs(actor.position.x) > 4.35 && Math.abs(actor.position.z) > 2.95;
    if (nearCorner && ['idle', 'locomotion'].includes(actor.state)) return true;
    const pinEligible = actorKey === 'player' || (model.elapsed >= BALANCE.ai.earliestPinSeconds && target.health <= BALANCE.ai.pinHealthThreshold);
    if (pinEligible && target.state === 'downed' && targetDistance <= 1.6) return true;
    const nearApron = (Math.abs(actor.position.x) > 5.05 && Math.abs(actor.position.x) < 6.9 && Math.abs(actor.position.z) < 4.4)
      || (Math.abs(actor.position.z) > 3.55 && Math.abs(actor.position.z) < 5.6 && Math.abs(actor.position.x) < 5.9);
    return nearApron && ['idle', 'locomotion'].includes(actor.state);
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
  const personality = definition.personality;
  const actorRingside = Math.abs(actor.position.x) > 5.82 || Math.abs(actor.position.z) > 4.32;
  const targetInRing = Math.abs(target.position.x) <= 5.72 && Math.abs(target.position.z) <= 4.22;
  if (actorRingside && targetInRing && isActionLegal(model, 'context', 'opponent')) return { command: 'context', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (actor.state === 'grappling' && actor.attackPhase === 'anticipation') {
    if (actor.phaseElapsed > .12) return { command: null, move: { x: 0, z: 0 }, run: false, nextSeed };
    const command: GameCommand = roll < .34 ? 'quick' : roll < .7 ? 'heavy' : 'grapple';
    return { command, move: grappleDirectionFor(definition.tendency, roll), run: false, nextSeed };
  }
  const hard = model.difficulty === 'hard';
  const counterChance = clampChance((hard ? .58 : .3) + personality.technical * .24 + personality.athletic * .08);
  const incomingMajor = target.attackPhase === 'anticipation' && target.moveId !== 'jab' && separation < 2.2;
  if (incomingMajor && roll < counterChance && isActionLegal(model, 'dodge', 'opponent')) return { command: 'dodge', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (target.attackPhase === 'anticipation' && separation < 2.05 && roll < (hard ? .88 : .67) && isActionLegal(model, 'block', 'opponent')) return { command: 'block', move: { x: 0, z: 0 }, run: false, nextSeed };
  const physicallyCompromised = actor.stamina < 24 || actor.body.balance < 34 || actor.body.muscle < .36;
  if (physicallyCompromised) {
    if (actor.stamina < 18) return { command: null, move: separation < 2.6 ? { x: -toward.x * .72, z: -toward.z * .72 } : { x: 0, z: 0 }, run: false, nextSeed };
    const guard = separation < 2.25 && isActionLegal(model, 'block', 'opponent') && roll < .48;
    return { command: guard ? 'block' : separation < 1.5 && isActionLegal(model, 'dodge', 'opponent') ? 'dodge' : null, move: { x: -toward.x * .55, z: -toward.z * .55 }, run: false, nextSeed };
  }
  if (target.state === 'downed' && separation < 1.7 && isActionLegal(model, 'context', 'opponent')) return { command: 'context', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (actor.momentum >= 100 && isActionLegal(model, 'context', 'opponent')) return { command: 'context', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (separation > 1.65) {
    if (separation > 3.1 && actor.health > 48 && roll < personality.showman * .13 && isActionLegal(model, 'taunt', 'opponent')) return { command: 'taunt', move: { x: 0, z: 0 }, run: false, nextSeed };
    const propBias = model.ruleset === 'chaos' && !actor.heldPropId && roll > .92 - personality.dirty * .16 - personality.reckless * .08;
    if (propBias && isActionLegal(model, 'interact', 'opponent')) return { command: 'interact', move: toward, run: false, nextSeed };
    return { command: null, move: toward, run: separation > 3.4, nextSeed };
  }
  const bias = definition.tendency;
  const grappleThreshold = clampChance(.31 + personality.technical * .25 + personality.powerhouse * .16);
  const heavyThreshold = clampChance(.7 - personality.aggressive * .12 - personality.reckless * .1);
  const command: GameCommand = target.state === 'downed'
    ? (roll > .55 ? 'quick' : 'context')
    : bias === 'technical' && roll < grappleThreshold + .16 ? 'grapple'
    : bias === 'opportunistic' && roll > heavyThreshold ? 'heavy'
    : roll < .4 ? 'quick' : roll < .4 + grappleThreshold ? 'grapple' : 'heavy';
  const legal = isActionLegal(model, command, 'opponent') ? command : 'quick';
  return { command: legal, move: legal === 'grapple' ? grappleDirectionFor(definition.tendency, roll) : { x: 0, z: 0 }, run: false, nextSeed };
};

function clampChance(value: number): number { return Math.max(.05, Math.min(.95, value)); }
