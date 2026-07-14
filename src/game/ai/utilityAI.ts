import { getMove, MOVES } from '../data/moves';
import { BALANCE } from '../data/balance';
import { distance, seededRandom } from '../utils/math';
import type { FighterDefinition, GameCommand, MatchModel } from '../types/game';

export interface AiDecision { command: GameCommand | null; move: { x: number; z: number }; run: boolean; nextSeed: number }

const grappleDirectionFor = (tendency: FighterDefinition['tendency'], roll: number): { x: number; z: number } => {
  // 22% chance for neutral piledriver on any grapple command
  if (roll < .22) return { x: 0, z: 0 };
  const r = (roll - .22) / .78;
  if (tendency === 'aggressive') return r < .65 ? { x: 0, z: -1 } : { x: 0, z: 1 };
  if (tendency === 'technical') return r < .5 ? { x: -1, z: 0 } : { x: 0, z: 1 };
  return r < .5 ? { x: 1, z: 0 } : { x: 0, z: -1 };
};

const strikeDirectionFor = (command: 'quick' | 'heavy', tendency: FighterDefinition['tendency'], roll: number, stamina: number): { x: number; z: number } => {
  if (command === 'quick') {
    if (stamina < 8) return { x: 0, z: 0 };
    if (roll < .28) return { x: 0, z: 0 };    // neutral jab
    if (roll < .56) return { x: 0, z: -1 };   // high punch
    if (roll < .78) return { x: 0, z: 1 };    // low kick
    return { x: tendency === 'aggressive' ? -1 : 1, z: 0 }; // side combo
  }
  if (tendency === 'aggressive' && stamina >= 19 && roll < .48) return { x: -1, z: 0 }; // roundhouse
  if (tendency === 'technical') return roll < .45 ? { x: 0, z: -1 } : { x: 1, z: 0 }; // uppercut or high kick
  if (roll < .38) return { x: 0, z: 1 }; // front kick
  return { x: 1, z: 0 }; // high kick
};

