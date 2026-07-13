import { fighterById } from '../data/fighters';
import { getMove } from '../data/moves';
import { BALANCE } from '../data/balance';
import { chooseAiDecision, isActionLegal } from '../ai/utilityAI';
import { applyLocalizedImpact, calculateImpact, createBodyDynamics, integrateLocomotion, stepBodyDynamics } from '../physics/bodyDynamics';
import { createGrappleRuntime, releaseGrapple, retargetGrapple, stepGrappleDynamics } from '../physics/grappleDynamics';
import { clamp, distance, normalize, scale, seededRandom } from '../utils/math';
import type { Difficulty, FighterId, FighterRuntime, GameCommand, HighlightMoment, ImpactEvent, MatchHighlights, MatchModel, MatchResult, MatchStats, MoveDefinition, PropRuntime, ReplayFighterFrame, Ruleset, Vec2 } from '../types/game';
import type { BodyWorksContact } from '../physics/physicsRuntime';

export interface FrameInput { move: Vec2; run: boolean; block: boolean; commands: readonly GameCommand[] }
const EMPTY_STATS = (): MatchStats => ({ damageDealt: 0, counters: 0, grapples: 0, finishers: 0, nearFalls: 0, propImpacts: 0 });
const EMPTY_HIGHLIGHTS = (): MatchHighlights => ({ bestSpot: null, bestSlam: null, mostBrutalImpact: null, mostUnexpectedReversal: null });

export const createFighterRuntime = (definitionId: FighterId, position: Vec2, beersDrunk = 0): FighterRuntime => {
  const definition = fighterById(definitionId);
  const beers = clamp(Math.round(beersDrunk), 0, BALANCE.stamina.beersPerFighter);
  const staminaCap = Math.round((BALANCE.stamina.baseCap + definition.stats.stamina * BALANCE.stamina.statScale + beers * BALANCE.stamina.beerCapBoost) * 10) / 10;
  return ({
  definitionId, position, velocity: { x: 0, z: 0 }, facing: 0, health: 100, stamina: staminaCap, staminaCap, beersDrunk: beers, momentum: 0,
  state: 'idle', moveId: null, attackPhase: null, phaseElapsed: 0, stateElapsed: 0, hitTargets: [], attackInstanceId: 0, downTimer: 0,
  counterWindow: 0, invulnerability: 0, pinCount: 0, pinEscape: 0, heldPropId: null, comboStep: 0, recentMoves: [],
  lastActionAt: 0, ropeRebound: 0, finisherPrimed: false,
  body: createBodyDynamics(definition),
  });
};

const initialProps = (enabled: boolean): PropRuntime[] => enabled ? [
  { id: 'chair-1', kind: 'chair', position: { x: -7.1, z: 2.8 }, durability: 3, stress: 0, failureStage: 'intact', heldBy: null, broken: false },
  { id: 'sign-1', kind: 'sign', position: { x: 7, z: -2.4 }, durability: 2, stress: 0, failureStage: 'intact', heldBy: null, broken: false },
  { id: 'table-1', kind: 'table', position: { x: 0, z: -7.2 }, durability: 1, stress: 0, failureStage: 'intact', heldBy: null, broken: false },
] : [{ id: 'table-1', kind: 'table', position: { x: 0, z: -7.2 }, durability: 1, stress: 0, failureStage: 'intact', heldBy: null, broken: false }];

export const createMatch = (playerId: FighterId, opponentId: FighterId, ruleset: Ruleset, difficulty: Difficulty, seed = 1337, playerBeers = 0, opponentBeers = 0): MatchModel => ({
  labMode: false, ruleset, difficulty, elapsed: 0, paused: false, physicsAuthority: false, resolved: false,
  player: createFighterRuntime(playerId, { x: -2.3, z: 0 }, playerBeers), opponent: createFighterRuntime(opponentId, { x: 2.3, z: 0 }, opponentBeers),
  hype: 8, props: initialProps(ruleset === 'chaos'), chaosEvent: null, nextChaosAt: 38, lastImpact: null, impactSequence: 0,
  announcement: 'ROUND ONE — FIGHT!', announcementTimer: 2.2, hitStop: 0, slowMotion: 0, result: null,
  playerStats: EMPTY_STATS(), opponentStats: EMPTY_STATS(), aiThinkTimer: .35, aiIntent: null, aiMovement: { x: 0, z: 0 }, aiRunning: false, aiBlockTimer: 0,
  grapple: null, replayFrames: [], replaySampleTimer: 0, highlights: [], runtimeId: seed, seed,
});

export const resetTransientState = (model: MatchModel): MatchModel => {
  const reset = createMatch(model.player.definitionId, model.opponent.definitionId, model.ruleset, model.difficulty, model.seed + 97, model.player.beersDrunk, model.opponent.beersDrunk);
  reset.labMode = model.labMode; return reset;
};

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
  actor.attackInstanceId += 1;
  actor.stamina = clamp(actor.stamina - move.staminaCost, 0, actor.staminaCap);
  actor.finisherPrimed = move.category === 'finisher';
  if (move.category === 'finisher') actor.momentum = 0;
  return true;
};

interface ImpactMetadata {
  region?: ImpactEvent['region'];
  force?: number;
  torque?: number;
  outcome?: ImpactEvent['outcome'];
  highlight?: Omit<HighlightMoment, 'impactId' | 'time'>;
}

