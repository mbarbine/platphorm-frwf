import { fighterById } from '../data/fighters';
import { getMove } from '../data/moves';
import { chooseAiDecision, isActionLegal } from '../ai/utilityAI';
import { clamp, distance, normalize, scale, seededRandom } from '../utils/math';
import type { Difficulty, FighterId, FighterRuntime, GameCommand, ImpactEvent, MatchModel, MatchResult, MatchStats, MoveDefinition, PropRuntime, Ruleset, Vec2 } from '../types/game';

export interface FrameInput { move: Vec2; run: boolean; commands: readonly GameCommand[] }
const EMPTY_STATS = (): MatchStats => ({ damageDealt: 0, counters: 0, grapples: 0, finishers: 0, nearFalls: 0, propImpacts: 0 });

export const createFighterRuntime = (definitionId: FighterId, position: Vec2): FighterRuntime => ({
  definitionId, position, velocity: { x: 0, z: 0 }, facing: 0, health: 100, stamina: 100, momentum: 0,
  state: 'idle', moveId: null, attackPhase: null, phaseElapsed: 0, stateElapsed: 0, hitTargets: [], downTimer: 0,
  counterWindow: 0, invulnerability: 0, pinCount: 0, pinEscape: 0, heldPropId: null, comboStep: 0, recentMoves: [],
  lastActionAt: 0, ropeRebound: 0, finisherPrimed: false,
});

const initialProps = (enabled: boolean): PropRuntime[] => enabled ? [
  { id: 'chair-1', kind: 'chair', position: { x: -7.1, z: 2.8 }, durability: 3, heldBy: null, broken: false },
  { id: 'sign-1', kind: 'sign', position: { x: 7, z: -2.4 }, durability: 2, heldBy: null, broken: false },
  { id: 'table-1', kind: 'table', position: { x: 0, z: -7.2 }, durability: 1, heldBy: null, broken: false },
] : [{ id: 'table-1', kind: 'table', position: { x: 0, z: -7.2 }, durability: 1, heldBy: null, broken: false }];

export const createMatch = (playerId: FighterId, opponentId: FighterId, ruleset: Ruleset, difficulty: Difficulty, seed = 1337): MatchModel => ({
  ruleset, difficulty, elapsed: 0, paused: false, resolved: false,
  player: createFighterRuntime(playerId, { x: -2.3, z: 0 }), opponent: createFighterRuntime(opponentId, { x: 2.3, z: 0 }),
  hype: 8, props: initialProps(ruleset === 'chaos'), chaosEvent: null, nextChaosAt: 38, lastImpact: null, impactSequence: 0,
  announcement: 'ROUND ONE — FIGHT!', announcementTimer: 2.2, hitStop: 0, slowMotion: 0, result: null,
  playerStats: EMPTY_STATS(), opponentStats: EMPTY_STATS(), aiThinkTimer: .35, aiIntent: null, seed,
});

export const resetTransientState = (model: MatchModel): MatchModel => createMatch(model.player.definitionId, model.opponent.definitionId, model.ruleset, model.difficulty, model.seed + 97);

export const getAttackPhase = (move: MoveDefinition, elapsed: number): 'anticipation' | 'active' | 'recovery' | null => {
  if (elapsed < move.anticipationDuration) return 'anticipation';
  if (elapsed < move.anticipationDuration + move.activeDuration) return 'active';
  if (elapsed < move.anticipationDuration + move.activeDuration + move.recoveryDuration) return 'recovery';
  return null;
};

export const canStartMove = (actor: FighterRuntime, target: FighterRuntime, move: MoveDefinition): boolean => {
  const targetDistance = distance(actor.position, target.position);
  return move.requiredActorStates.includes(actor.state)
    && actor.stamina >= move.staminaCost
    && targetDistance >= move.minimumRange
    && targetDistance <= move.maximumRange
    && (!move.requiredTargetStates || move.requiredTargetStates.includes(target.state));
};