export const isActionLegal = (model: MatchModel, command: GameCommand, actorKey: 'player' | 'opponent'): boolean => {
  const actor = model[actorKey];
  const target = actorKey === 'player' ? model.opponent : model.player;
  if (model.paused || model.resolved || actor.state === 'pinned' || actor.state === 'pinning' || actor.state === 'defeated' || actor.state === 'victorious') return false;
  const targetDistance = distance(actor.position, target.position);
  if (command === 'block') return actor.stamina > 2 && ['idle', 'locomotion', 'blocking', 'staggered'].includes(actor.state);
  if (command === 'jump') return actor.stamina >= 8 && actor.body.verticalOffset <= .32 && ['idle', 'locomotion'].includes(actor.state);
  if (actor.state === 'grappling' && actor.attackPhase === 'anticipation' && ['quick', 'heavy', 'grapple'].includes(command)) return true;
  if (actor.state === 'grappling' && actor.attackPhase === 'anticipation' && command === 'context') {
    const cornerX = Math.sign(target.position.x || actor.position.x || 1) * 5.35; const cornerZ = Math.sign(target.position.z || actor.position.z || 1) * 3.85;
    return Math.hypot(target.position.x - cornerX, target.position.z - cornerZ) <= 3.15;
  }
  if (actor.state === 'climbing' && actor.climbStage === 3 && (command === 'quick' || command === 'heavy')) {
    const move = command === 'quick' ? MOVES.aerial_elbow : MOVES.aerial_kick;
    return Boolean(move && actor.stamina >= move.staminaCost && targetDistance <= move.maximumRange && !['defeated', 'victorious'].includes(target.state));
  }
  if (command === 'dodge') return actor.stamina >= (actor.state === 'downed' ? 12 : 8) && ['idle', 'locomotion', 'climbing', 'staggered', 'grabbed', 'downed'].includes(actor.state);
  if (command === 'taunt') return ['idle', 'locomotion', 'climbing'].includes(actor.state);
  if (command === 'interact') return model.ruleset === 'chaos' && ['idle', 'locomotion'].includes(actor.state);
  if (command === 'context') {
    if (actor.state === 'climbing') return actor.climbStage < 3 || (!['defeated', 'victorious'].includes(target.state) && targetDistance <= getMove('aerial').maximumRange);
    if (actor.momentum >= 100) return targetDistance <= getMove('finisher').maximumRange && ['staggered', 'downed'].includes(target.state);
    const pinEligible = actorKey === 'player' || (model.elapsed >= BALANCE.ai.earliestPinSeconds && target.health <= BALANCE.ai.pinHealthThreshold);
    if (pinEligible && target.state === 'downed' && targetDistance <= 1.6) return true;
    const nearCorner = Math.abs(actor.position.x) > 4.35 && Math.abs(actor.position.z) > 2.95;
    if (nearCorner && ['idle', 'locomotion'].includes(actor.state)) return true;
    const nearApron = (Math.abs(actor.position.x) > 4.62 && Math.abs(actor.position.x) < 6.9 && Math.abs(actor.position.z) < 3.55)
      || (Math.abs(actor.position.z) > 3.05 && Math.abs(actor.position.z) < 5.6 && Math.abs(actor.position.x) < 5.15);
    return nearApron && ['idle', 'locomotion'].includes(actor.state);
  }
  const move = command === 'quick' ? target.state === 'downed' ? MOVES.ground : MOVES.jab : command === 'heavy' ? actor.ropeRebound > 0 ? MOVES.stiff_arm : MOVES.heavy : MOVES.slam;
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
  if (actor.state === 'downed') return { command: isActionLegal(model, 'dodge', 'opponent') && roll < (model.difficulty === 'hard' ? .72 : .48) ? 'dodge' : null, move: { x: 0, z: 0 }, run: false, nextSeed };
  if (actor.state === 'climbing') {
    if (actor.climbStage < 3) return { command: 'context', move: { x: 0, z: 0 }, run: false, nextSeed };
    const aerialCommand: GameCommand = roll < .4 ? 'quick' : roll < .78 ? 'heavy' : 'context';
    const legalAerial = isActionLegal(model, aerialCommand, 'opponent') ? aerialCommand : isActionLegal(model, 'context', 'opponent') ? 'context' : null;
    return { command: legalAerial, move: toward, run: false, nextSeed };
  }
  if (actorRingside && targetInRing && isActionLegal(model, 'context', 'opponent')) return { command: 'context', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (actor.state === 'grappling' && actor.attackPhase === 'anticipation') {
    if (actor.phaseElapsed > .12) return { command: null, move: { x: 0, z: 0 }, run: false, nextSeed };
    // Corner smash when opponent near corner
    if (isActionLegal(model, 'context', 'opponent') && roll < .32) return { command: 'context', move: { x: 0, z: 0 }, run: false, nextSeed };
    const command: GameCommand = roll < .32 ? 'quick' : roll < .68 ? 'heavy' : 'grapple';
    return { command, move: grappleDirectionFor(definition.tendency, roll), run: false, nextSeed };
  }
  const hard = model.difficulty === 'hard';
  const counterChance = clampChance((hard ? .58 : .3) + personality.technical * .24 + personality.athletic * .08);
  const incomingMajor = target.attackPhase === 'anticipation' && target.moveId !== 'jab' && separation < 2.2;
  if (incomingMajor && roll < counterChance && isActionLegal(model, 'dodge', 'opponent')) return { command: 'dodge', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (target.attackPhase === 'anticipation' && separation < 2.05 && roll < (hard ? .88 : .67) && isActionLegal(model, 'block', 'opponent')) return { command: 'block', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (actor.heldPropId && separation <= 2.2 && isActionLegal(model, 'heavy', 'opponent')) return { command: 'heavy', move: { x: 0, z: 0 }, run: false, nextSeed };
  if (actor.ropeRebound > 0 && separation <= 2.4 && isActionLegal(model, 'heavy', 'opponent')) return { command: 'heavy', move: toward, run: true, nextSeed };
  const physicallyCompromised = actor.stamina < 24 || actor.body.balance < 34 || actor.body.muscle < .36;
  if (physicallyCompromised) {
    if (actor.stamina < 18) return { command: null, move: separation < 2.6 ? { x: -toward.x * .72, z: -toward.z * .72 } : { x: 0, z: 0 }, run: false, nextSeed };
    const guard = separation < 2.25 && isActionLegal(model, 'block', 'opponent') && roll < .48;
    return { command: guard ? 'block' : separation < 1.5 && isActionLegal(model, 'dodge', 'opponent') ? 'dodge' : null, move: { x: -toward.x * .55, z: -toward.z * .55 }, run: false, nextSeed };
  }
  const propTarget = model.ruleset === 'chaos' && !actor.heldPropId
    ? model.props.filter((prop) => !prop.broken && !prop.heldBy && prop.kind !== 'table').sort((a, b) => distance(actor.position, a.position) - distance(actor.position, b.position))[0]
    : undefined;
  const pursuesProp = propTarget && model.elapsed > 6 && (actor.health < 98 || model.elapsed > 10 || personality.dirty > .62);
  if (propTarget && pursuesProp) {
    const propDistance = distance(actor.position, propTarget.position); const propDelta = { x: propTarget.position.x - actor.position.x, z: propTarget.position.z - actor.position.z }; const propMagnitude = Math.max(.001, Math.hypot(propDelta.x, propDelta.z));
    const towardProp = { x: propDelta.x / propMagnitude, z: propDelta.z / propMagnitude };
    const atSideApron = (Math.abs(actor.position.x) > 5.02 && Math.abs(actor.position.x) < 5.82 && Math.abs(actor.position.z) < 2.9)
      || (Math.abs(actor.position.z) > 3.52 && Math.abs(actor.position.z) < 4.32 && Math.abs(actor.position.x) < 4.25);
    if (atSideApron && isActionLegal(model, 'context', 'opponent')) return { command: 'context', move: { x: 0, z: 0 }, run: false, nextSeed };
    if (propDistance <= 2.15 && isActionLegal(model, 'interact', 'opponent')) return { command: 'interact', move: { x: 0, z: 0 }, run: false, nextSeed };
    return { command: null, move: towardProp, run: propDistance > 4.2, nextSeed };
  }
  const atCorner = Math.abs(actor.position.x) > 4.35 && Math.abs(actor.position.z) > 2.95;
  const nearRopes = Math.abs(actor.position.x) > 4.1 || Math.abs(actor.position.z) > 3.2;

  // Rope rebound setup: run away from opponent to build a clothesline charge (athletic fighters)
  if (actor.ropeRebound <= 0 && !nearRopes && !physicallyCompromised && separation > 2.0 && model.elapsed > 5) {
    if (roll < personality.athletic * .18) return { command: null, move: { x: -toward.x, z: -toward.z }, run: true, nextSeed };
  }

  // Proactive turnbuckle climb: when corner is reachable and opponent is vulnerable
  if (atCorner && !['climbing', 'grappling', 'attacking'].includes(actor.state) && isActionLegal(model, 'context', 'opponent')) {
    const opponentVulnerable = target.state === 'downed' || (target.state === 'staggered' && separation < 5.5);
    const climbChance = (.14 + personality.athletic * .32) * (opponentVulnerable ? 2.4 : 1);
    if (roll < climbChance && model.elapsed > 8) return { command: 'context', move: { x: 0, z: 0 }, run: false, nextSeed };
  }

  // Aggressive downed opponent pursuit: sprint and finish
  if (target.state === 'downed') {
    if (actor.momentum >= 100 && isActionLegal(model, 'context', 'opponent')) return { command: 'context', move: toward, run: false, nextSeed };
    if (separation > 1.9) return { command: null, move: toward, run: true, nextSeed };
    if (separation <= 1.7 && isActionLegal(model, 'context', 'opponent')) return { command: 'context', move: { x: 0, z: 0 }, run: false, nextSeed };
    if (isActionLegal(model, 'quick', 'opponent')) return { command: 'quick', move: { x: 0, z: 1 }, run: false, nextSeed }; // low kick / ground stomp
    return { command: null, move: toward, run: false, nextSeed };
  }

  // Desperation mode: when very low health, gamble on a piledriver
  if (actor.health < 28 && actor.stamina > 22 && separation < 1.5 && roll < .52 && isActionLegal(model, 'grapple', 'opponent')) {
    return { command: 'grapple', move: { x: 0, z: 0 }, run: false, nextSeed }; // neutral = piledriver
  }

  // Full momentum: aggressively pursue finisher setup
  if (actor.momentum >= 100) {
    if (isActionLegal(model, 'context', 'opponent')) return { command: 'context', move: toward, run: false, nextSeed };
    return { command: null, move: toward, run: separation > 2.0, nextSeed };
  }
  // Commit only after entering physical striking/grip range.
  if (separation > 1.32) {
    if (separation > 3.1 && actor.health > 48 && roll < personality.showman * .13 && isActionLegal(model, 'taunt', 'opponent')) return { command: 'taunt', move: { x: 0, z: 0 }, run: false, nextSeed };
    // Tactical corner positioning for aerial setup
    if (!atCorner && separation > 3.8 && roll < personality.athletic * .1) {
      const cornerX = actor.position.x >= 0 ? 4.9 : -4.9; const cornerZ = actor.position.z >= 0 ? 3.6 : -3.6;
      const mag = Math.hypot(cornerX - actor.position.x, cornerZ - actor.position.z);
      return { command: null, move: { x: (cornerX - actor.position.x) / Math.max(.001, mag), z: (cornerZ - actor.position.z) / Math.max(.001, mag) }, run: true, nextSeed };
    }
    return { command: null, move: toward, run: separation > 2.8, nextSeed };
  }
  const bias = definition.tendency;
  const grappleThreshold = clampChance(.31 + personality.technical * .25 + personality.powerhouse * .16);
  const heavyThreshold = clampChance(.7 - personality.aggressive * .12 - personality.reckless * .1);
  const command: GameCommand = bias === 'technical' && roll < grappleThreshold + .16 ? 'grapple'
    : bias === 'opportunistic' && roll > heavyThreshold ? 'heavy'
    : bias === 'aggressive' && roll < .28 ? 'grapple' // aggressive fighters grab for piledriver
    : roll < .44 ? 'quick' : roll < .44 + grappleThreshold ? 'grapple' : 'heavy';
  const legal = isActionLegal(model, command, 'opponent') ? command : isActionLegal(model, 'quick', 'opponent') ? 'quick' : null;
  const move = legal === 'grapple' ? grappleDirectionFor(definition.tendency, roll)
    : legal === 'quick' || legal === 'heavy' ? strikeDirectionFor(legal, definition.tendency, roll, actor.stamina) : { x: 0, z: 0 };
  return { command: legal, move, run: false, nextSeed };
};

function clampChance(value: number): number { return Math.max(.05, Math.min(.95, value)); }