const addImpact = (model: MatchModel, position: Vec2, kind: ImpactEvent['kind'], intensity: number, metadata: ImpactMetadata = {}): void => {
  model.impactSequence += 1;
  model.lastImpact = {
    id: model.impactSequence,
    position: { ...position },
    kind,
    intensity,
    region: metadata.region,
    force: metadata.force,
    torque: metadata.torque,
    outcome: metadata.outcome,
  };
  if (metadata.highlight) {
    model.highlights = [...model.highlights.slice(-23), {
      impactId: model.impactSequence,
      time: model.elapsed,
      ...metadata.highlight,
    }];
  }
  model.hitStop = Math.max(model.hitStop, intensity * .045);
};

const varietyMultiplier = (actor: FighterRuntime, moveId: string): number => {
  const repeats = actor.recentMoves.filter((recent) => recent === moveId).length;
  return repeats === 0 ? 1 : repeats === 1 ? .55 : .12;
};

export const applyMoveHit = (model: MatchModel, actorKey: 'player' | 'opponent', targetKey: 'player' | 'opponent', move: MoveDefinition, contact?: BodyWorksContact): boolean => {
  const actor = model[actorKey];
  const target = model[targetKey];
  const hitToken = contact ? `${targetKey}:${actor.attackInstanceId}` : targetKey;
  const isPhysicalLanding = contact?.isLanding === true && (move.category === 'grapple' || move.category === 'finisher');
  if ((!isPhysicalLanding && actor.attackPhase !== 'active') || (!move.multiHit && actor.hitTargets.includes(hitToken))) return false;
  if (target.invulnerability > 0 || (!contact && distance(actor.position, target.position) > move.maximumRange + .4)) return false;

  const targetDefinition = fighterById(target.definitionId);
  const actorDefinition = fighterById(actor.definitionId);
  const contactQuality = contact ? clamp(contact.relativeSpeed * .22 + contact.maximumForce / 950, .28, 1.35) : 1;
  const scaledDamage = move.damage * BALANCE.damageScale * (.78 + actorDefinition.stats.power / 250) * (1.08 - targetDefinition.stats.stamina / 900) * contactQuality;
  const damage = Math.round(scaledDamage * 10) / 10;
  const baseImpact = calculateImpact(actor, target, move, model.impactSequence);
  const planarDirection = contact ? normalize({ x: contact.forceDirection[0], z: contact.forceDirection[2] }) : baseImpact.direction;
  const calculatedImpact = contact ? {
    ...baseImpact, region: contact.targetRegion ?? baseImpact.region, direction: Math.hypot(planarDirection.x, planarDirection.z) > .01 ? planarDirection : baseImpact.direction,
    force: clamp(contact.maximumForce / 115 + contact.relativeSpeed * 1.25, .4, 24),
    torque: clamp((contact.forceDirection[0] - contact.forceDirection[2]) * contact.maximumForce / 1400, -3.2, 3.2),
    closingSpeed: contact.relativeSpeed,
  } : baseImpact;
  const spatialGuard = contact ? target.state === 'blocking' && (contact.targetSegment?.includes('Forearm') === true || contact.targetSegment?.includes('Hand') === true) : target.state === 'blocking';
  if (spatialGuard && move.category !== 'grapple' && move.category !== 'finisher' && move.category !== 'utility') {
    actor.hitTargets.push(hitToken);
    const guardCost = Math.max(2, move.damage * BALANCE.block.strikeStaminaMultiplier);
    target.stamina = clamp(target.stamina - guardCost, 0, target.staminaCap);
    const chip = Math.round(damage * BALANCE.block.chipDamageMultiplier * 10) / 10;
    target.health = clamp(target.health - chip, 0, 100);
    const guardedImpact = { ...calculatedImpact, force: calculatedImpact.force * .28, torque: calculatedImpact.torque * .35 };
    applyLocalizedImpact(target, guardedImpact);
    if (target.stamina <= 0) {
      target.state = 'staggered'; target.stateElapsed = -BALANCE.block.guardBreakStagger;
      model.announcement = 'GUARD BREAK!'; model.announcementTimer = 1.1;
      model.hype = clamp(model.hype + 5, 0, 100);
      addImpact(model, target.position, 'heavy', 1.15, { region: calculatedImpact.region, force: guardedImpact.force, torque: guardedImpact.torque, outcome: 'stagger' });
    } else {
      model.announcement = 'STRIKE BLOCKED'; model.announcementTimer = .55;
      addImpact(model, target.position, 'blocked', .72, { region: calculatedImpact.region, force: guardedImpact.force, torque: guardedImpact.torque, outcome: 'absorbed' });
    }
    return true;
  }
  target.health = clamp(target.health - damage, 0, 100);
  actor.hitTargets.push(hitToken);
  const variety = varietyMultiplier(actor, move.id);
  const surge = model.chaosEvent?.type === 'CROWD SURGE' ? 1.6 : 1;
  actor.momentum = clamp(actor.momentum + move.momentumGain * variety * (model.ruleset === 'chaos' ? 1.2 : 1) * surge, 0, 100);
  model.hype = clamp(model.hype + move.hypeValue * variety * BALANCE.hypeScale, 0, 100);
  actor.recentMoves = [...actor.recentMoves.slice(-4), move.id];
  const stats = actorKey === 'player' ? model.playerStats : model.opponentStats;
  stats.damageDealt = Math.round((stats.damageDealt + damage) * 10) / 10;
  if (move.category === 'grapple') stats.grapples += 1;
  if (move.category === 'finisher') stats.finishers += 1;
  if (move.category === 'prop') stats.propImpacts += 1;
  if (move.category === 'prop' && (actor.heldPropId || contact?.sourceObjectId)) {
    const prop = model.props.find((candidate) => candidate.id === (actor.heldPropId ?? contact?.sourceObjectId));
    if (prop) {
      prop.durability -= 1;
      if (prop.durability <= 0) { prop.broken = true; prop.heldBy = null; actor.heldPropId = null; }
    }
  }

  const impact = model.chaosEvent?.type === 'OVERDRIVE ROPES' && actor.ropeRebound > 0
    ? { ...calculatedImpact, force: calculatedImpact.force * 1.18 }
    : calculatedImpact;
  const collisionOutcome = applyLocalizedImpact(target, impact);
  if (model.grapple && model.grapple.attacker === actorKey) releaseGrapple(model, 'staggered');
  const lowHealthBonus = target.health < 35 ? .28 : 0;
  const physicalFall = ['trip', 'fall', 'launch'].includes(collisionOutcome);
  if (move.knockdownStrength + lowHealthBonus >= .72 || move.category === 'finisher' || physicalFall) {
    // Pure rules tests and non-WebGL simulations retain a bounded deterministic
    // flight proxy. The shipping match never enters this branch: Rapier owns the
    // victim's height and the contact bridge resolves the real mat landing.
    if (!model.physicsAuthority && (move.category === 'grapple' || move.category === 'finisher')) {
      target.body.verticalOffset = Math.max(target.body.verticalOffset, .34);
      target.body.verticalVelocity = Math.min(target.body.verticalVelocity, -3.1);
    }
    const stillAirborne = target.body.verticalOffset > .08 || Math.abs(target.body.verticalVelocity) > 1.2;
    target.state = stillAirborne ? 'airborne' : 'downed';
    target.stateElapsed = 0;
    target.downTimer = 1.6 + (100 - target.health) / 75 + (move.category === 'finisher' ? 1.2 : 0);
    target.moveId = null;
    target.attackPhase = null;
    target.finisherPrimed = move.category === 'finisher';
  } else {
    target.state = 'staggered';
    target.stateElapsed = 0;
    target.moveId = null;
    target.attackPhase = null;
  }

  const kind: ImpactEvent['kind'] = move.category === 'finisher' ? 'finisher' : move.category === 'prop' ? 'weapon' : move.category === 'grapple' ? 'grapple' : move.category === 'heavy' || move.category === 'aerial' ? 'heavy' : 'light';
  const highlightKind: HighlightMoment['kind'] = move.category === 'grapple' || move.category === 'finisher' ? 'slam'
    : move.category === 'prop' ? 'weapon' : move.category === 'aerial' ? 'aerial' : move.id === 'rebound' ? 'rope' : 'strike';
  const highlightScore = Math.round((impact.force * 4 + move.hypeValue + (collisionOutcome === 'launch' ? 18 : 0) + (move.category === 'finisher' ? 28 : 0)) * 10) / 10;
  addImpact(model, target.position, kind, move.category === 'finisher' ? 2.2 : Math.max(.6, move.damage / 13), {
    region: impact.region,
    force: impact.force,
    torque: impact.torque,
    outcome: collisionOutcome,
    highlight: move.category === 'quick' && impact.force < 7 ? undefined : { label: move.category === 'finisher' ? actorDefinition.signature : move.displayName, score: highlightScore, kind: highlightKind },
  });
  if (move.category === 'finisher') {
    model.slowMotion = .82;
    model.announcement = `${actorDefinition.signature}!`;
    model.announcementTimer = 2.1;
  }
  if (move.category === 'grapple') {
    if (move.damage >= 18) model.slowMotion = Math.max(model.slowMotion, .24);
    model.announcement = move.displayName.toUpperCase(); model.announcementTimer = 1.2;
  }
  const majorImpact = move.category === 'finisher' || move.category === 'heavy' || move.category === 'grapple' || move.category === 'prop' || move.category === 'aerial';
  const exhaustionKnockout = model.elapsed >= BALANCE.knockout.earliestSeconds
    && target.health <= BALANCE.knockout.healthThreshold
    && target.stamina <= BALANCE.knockout.staminaThreshold
    && move.damage >= BALANCE.knockout.minimumMoveDamage;
  if ((target.health <= 0 && majorImpact) || (majorImpact && exhaustionKnockout)) resolveMatch(model, actorKey, 'KNOCKOUT');
  return true;
};