export const startMove = (actor: FighterRuntime, target: FighterRuntime, move: MoveDefinition): boolean => {
  if (!canStartMove(actor, target, move)) return false;
  actor.state = move.category === 'grapple' ? 'grappling' : 'attacking';
  actor.moveId = move.id;
  actor.attackPhase = 'anticipation';
  actor.phaseElapsed = 0;
  actor.stateElapsed = 0;
  actor.hitTargets = [];
  actor.stamina = clamp(actor.stamina - move.staminaCost, 0, 100);
  actor.finisherPrimed = move.category === 'finisher';
  if (move.category === 'finisher') actor.momentum = 0;
  return true;
};

const addImpact = (model: MatchModel, position: Vec2, kind: ImpactEvent['kind'], intensity: number): void => {
  model.impactSequence += 1;
  model.lastImpact = { id: model.impactSequence, position: { ...position }, kind, intensity };
  model.hitStop = Math.max(model.hitStop, intensity * .045);
};

const varietyMultiplier = (actor: FighterRuntime, moveId: string): number => {
  const repeats = actor.recentMoves.filter((recent) => recent === moveId).length;
  return repeats === 0 ? 1 : repeats === 1 ? .55 : .12;
};

export const applyMoveHit = (model: MatchModel, actorKey: 'player' | 'opponent', targetKey: 'player' | 'opponent', move: MoveDefinition): boolean => {
  const actor = model[actorKey];
  const target = model[targetKey];
  if (actor.attackPhase !== 'active' || (!move.multiHit && actor.hitTargets.includes(targetKey))) return false;
  if (target.invulnerability > 0 || distance(actor.position, target.position) > move.maximumRange + .4) return false;

  const targetDefinition = fighterById(target.definitionId);
  const actorDefinition = fighterById(actor.definitionId);
  const scaledDamage = move.damage * (.78 + actorDefinition.stats.power / 250) * (1.08 - targetDefinition.stats.stamina / 900);
  const damage = Math.round(scaledDamage * 10) / 10;
  target.health = clamp(target.health - damage, 0, 100);
  actor.hitTargets.push(targetKey);
  const variety = varietyMultiplier(actor, move.id);
  const surge = model.chaosEvent?.type === 'CROWD SURGE' ? 1.6 : 1;
  actor.momentum = clamp(actor.momentum + move.momentumGain * variety * (model.ruleset === 'chaos' ? 1.2 : 1) * surge, 0, 100);
  model.hype = clamp(model.hype + move.hypeValue * variety, 0, 100);
  actor.recentMoves = [...actor.recentMoves.slice(-4), move.id];
  const stats = actorKey === 'player' ? model.playerStats : model.opponentStats;
  stats.damageDealt = Math.round((stats.damageDealt + damage) * 10) / 10;
  if (move.category === 'grapple') stats.grapples += 1;
  if (move.category === 'finisher') stats.finishers += 1;
  if (move.category === 'prop') stats.propImpacts += 1;
  if (move.category === 'prop' && actor.heldPropId) {
    const prop = model.props.find((candidate) => candidate.id === actor.heldPropId);
    if (prop) {
      prop.durability -= 1;
      if (prop.durability <= 0) { prop.broken = true; prop.heldBy = null; actor.heldPropId = null; }
    }
  }

  const direction = normalize({ x: target.position.x - actor.position.x, z: target.position.z - actor.position.z });
  target.velocity = scale(direction, move.knockback * (model.chaosEvent?.type === 'OVERDRIVE ROPES' ? 1.18 : 1));
  const lowHealthBonus = target.health < 35 ? .28 : 0;
  if (move.knockdownStrength + lowHealthBonus >= .72 || move.category === 'finisher') {
    target.state = 'downed';
    target.downTimer = 1.6 + (100 - target.health) / 75 + (move.category === 'finisher' ? 1.2 : 0);
    target.moveId = null;
    target.attackPhase = null;
  } else {
    target.state = 'staggered';
    target.stateElapsed = 0;
    target.moveId = null;
    target.attackPhase = null;
  }

  const kind: ImpactEvent['kind'] = move.category === 'finisher' ? 'finisher' : move.category === 'prop' ? 'weapon' : move.category === 'grapple' ? 'grapple' : move.category === 'heavy' || move.category === 'aerial' ? 'heavy' : 'light';
  addImpact(model, target.position, kind, move.category === 'finisher' ? 2.2 : Math.max(.6, move.damage / 13));
  const table = model.props.find((prop) => prop.kind === 'table' && !prop.broken);
  if (table && ['finisher', 'grapple', 'aerial'].includes(move.category) && distance(target.position, table.position) < 2.6) {
    table.broken = true;
    model.hype = clamp(model.hype + 28, 0, 100);
    addImpact(model, table.position, 'table', 2.1);
    model.announcement = 'COMMENTARY DESK — WRECKED!'; model.announcementTimer = 2;
  }
  if (move.category === 'finisher') {
    model.slowMotion = .65;
    model.announcement = `${actorDefinition.signature}!`;
    model.announcementTimer = 1.8;
  }
  if (target.health <= 0 && (move.category === 'finisher' || move.category === 'heavy' || move.category === 'grapple' || move.category === 'prop' || move.category === 'aerial')) resolveMatch(model, actorKey, 'KNOCKOUT');
  return true;
};

export const performCounter = (model: MatchModel, defenderKey: 'player' | 'opponent', attackerKey: 'player' | 'opponent'): boolean => {
  const defender = model[defenderKey];
  const attacker = model[attackerKey];
  if (!attacker.moveId || attacker.attackPhase !== 'anticipation' || defender.stamina < 10) return false;
  const incoming = getMove(attacker.moveId);
  if (!incoming.counterWindow || attacker.phaseElapsed < incoming.counterWindow[0] || attacker.phaseElapsed > incoming.counterWindow[1]) return false;
  attacker.state = 'staggered'; attacker.moveId = null; attacker.attackPhase = null; attacker.stateElapsed = 0;
  defender.state = 'attacking'; defender.moveId = 'counter'; defender.attackPhase = 'active'; defender.phaseElapsed = getMove('counter').anticipationDuration;
  defender.stamina = clamp(defender.stamina - 10, 0, 100); defender.momentum = clamp(defender.momentum + 18, 0, 100);
  const stats = defenderKey === 'player' ? model.playerStats : model.opponentStats;
  stats.counters += 1;
  model.hype = clamp(model.hype + 18, 0, 100);
  addImpact(model, attacker.position, 'counter', 1.4);
  model.announcement = 'FLASH REVERSAL!'; model.announcementTimer = 1.2;
  return true;
};

const chooseGrapple = (actor: FighterRuntime): string => {
  const options = ['slam', 'suplex', 'takedown', 'whip'];
  return options[actor.comboStep % options.length] ?? 'slam';
};

const startPin = (actor: FighterRuntime, target: FighterRuntime): boolean => {
  if (target.state !== 'downed' || distance(actor.position, target.position) > 1.7) return false;
  actor.state = 'pinning'; actor.pinCount = 0; actor.stateElapsed = 0;
  target.state = 'pinned'; target.pinCount = 0; target.pinEscape = 0; target.stateElapsed = 0;
  return true;
};

const useProp = (model: MatchModel, actorKey: 'player' | 'opponent'): boolean => {
  const actor = model[actorKey];
  const target = actorKey === 'player' ? model.opponent : model.player;
  if (actor.heldPropId) {
    if (distance(actor.position, target.position) <= 2.3) return startMove(actor, target, getMove('prop'));
    const prop = model.props.find((candidate) => candidate.id === actor.heldPropId);
    if (prop) { prop.heldBy = null; prop.position = { x: actor.position.x + Math.sin(actor.facing) * 2.5, z: actor.position.z + Math.cos(actor.facing) * 2.5 }; }
    actor.heldPropId = null;
    return true;
  }
  const prop = model.props.filter((candidate) => !candidate.broken && !candidate.heldBy && candidate.kind !== 'table').sort((a, b) => distance(actor.position, a.position) - distance(actor.position, b.position))[0];
  if (!prop || distance(actor.position, prop.position) > 2.2) return false;
  actor.heldPropId = prop.id; prop.heldBy = actorKey;
  return true;
};