export const performCounter = (model: MatchModel, defenderKey: 'player' | 'opponent', attackerKey: 'player' | 'opponent'): boolean => {
  const defender = model[defenderKey];
  const attacker = model[attackerKey];
  if (!attacker.moveId || attacker.attackPhase !== 'anticipation' || defender.stamina < 10) return false;
  const incoming = getMove(attacker.moveId);
  if (!incoming.counterWindow || attacker.phaseElapsed < incoming.counterWindow[0] || attacker.phaseElapsed > incoming.counterWindow[1]) return false;
  if (model.grapple) releaseGrapple(model, 'idle');
  attacker.state = 'staggered'; attacker.moveId = null; attacker.attackPhase = null; attacker.stateElapsed = 0;
  defender.state = 'attacking'; defender.moveId = 'counter'; defender.attackPhase = 'active'; defender.phaseElapsed = getMove('counter').anticipationDuration;
  defender.stamina = clamp(defender.stamina - 10, 0, defender.staminaCap); defender.momentum = clamp(defender.momentum + 18, 0, 100);
  const stats = defenderKey === 'player' ? model.playerStats : model.opponentStats;
  stats.counters += 1;
  model.hype = clamp(model.hype + 18, 0, 100);
  addImpact(model, attacker.position, 'counter', 1.4, { outcome: 'spin', highlight: { label: `Reversed ${incoming.displayName}`, score: 58 + incoming.damage, kind: 'reversal' } });
  model.announcement = 'FLASH REVERSAL!'; model.announcementTimer = 1.2;
  return true;
};