export const requestCommand = (model: MatchModel, actorKey: 'player' | 'opponent', command: GameCommand): boolean => {
  if (!isActionLegal(model, command, actorKey)) return false;
  const actor = model[actorKey];
  const targetKey = actorKey === 'player' ? 'opponent' : 'player';
  const target = model[targetKey];
  if (command === 'dodge') {
    if (performCounter(model, actorKey, targetKey)) return true;
    actor.state = 'locomotion'; actor.invulnerability = .32; actor.stamina = clamp(actor.stamina - 8, 0, 100);
    const away = normalize({ x: actor.position.x - target.position.x, z: actor.position.z - target.position.z });
    actor.velocity = scale(away, 3.2); return true;
  }
  if (command === 'interact') return useProp(model, actorKey);
  if (command === 'taunt') return startMove(actor, target, getMove('taunt'));
  if (command === 'context') {
    if (actor.momentum >= 100 && ['staggered', 'downed'].includes(target.state)) return startMove(actor, target, getMove('finisher'));
    const nearCorner = Math.abs(actor.position.x) > 4.65 && Math.abs(actor.position.z) > 3.2;
    if (nearCorner && ['downed', 'staggered'].includes(target.state)) return startMove(actor, target, getMove('aerial'));
    if (target.state === 'downed') return startPin(actor, target);
    return false;
  }
  if (command === 'quick') {
    const moveId = target.state === 'downed' ? 'ground' : actor.comboStep % 2 === 0 ? 'jab' : 'combo';
    const started = startMove(actor, target, getMove(moveId));
    if (started) actor.comboStep += 1;
    return started;
  }
  if (command === 'heavy') return startMove(actor, target, getMove(actor.heldPropId ? 'prop' : actor.ropeRebound > 0 ? 'rebound' : 'heavy'));
  const moveId = chooseGrapple(actor);
  const started = startMove(actor, target, getMove(moveId));
  if (started) actor.comboStep += 1;
  return started;
};

const scoreGrade = (hype: number): MatchResult['grade'] => hype >= 90 ? 'S' : hype >= 72 ? 'A' : hype >= 52 ? 'B' : hype >= 32 ? 'C' : 'D';
const resolveMatch = (model: MatchModel, winner: 'player' | 'opponent', method: MatchResult['method']): void => {
  if (model.resolved) return;
  model.resolved = true;
  model[winner].state = 'victorious';
  model[winner === 'player' ? 'opponent' : 'player'].state = 'defeated';
  model.result = { winner, method, duration: model.elapsed, hype: model.hype, grade: scoreGrade(model.hype), playerStats: { ...model.playerStats } };
  model.announcement = method === 'KNOCKOUT' ? 'KNOCKOUT!' : 'THREE!'; model.announcementTimer = 4;
  addImpact(model, model[winner].position, method === 'KNOCKOUT' ? 'ko' : 'finisher', 2.4);
};

const updatePin = (model: MatchModel, dt: number, playerInput: FrameInput): void => {
  const pinningKey = model.player.state === 'pinning' ? 'player' : model.opponent.state === 'pinning' ? 'opponent' : null;
  if (!pinningKey) return;
  const pinnedKey = pinningKey === 'player' ? 'opponent' : 'player';
  const pinning = model[pinningKey]; const pinned = model[pinnedKey];
  pinning.stateElapsed += dt; pinned.stateElapsed += dt;
  if (pinnedKey === 'player' && playerInput.commands.includes('dodge')) pinned.pinEscape += 14 + pinned.stamina * .035;
  if (pinnedKey === 'opponent') {
    const difficultyFactor = model.difficulty === 'hard' ? 1.08 : .92;
    pinned.pinEscape += dt * (9 + pinned.health * .2 + pinned.stamina * .08) * difficultyFactor;
  }
  const count = Math.min(3, Math.floor(pinning.stateElapsed) + 1);
  if (count !== pinning.pinCount) {
    pinning.pinCount = count; pinned.pinCount = count;
    model.announcement = count === 1 ? 'ONE' : count === 2 ? 'TWO' : 'THREE'; model.announcementTimer = .85;
  }
  const threshold = 76 + (100 - pinned.health) * .36 + (pinned.finisherPrimed ? 14 : 0);
  if (pinned.pinEscape >= threshold && count < 3) {
    pinning.state = 'idle'; pinned.state = 'downed'; pinned.downTimer = .8; pinning.pinCount = 0;
    const stats = pinningKey === 'player' ? model.playerStats : model.opponentStats; stats.nearFalls += 1;
    model.hype = clamp(model.hype + 16, 0, 100); model.announcement = `${count}.9 — KICKOUT!`; model.announcementTimer = 1.6;
    addImpact(model, pinned.position, 'nearfall', 1.5);
  } else if (count >= 3 && pinning.stateElapsed >= 2.85) resolveMatch(model, pinningKey, 'PINFALL');
};

const updateFighter = (model: MatchModel, actorKey: 'player' | 'opponent', dt: number, movement: Vec2, run: boolean): void => {
  const actor = model[actorKey];
  const target = actorKey === 'player' ? model.opponent : model.player;
  actor.stateElapsed += dt; actor.invulnerability = Math.max(0, actor.invulnerability - dt); actor.ropeRebound = Math.max(0, actor.ropeRebound - dt);
  if (actor.state === 'downed') {
    actor.downTimer -= dt; actor.stamina = clamp(actor.stamina + dt * 10, 0, 100);
    if (actor.downTimer <= 0) { actor.state = 'recovering'; actor.stateElapsed = 0; }
  } else if (actor.state === 'recovering' && actor.stateElapsed > .7) { actor.state = 'idle'; actor.stateElapsed = 0; }
  else if (actor.state === 'staggered' && actor.stateElapsed > .42 + (100 - actor.health) / 240) { actor.state = 'idle'; actor.stateElapsed = 0; }

  if (actor.moveId) {
    const move = getMove(actor.moveId);
    actor.phaseElapsed += dt;
    actor.attackPhase = getAttackPhase(move, actor.phaseElapsed);
    if (actor.attackPhase === 'active') applyMoveHit(model, actorKey, actorKey === 'player' ? 'opponent' : 'player', move);
    if (!actor.attackPhase) { actor.moveId = null; actor.state = 'idle'; actor.stateElapsed = 0; actor.finisherPrimed = false; }
  }

  const canMove = ['idle', 'locomotion'].includes(actor.state);
  const inputLength = Math.hypot(movement.x, movement.z);
  if (canMove && inputLength > .08) {
    const definition = fighterById(actor.definitionId);
    const running = run && actor.stamina > 3;
    const speed = (running ? 5.2 : 3.15) * (.72 + definition.stats.speed / 250) * (actor.stamina < 20 ? .78 : 1);
    const direction = normalize(movement); actor.velocity = scale(direction, speed);
    actor.facing = Math.atan2(direction.x, direction.z); actor.state = 'locomotion';
    if (running) actor.stamina = clamp(actor.stamina - dt * 8, 0, 100);
  } else if (canMove) {
    actor.state = 'idle'; actor.velocity = scale(actor.velocity, Math.max(0, 1 - dt * 10));
    actor.stamina = clamp(actor.stamina + dt * (actor.state === 'idle' ? 13 : 8), 0, 100);
  }
  actor.position.x += actor.velocity.x * dt; actor.position.z += actor.velocity.z * dt;
  actor.velocity = scale(actor.velocity, Math.max(0, 1 - dt * 4));

  const ropeX = 5.65; const ropeZ = 4.15; const outside = Math.abs(actor.position.x) > ropeX + .2 || Math.abs(actor.position.z) > ropeZ + .2;
  const impactSpeed = Math.hypot(actor.velocity.x, actor.velocity.z);
  const deliberateRingOut = (actor.state === 'downed' || actor.state === 'staggered') && impactSpeed > 2.7;
  if (!outside && !deliberateRingOut && Math.abs(actor.position.x) > ropeX) {
    actor.position.x = Math.sign(actor.position.x) * ropeX; actor.velocity.x *= -.92;
    if (actor.ropeRebound <= 0) addImpact(model, actor.position, 'rope', .55); actor.ropeRebound = 1.1;
  }
  if (!outside && !deliberateRingOut && Math.abs(actor.position.z) > ropeZ) {
    actor.position.z = Math.sign(actor.position.z) * ropeZ; actor.velocity.z *= -.92;
    if (actor.ropeRebound <= 0) addImpact(model, actor.position, 'rope', .55); actor.ropeRebound = 1.1;
  }
  actor.position.x = clamp(actor.position.x, -9.2, 9.2); actor.position.z = clamp(actor.position.z, -8.2, 8.2);
  actor.facing = Math.atan2(target.position.x - actor.position.x, target.position.z - actor.position.z);
}