type GrappleButton = 'quick' | 'heavy' | 'grapple';
type GrappleDirection = 'neutral' | 'up' | 'down' | 'left' | 'right';

const grappleDirection = (direction: Vec2): GrappleDirection => {
  if (Math.hypot(direction.x, direction.z) < .35) return 'neutral';
  if (Math.abs(direction.x) > Math.abs(direction.z)) return direction.x < 0 ? 'left' : 'right';
  return direction.z < 0 ? 'up' : 'down';
};

const GRAPPLE_GRID: Readonly<Record<GrappleDirection, Readonly<Record<GrappleButton, string>>>> = {
  neutral: { quick: 'takedown', heavy: 'slam', grapple: 'slam' },
  up: { quick: 'arm_drag', heavy: 'skyhook', grapple: 'powerbomb' },
  down: { quick: 'takedown', heavy: 'spinebuster', grapple: 'mountain_drop' },
  left: { quick: 'clutch', heavy: 'spinebuster', grapple: 'whip' },
  right: { quick: 'side_toss', heavy: 'slam', grapple: 'suplex' },
};

export const selectDirectionalGrapple = (direction: Vec2, button: GrappleButton): string => GRAPPLE_GRID[grappleDirection(direction)][button];

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
    const started = startMove(actor, target, getMove('prop_throw')); if (!started) return false;
    if (prop) { prop.heldBy = null; prop.position = { x: actor.position.x + Math.sin(actor.facing) * 2.5, z: actor.position.z + Math.cos(actor.facing) * 2.5 }; }
    actor.heldPropId = null;
    model.announcement = 'AIR MAIL — PROP THROWN!'; model.announcementTimer = .9;
    return true;
  }
  const prop = model.props.filter((candidate) => !candidate.broken && !candidate.heldBy && candidate.kind !== 'table').sort((a, b) => distance(actor.position, a.position) - distance(actor.position, b.position))[0];
  if (!prop || distance(actor.position, prop.position) > 2.2) return false;
  actor.heldPropId = prop.id; prop.heldBy = actorKey;
  return true;
};

export const requestCommand = (model: MatchModel, actorKey: 'player' | 'opponent', command: GameCommand, direction: Vec2 = { x: 0, z: 0 }): boolean => {
  const actor = model[actorKey];
  const targetKey = actorKey === 'player' ? 'opponent' : 'player';
  const target = model[targetKey];
  if (actor.state === 'grappling' && actor.attackPhase === 'anticipation' && (command === 'quick' || command === 'heavy' || command === 'grapple')) {
    const moveId = selectDirectionalGrapple(direction, command);
    const selected = getMove(moveId);
    const current = actor.moveId ? getMove(actor.moveId) : selected;
    const extraCost = Math.max(0, selected.staminaCost - current.staminaCost);
    if (actor.stamina < extraCost) return false;
    actor.stamina = clamp(actor.stamina - extraCost, 0, actor.staminaCap);
    actor.moveId = moveId;
    actor.phaseElapsed = Math.min(actor.phaseElapsed, selected.anticipationDuration * .55);
    if (model.grapple?.attacker === actorKey) retargetGrapple(model.grapple, moveId);
    model.announcement = `${grappleDirection(direction).toUpperCase()} + ${command.toUpperCase()} — ${selected.displayName.toUpperCase()}`;
    model.announcementTimer = .75;
    return true;
  }
  if (!isActionLegal(model, command, actorKey)) return false;
  if (command === 'block') {
    actor.state = 'blocking'; actor.stateElapsed = 0; actor.velocity = scale(actor.velocity, .15);
    return true;
  }
  if (command === 'dodge') {
    if (performCounter(model, actorKey, targetKey)) return true;
    actor.state = 'locomotion'; actor.invulnerability = .32; actor.stamina = clamp(actor.stamina - 8, 0, actor.staminaCap);
    const away = normalize({ x: actor.position.x - target.position.x, z: actor.position.z - target.position.z });
    actor.velocity = scale(away, 3.2); return true;
  }
  if (command === 'jump') {
    actor.state = 'jumping'; actor.stateElapsed = 0; actor.stamina = clamp(actor.stamina - 8, 0, actor.staminaCap);
    actor.body.verticalVelocity = Math.max(actor.body.verticalVelocity, 5.8);
    return true;
  }
  if (command === 'interact') return useProp(model, actorKey);
  if (command === 'taunt') return startMove(actor, target, getMove('taunt'));
  if (command === 'context') {
    if (actor.state === 'climbing') {
      if (!['defeated', 'victorious'].includes(target.state) && distance(actor.position, target.position) <= getMove('aerial').maximumRange) {
        model.announcement = 'DOMEFALL — AIRBORNE!'; model.announcementTimer = 1;
        const started = startMove(actor, target, getMove('aerial'));
        if (started) {
          actor.body.verticalOffset = Math.max(actor.body.verticalOffset, .92);
          actor.body.verticalVelocity = 4.2;
          const flight = normalize({ x: target.position.x - actor.position.x, z: target.position.z - actor.position.z });
          actor.velocity = scale(flight, 6.1);
        }
        return started;
      }
      return false;
    }
    if (actor.momentum >= 100 && ['staggered', 'downed'].includes(target.state)) {
      const started = startMove(actor, target, getMove('finisher'));
      if (started) {
        target.state = model.physicsAuthority ? 'staggered' : 'grabbed'; target.stateElapsed = 0; target.velocity = scale(target.velocity, .25);
        target.moveId = null; target.attackPhase = null;
        model.grapple = createGrappleRuntime(actorKey, targetKey, 'finisher');
      }
      return started;
    }
    if (target.state === 'downed' && distance(actor.position, target.position) <= 1.7) return startPin(actor, target);
    const nearCorner = Math.abs(actor.position.x) > 4.35 && Math.abs(actor.position.z) > 2.95;
    if (nearCorner) {
      actor.state = 'climbing'; actor.stateElapsed = 0; actor.velocity = { x: 0, z: 0 };
      if (!model.physicsAuthority) actor.position = { x: Math.sign(actor.position.x) * 5.25, z: Math.sign(actor.position.z) * 3.7 };
      model.announcement = 'TURNBUCKLE CLIMB — F TO FLY!'; model.announcementTimer = 1.4;
      return true;
    }
    const nearXApron = Math.abs(actor.position.x) > 5.05 && Math.abs(actor.position.x) < 6.9 && Math.abs(actor.position.z) < 4.4;
    const nearZApron = Math.abs(actor.position.z) > 3.55 && Math.abs(actor.position.z) < 5.6 && Math.abs(actor.position.x) < 5.9;
    if (nearXApron || nearZApron) {
      const inside = Math.abs(actor.position.x) <= 5.8 && Math.abs(actor.position.z) <= 4.3;
      if (!model.physicsAuthority) {
        if (nearXApron) actor.position.x = Math.sign(actor.position.x) * (inside ? 6.45 : 5.05);
        else actor.position.z = Math.sign(actor.position.z) * (inside ? 5.05 : 3.55);
      }
      actor.velocity = { x: 0, z: 0 }; actor.state = 'locomotion'; actor.invulnerability = .35;
      model.announcement = inside ? 'THROUGH THE ROPES — RINGSIDE!' : 'BACK BETWEEN THE ROPES!'; model.announcementTimer = 1.15;
      return true;
    }
    return false;
  }
  if (command === 'quick') {
    const moveId = target.state === 'downed' ? 'ground' : actor.comboStep % 2 === 0 ? 'jab' : 'combo';
    const started = startMove(actor, target, getMove(moveId));
    if (started) actor.comboStep += 1;
    return started;
  }
  if (command === 'heavy') {
    const moving = Math.hypot(direction.x, direction.z) > .38;
    return startMove(actor, target, getMove(actor.heldPropId ? 'prop' : actor.ropeRebound > 0 || Math.hypot(actor.velocity.x, actor.velocity.z) > 3.6 ? 'stiff_arm' : moving ? 'front_kick' : 'heavy'));
  }
  if (Math.hypot(actor.velocity.x, actor.velocity.z) > 3.75 && target.state !== 'downed') return startMove(actor, target, getMove('spear'));
  if (target.state === 'blocking') {
    target.stamina = clamp(target.stamina - BALANCE.block.grappleStaminaCost, 0, target.staminaCap);
    if (target.stamina > 0) {
      actor.state = 'staggered'; actor.stateElapsed = 0; actor.velocity = scale(normalize({ x: actor.position.x - target.position.x, z: actor.position.z - target.position.z }), 1.5);
      model.announcement = 'GRAPPLE STUFFED!'; model.announcementTimer = .9;
      model.hype = clamp(model.hype + 7, 0, 100); addImpact(model, target.position, 'blocked', 1);
      return true;
    }
    target.state = 'staggered'; target.stateElapsed = -BALANCE.block.guardBreakStagger;
    model.announcement = 'GUARD BROKEN — GRAPPLE!'; model.announcementTimer = .9;
  }
  const moveId = selectDirectionalGrapple(direction, 'grapple');
  const started = startMove(actor, target, getMove(moveId));
  if (started) {
    actor.comboStep += 1; target.state = model.physicsAuthority ? 'staggered' : 'grabbed'; target.stateElapsed = 0; target.velocity = scale(target.velocity, .3);
    target.moveId = null; target.attackPhase = null;
    model.grapple = createGrappleRuntime(actorKey, targetKey, moveId);
    model.announcement = `GRAPPLE LOCK — ${getMove(moveId).displayName.toUpperCase()}`; model.announcementTimer = .65;
  }
  return started;
};

const scoreGrade = (hype: number): MatchResult['grade'] => hype >= 90 ? 'S' : hype >= 72 ? 'A' : hype >= 52 ? 'B' : hype >= 32 ? 'C' : 'D';
const strongestHighlight = (moments: readonly HighlightMoment[], predicate: (moment: HighlightMoment) => boolean): HighlightMoment | null => {
  const candidates = moments.filter(predicate);
  return candidates.reduce<HighlightMoment | null>((best, moment) => !best || moment.score > best.score ? moment : best, null);
};

const summarizeHighlights = (moments: readonly HighlightMoment[]): MatchHighlights => ({
  ...EMPTY_HIGHLIGHTS(),
  bestSpot: strongestHighlight(moments, () => true),
  bestSlam: strongestHighlight(moments, (moment) => moment.kind === 'slam' || moment.kind === 'table'),
  mostBrutalImpact: strongestHighlight(moments, (moment) => moment.kind !== 'reversal'),
  mostUnexpectedReversal: strongestHighlight(moments, (moment) => moment.kind === 'reversal'),
});