const updateChaos = (model: MatchModel, dt: number): void => {
  if (model.ruleset !== 'chaos') return;
  if (model.chaosEvent) {
    model.chaosEvent.remaining -= dt;
    if (model.chaosEvent.remaining <= 0) model.chaosEvent = null;
    return;
  }
  if (model.elapsed < model.nextChaosAt || model.player.state === 'pinning' || model.opponent.state === 'pinning') return;
  const types = ['PROP DROP', 'CROWD SURGE', 'OVERDRIVE ROPES', 'SPOTLIGHT SHOWDOWN'] as const;
  const [roll, nextSeed] = seededRandom(model.seed); model.seed = nextSeed;
  const type = types[Math.floor(roll * types.length)] ?? 'PROP DROP';
  model.chaosEvent = { type, remaining: type === 'PROP DROP' ? 5 : 14 };
  model.nextChaosAt = model.elapsed + 35 + roll * 20;
  model.announcement = `CHAOS EVENT — ${type}`; model.announcementTimer = 2.5;
  if (type === 'PROP DROP') model.props.push({ id: `chair-${model.impactSequence + 9}`, kind: roll > .5 ? 'chair' : 'sign', position: { x: (roll - .5) * 8, z: -5.6 }, durability: 2, heldBy: null, broken: false });
};

export const advanceMatch = (model: MatchModel, dt: number, playerInput: FrameInput): MatchModel => {
  if (model.paused || model.resolved) return model;
  if (model.hitStop > 0) { model.hitStop = Math.max(0, model.hitStop - dt); return model; }
  const step = dt * (model.slowMotion > 0 ? .36 : 1); model.slowMotion = Math.max(0, model.slowMotion - dt);
  model.elapsed += step; model.announcementTimer = Math.max(0, model.announcementTimer - step); if (model.announcementTimer === 0) model.announcement = null;
  updateChaos(model, step);
  updatePin(model, step, playerInput);
  if (model.player.state === 'pinned' || model.opponent.state === 'pinned') return model;

  for (const command of playerInput.commands) requestCommand(model, 'player', command);
  model.aiThinkTimer -= step;
  let aiMove: Vec2 = { x: 0, z: 0 }; let aiRun = false;
  if (model.aiThinkTimer <= 0) {
    const decision = chooseAiDecision(model, fighterById(model.opponent.definitionId));
    model.seed = decision.nextSeed; model.aiIntent = decision.command; aiMove = decision.move; aiRun = decision.run;
    model.aiThinkTimer = model.difficulty === 'hard' ? .22 : .38;
    if (decision.command) requestCommand(model, 'opponent', decision.command);
  } else {
    const delta = { x: model.player.position.x - model.opponent.position.x, z: model.player.position.z - model.opponent.position.z };
    if (distance(model.player.position, model.opponent.position) > 1.8) aiMove = normalize(delta);
  }
  updateFighter(model, 'player', step, playerInput.move, playerInput.run);
  updateFighter(model, 'opponent', step, aiMove, aiRun);
  const playerThreat = model.opponent.moveId ? getMove(model.opponent.moveId) : null;
  model.player.counterWindow = playerThreat?.counterWindow && model.opponent.attackPhase === 'anticipation' && distance(model.player.position, model.opponent.position) < playerThreat.maximumRange + .3 && model.opponent.phaseElapsed >= playerThreat.counterWindow[0] && model.opponent.phaseElapsed <= playerThreat.counterWindow[1] ? .1 : 0;
  const opponentThreat = model.player.moveId ? getMove(model.player.moveId) : null;
  model.opponent.counterWindow = opponentThreat?.counterWindow && model.player.attackPhase === 'anticipation' && distance(model.player.position, model.opponent.position) < opponentThreat.maximumRange + .3 && model.player.phaseElapsed >= opponentThreat.counterWindow[0] && model.player.phaseElapsed <= opponentThreat.counterWindow[1] ? .1 : 0;
  return model;
};