const resolveMatch = (model: MatchModel, winner: 'player' | 'opponent', method: MatchResult['method']): void => {
  if (model.resolved) return;
  model.resolved = true;
  model[winner].state = 'victorious';
  model[winner === 'player' ? 'opponent' : 'player'].state = 'defeated';
  model.result = { winner, method, duration: model.elapsed, hype: model.hype, grade: scoreGrade(model.hype), playerStats: { ...model.playerStats }, highlights: summarizeHighlights(model.highlights) };
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

const updateFighter = (model: MatchModel, actorKey: 'player' | 'opponent', dt: number, movement: Vec2, run: boolean, blockingHeld: boolean): void => {
  const actor = model[actorKey];
  const target = actorKey === 'player' ? model.opponent : model.player;
  const definition = fighterById(actor.definitionId);
  actor.stateElapsed += dt;
  actor.invulnerability = Math.max(0, actor.invulnerability - dt);
  actor.ropeRebound = Math.max(0, actor.ropeRebound - dt);
  const landing = stepBodyDynamics(actor, dt);
  if (landing.landed && landing.landingEnergy > 2.2) {
    addImpact(model, actor.position, 'grapple', clamp(landing.landingEnergy / 7, .55, 1.8), {
      region: 'chest', force: landing.landingEnergy, outcome: 'fall',
    });
  }
  if (landing.landed && actor.state === 'airborne') {
    actor.state = 'downed'; actor.stateElapsed = 0;
    actor.downTimer = Math.max(actor.downTimer, 1.25 + (100 - actor.health) / 90);
  }

  if (actor.state === 'climbing') {
    actor.velocity = scale(actor.velocity, Math.exp(-dt * 12));
    actor.stamina = clamp(actor.stamina + dt * 4, 0, actor.staminaCap);
    actor.facing = Math.atan2(target.position.x - actor.position.x, target.position.z - actor.position.z);
    return;
  }

  if (actor.state === 'grabbed') {
    const holding = model.grapple?.defender === actorKey && model.grapple.attacker !== actorKey;
    if (!holding) {
      actor.state = 'idle'; actor.stateElapsed = 0;
    } else {
      actor.stamina = clamp(actor.stamina + dt * 3.2, 0, actor.staminaCap);
      actor.position.x += actor.velocity.x * dt;
      actor.position.z += actor.velocity.z * dt;
      actor.velocity = scale(actor.velocity, Math.exp(-dt * 1.2));
      return;
    }
  }

  if (actor.state === 'airborne' && actor.body.verticalOffset <= .001 && actor.body.verticalVelocity <= .01) {
    actor.state = 'downed'; actor.stateElapsed = 0;
    actor.downTimer = Math.max(actor.downTimer, 1.25 + (100 - actor.health) / 90);
  }
  if (actor.state === 'jumping' && actor.body.verticalOffset <= .001 && actor.body.verticalVelocity <= .01 && actor.stateElapsed > .12) {
    actor.state = 'idle'; actor.stateElapsed = 0;
  }
  if (actor.state === 'downed') {
    actor.downTimer -= dt; actor.stamina = clamp(actor.stamina + dt * 10, 0, actor.staminaCap);
    if (actor.downTimer <= 0) { actor.state = 'recovering'; actor.stateElapsed = 0; }
  } else if (actor.state === 'recovering' && actor.stateElapsed > .7) {
    actor.state = 'idle'; actor.stateElapsed = 0; actor.finisherPrimed = false;
  } else if (actor.state === 'staggered' && actor.stateElapsed > .42 + (100 - actor.health) / 240) {
    actor.state = 'idle'; actor.stateElapsed = 0;
  }

  if (blockingHeld && ['idle', 'locomotion', 'blocking'].includes(actor.state) && actor.stamina > 0) {
    actor.state = 'blocking'; actor.velocity = scale(actor.velocity, Math.exp(-dt * 12));
    actor.stamina = clamp(actor.stamina - dt * BALANCE.block.holdDrainPerSecond, 0, actor.staminaCap);
    if (actor.stamina <= 0) {
      actor.state = 'staggered'; actor.stateElapsed = -BALANCE.block.guardBreakStagger;
      model.announcement = 'GUARD EXHAUSTED!'; model.announcementTimer = .8;
    }
  } else if (actor.state === 'blocking') {
    actor.state = 'idle'; actor.stateElapsed = 0;
  }

  if (actor.moveId) {
    const move = getMove(actor.moveId);
    const waitingForPhysicalGrip = model.physicsAuthority && actor.attackPhase === 'anticipation' && (move.category === 'grapple' || move.category === 'finisher') && model.grapple?.attacker === actorKey && (model.grapple.phase === 'reach' || model.grapple.phase === 'acquire') && model.grapple.gripCount < 2;
    actor.phaseElapsed = waitingForPhysicalGrip ? Math.min(actor.phaseElapsed + dt, move.anticipationDuration * .46) : actor.phaseElapsed + dt;
    actor.attackPhase = getAttackPhase(move, actor.phaseElapsed);
    if (move.category === 'aerial' && actor.phaseElapsed > move.anticipationDuration * .22) {
      const chase = normalize({ x: target.position.x - actor.position.x, z: target.position.z - actor.position.z });
      actor.velocity.x += chase.x * dt * 6.5;
      actor.velocity.z += chase.z * dt * 6.5;
    }
    if (actor.attackPhase === 'active' && !model.physicsAuthority) applyMoveHit(model, actorKey, actorKey === 'player' ? 'opponent' : 'player', move);
    if (!actor.attackPhase) {
      if (model.grapple?.attacker === actorKey) releaseGrapple(model, 'idle');
      actor.moveId = null; actor.state = 'idle'; actor.stateElapsed = 0; actor.finisherPrimed = false;
    }
  }

  const canMove = ['idle', 'locomotion'].includes(actor.state);
  const inputLength = Math.hypot(movement.x, movement.z);
  if (canMove) {
    const running = run && actor.stamina > 3 && inputLength > .08;
    integrateLocomotion(actor, definition, movement, running, dt);
    actor.state = inputLength > .08 ? 'locomotion' : 'idle';
    if (running) actor.stamina = clamp(actor.stamina - dt * 8, 0, actor.staminaCap);
    else actor.stamina = clamp(actor.stamina + dt * (inputLength > .08 ? 8 : 13), 0, actor.staminaCap);
  } else {
    const drag = actor.state === 'downed' || actor.state === 'airborne' ? 1.35 : 4.2;
    actor.velocity = scale(actor.velocity, Math.exp(-dt * drag));
  }

  if (!model.physicsAuthority) {
    actor.position.x += actor.velocity.x * dt;
    actor.position.z += actor.velocity.z * dt;
  }
  const ropeX = 5.65; const ropeZ = 4.15;
  const outside = Math.abs(actor.position.x) > ropeX + .2 || Math.abs(actor.position.z) > ropeZ + .2;
  const impactSpeed = Math.hypot(actor.velocity.x, actor.velocity.z);
  const deliberateRingOut = (actor.state === 'downed' || actor.state === 'staggered') && impactSpeed > 2.7;
  const rebound = model.chaosEvent?.type === 'OVERDRIVE ROPES' ? 1.18 : .88;
  if (!model.physicsAuthority && !outside && !deliberateRingOut && Math.abs(actor.position.x) > ropeX) {
    actor.position.x = Math.sign(actor.position.x) * ropeX; actor.velocity.x *= -rebound;
    actor.body.sideVelocity += Math.sign(actor.position.x) * impactSpeed * .055;
    actor.body.balance = clamp(actor.body.balance - impactSpeed * .9, 0, 100);
    if (actor.ropeRebound <= 0) addImpact(model, actor.position, 'rope', .55, { force: impactSpeed * actor.body.mass / 100, outcome: 'absorbed' });
    actor.ropeRebound = 1.1;
  }
  if (!model.physicsAuthority && !outside && !deliberateRingOut && Math.abs(actor.position.z) > ropeZ) {
    actor.position.z = Math.sign(actor.position.z) * ropeZ; actor.velocity.z *= -rebound;
    actor.body.leanVelocity += Math.sign(actor.position.z) * impactSpeed * .045;
    actor.body.balance = clamp(actor.body.balance - impactSpeed * .9, 0, 100);
    if (actor.ropeRebound <= 0) addImpact(model, actor.position, 'rope', .55, { force: impactSpeed * actor.body.mass / 100, outcome: 'absorbed' });
    actor.ropeRebound = 1.1;
  }
  actor.position.x = clamp(actor.position.x, -9.2, 9.2);
  actor.position.z = clamp(actor.position.z, -8.2, 8.2);
  if (actor.state === 'idle' && inputLength <= .08) {
    const desiredFacing = Math.atan2(target.position.x - actor.position.x, target.position.z - actor.position.z);
    const turn = Math.atan2(Math.sin(desiredFacing - actor.facing), Math.cos(desiredFacing - actor.facing));
    actor.facing += clamp(turn, -dt * 2.4, dt * 2.4);
  }
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
  if (type === 'PROP DROP') model.props.push({ id: `chair-${model.impactSequence + 9}`, kind: roll > .5 ? 'chair' : 'sign', position: { x: (roll - .5) * 8, z: -5.6 }, durability: 2, stress: 0, failureStage: 'intact', heldBy: null, broken: false });
};

const replayFighterFrame = (fighter: FighterRuntime): ReplayFighterFrame => ({
  position: { ...fighter.position },
  facing: fighter.facing,
  verticalOffset: fighter.body.verticalOffset,
  leanForward: fighter.body.leanForward,
  leanSide: fighter.body.leanSide,
  state: fighter.state,
  moveId: fighter.moveId,
});

const sampleReplay = (model: MatchModel, dt: number): void => {
  model.replaySampleTimer += dt;
  if (model.replaySampleTimer < 1 / 15) return;
  model.replaySampleTimer %= 1 / 15;
  model.replayFrames.push({ time: model.elapsed, player: replayFighterFrame(model.player), opponent: replayFighterFrame(model.opponent) });
  if (model.replayFrames.length > 75) model.replayFrames.splice(0, model.replayFrames.length - 75);
};

export const advanceMatch = (model: MatchModel, dt: number, playerInput: FrameInput): MatchModel => {
  if (model.paused || model.resolved) return model;
  if (model.hitStop > 0) { model.hitStop = Math.max(0, model.hitStop - dt); return model; }
  const step = dt * (model.slowMotion > 0 ? .36 : 1); model.slowMotion = Math.max(0, model.slowMotion - dt);
  model.elapsed += step; model.announcementTimer = Math.max(0, model.announcementTimer - step); if (model.announcementTimer === 0) model.announcement = null;
  updateChaos(model, step);
  updatePin(model, step, playerInput);
  if (model.player.state === 'pinned' || model.opponent.state === 'pinned') return model;

  if (playerInput.block) requestCommand(model, 'player', 'block', playerInput.move);
  for (const command of playerInput.commands) requestCommand(model, 'player', command, playerInput.move);
  model.aiBlockTimer = Math.max(0, model.aiBlockTimer - step);
  model.aiThinkTimer -= step;
  let aiMove: Vec2 = { ...model.aiMovement }; let aiRun = model.aiRunning;
  if (model.labMode) {
    aiMove = { x: 0, z: 0 }; aiRun = false; model.aiIntent = null; model.aiBlockTimer = 0;
  } else if (model.aiThinkTimer <= 0) {
    const decision = chooseAiDecision(model, fighterById(model.opponent.definitionId));
    model.seed = decision.nextSeed; model.aiIntent = decision.command; aiMove = decision.move; aiRun = decision.run;
    model.aiThinkTimer = model.difficulty === 'hard' ? .22 : .38;
    if (decision.command) {
      requestCommand(model, 'opponent', decision.command, decision.move);
      if (decision.command === 'block') model.aiBlockTimer = model.difficulty === 'hard' ? .72 : .48;
    }
  }
  model.aiMovement = { ...aiMove }; model.aiRunning = aiRun;
  const grappleStep = model.physicsAuthority ? { broken: false, liftEnergy: 0 } : stepGrappleDynamics(model, step, playerInput.move, aiMove);
  if (grappleStep.broken) {
    releaseGrapple(model, 'staggered');
    model.announcement = 'GRIP BROKEN — SCRAMBLE!'; model.announcementTimer = .9;
    model.hype = clamp(model.hype + 4, 0, 100);
  }
  updateFighter(model, 'player', step, playerInput.move, playerInput.run, playerInput.block);
  updateFighter(model, 'opponent', step, aiMove, aiRun, model.aiBlockTimer > 0);
  sampleReplay(model, step);
  const playerThreat = model.opponent.moveId ? getMove(model.opponent.moveId) : null;
  model.player.counterWindow = playerThreat?.counterWindow && model.opponent.attackPhase === 'anticipation' && distance(model.player.position, model.opponent.position) < playerThreat.maximumRange + .3 && model.opponent.phaseElapsed >= playerThreat.counterWindow[0] && model.opponent.phaseElapsed <= playerThreat.counterWindow[1] ? .1 : 0;
  const opponentThreat = model.player.moveId ? getMove(model.player.moveId) : null;
  model.opponent.counterWindow = opponentThreat?.counterWindow && model.player.attackPhase === 'anticipation' && distance(model.player.position, model.opponent.position) < opponentThreat.maximumRange + .3 && model.player.phaseElapsed >= opponentThreat.counterWindow[0] && model.player.phaseElapsed <= opponentThreat.counterWindow[1] ? .1 : 0;
  return model;
};

const expectedContactSegment = (move: MoveDefinition, segment: string): boolean => {
  if (move.category === 'aerial' || move.id === 'ground' || move.id === 'front_kick') return segment.includes('Foot') || segment.includes('Shin') || segment.includes('chest');
  if (move.id === 'rebound' || move.id === 'stiff_arm') return segment.includes('Hand') || segment.includes('UpperArm') || segment === 'chest';
  if (move.id === 'spear') return segment === 'chest' || segment.includes('UpperArm');
  if (move.category === 'quick' || move.category === 'heavy' || move.category === 'prop' || move.id === 'counter') return segment.includes('Hand');
  return move.category === 'grapple' || move.category === 'finisher';
};

const applyPhysicalTableStress = (model: MatchModel, contact: BodyWorksContact, move: MoveDefinition): void => {
  if (!contact.isLanding || contact.targetSurface !== 'table') return;
  const table = model.props.find((prop) => prop.kind === 'table' && !prop.broken); if (!table) return;
  const addedStress = contact.maximumForce * .38 + contact.relativeSpeed * 7 + (move.category === 'finisher' ? 20 : 0);
  table.stress = Math.round((table.stress + addedStress) * 10) / 10;
  const nextStage = table.stress >= 82 ? 'failed' : table.stress >= 50 ? 'cracked' : table.stress >= 24 ? 'stressed' : 'intact';
  if (nextStage === table.failureStage) return;
  table.failureStage = nextStage;
  if (nextStage === 'failed') {
    table.broken = true; model.hype = clamp(model.hype + 28, 0, 100);
    addImpact(model, table.position, 'table', 2.1, { force: contact.maximumForce, outcome: 'fall', highlight: { label: 'Commentary Desk Collapse', score: Math.round(table.stress + move.hypeValue + 24), kind: 'table' } });
    model.announcement = 'COMMENTARY DESK — WRECKED!'; model.announcementTimer = 2;
  } else {
    model.hype = clamp(model.hype + (nextStage === 'cracked' ? 12 : 5), 0, 100);
    model.announcement = nextStage === 'cracked' ? 'COMMENTARY DESK — CRACKING!' : 'DESK BUCKLES UNDER THE IMPACT!'; model.announcementTimer = 1.25;
  }
};

export const applyPhysicalContact = (model: MatchModel, contact: BodyWorksContact): boolean => {
  if (!model.physicsAuthority || !contact.sourceFighter || !contact.targetFighter || contact.sourceFighter === contact.targetFighter || contact.attackInstanceId === null || !contact.sourceSegment) return false;
  const actor = model[contact.sourceFighter];
  const moveId = contact.moveId ?? actor.moveId;
  if (actor.attackInstanceId !== contact.attackInstanceId || !moveId) return false;
  const move = getMove(moveId);
  if ((move.category === 'grapple' || move.category === 'finisher') && !contact.isLanding) return false;
  const legalContactPhase = actor.attackPhase === 'active' || (contact.isLanding && (move.category === 'grapple' || move.category === 'finisher'));
  if (!legalContactPhase) return false;
  if (!expectedContactSegment(move, contact.sourceSegment) || contact.relativeSpeed < .28 && contact.maximumForce < 45) return false;
  const applied = applyMoveHit(model, contact.sourceFighter, contact.targetFighter, move, contact);
  if (applied) applyPhysicalTableStress(model, contact, move);
  return applied;
};
