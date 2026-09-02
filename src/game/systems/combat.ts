import { FIGHTERS, fighterById } from '../data/fighters';
import { getMove } from '../data/moves';
import { BALANCE } from '../data/balance';
import { chooseAiDecision, isActionLegal } from '../ai/utilityAI';
import { applyLocalizedImpact, calculateImpact, createBodyDynamics, integrateLocomotion, stepBodyDynamics } from '../physics/bodyDynamics';
import { createGrappleRuntime, releaseGrapple, retargetGrapple, stepGrappleDynamics } from '../physics/grappleDynamics';
import { clamp, distance, normalize, scale, seededRandom } from '../utils/math';
import { AI_FIGHTER_SLOTS, FIGHTER_SLOTS } from '../types/game';
import type { Difficulty, FighterId, FighterRuntime, FighterSlot, GameCommand, HighlightMoment, ImpactEvent, MatchHighlights, MatchMode, MatchModel, MatchResult, MatchStats, MoveDefinition, PropRuntime, ReplayFighterFrame, Ruleset, Vec2 } from '../types/game';
import type { BodyWorksContact } from '../physics/physicsRuntime';
import { VOLT_DOME } from '../data/arena';
import { actionDirectionToVec2, actionToGameCommand, createActionEvent, gameCommandToAction } from '../input/actionLayer';
import { auditFallState, beginFall } from './falls';
import { FALL_REASONS } from '../types/game';
import type { ActionEvent } from '../input/actionLayer';
import { canTraverseRopes, resolveContextAction, resolvePropAction } from './contextResolver';
import { GRAPPLE_ACQUISITION_RANGE, selectDirectionalGrapple, selectDirectionalStrike, selectGrappleEntryMove } from './moveSelection';

export { combatDirection, selectDirectionalGrapple, selectDirectionalStrike } from './moveSelection';
export type { CombatDirection, GrappleButton, StrikeButton } from './moveSelection';

export interface FrameInput {
  move: Vec2;
  run: boolean;
  block: boolean;
  actions?: readonly ActionEvent[];
  /** Temporary compatibility for deterministic legacy simulations while they migrate to ActionEvent. */
  commands?: readonly GameCommand[];
  targetCycle?: number;
}

export const commandsForInput = (input: FrameInput): readonly GameCommand[] => [
  ...(input.commands ?? []),
  ...(input.actions ?? [])
    .filter((event) => event.phase === 'started')
    .map((event) => actionToGameCommand(event.action))
    .filter((command): command is GameCommand => command !== null),
];
const EMPTY_STATS = (): MatchStats => ({ damageDealt: 0, counters: 0, grapples: 0, finishers: 0, nearFalls: 0, propImpacts: 0 });
const EMPTY_HIGHLIGHTS = (): MatchHighlights => ({ bestSpot: null, bestSlam: null, mostBrutalImpact: null, mostUnexpectedReversal: null });
const BATTLE_ROYALE_OPENING_BELL_SECONDS = 4.2;
const PHYSICAL_CONTACT_HANDOFF_SECONDS = .075;
const PERFECT_PARRY_WINDOW_SECONDS = .08;

const contactCapturedDuringActiveWindow = (model: MatchModel, contact: BodyWorksContact): boolean => {
  const contactAge = model.elapsed - contact.time;
  return contact.attackPhaseAtContact === 'active' && contactAge >= -1e-6 && contactAge <= PHYSICAL_CONTACT_HANDOFF_SECONDS;
};

export const createFighterRuntime = (definitionId: FighterId, position: Vec2, beersDrunk = 0): FighterRuntime => {
  const definition = fighterById(definitionId);
  const beers = clamp(Math.round(beersDrunk), 0, BALANCE.stamina.beersPerFighter);
  const staminaCap = Math.round((BALANCE.stamina.baseCap + definition.stats.stamina * BALANCE.stamina.statScale + beers * BALANCE.stamina.beerCapBoost) * 10) / 10;
  return ({
  definitionId, position, velocity: { x: 0, z: 0 }, facing: 0, health: 100, stamina: staminaCap, staminaCap, beersDrunk: beers, momentum: 0,
  state: 'idle', moveId: null, attackPhase: null, phaseElapsed: 0, stateElapsed: 0, hitTargets: [], attackInstanceId: 0, downTimer: 0,
  counterWindow: 0, invulnerability: 0, pinCount: 0, pinEscape: 0, heldPropId: null, comboStep: 0, recentMoves: [],
  lastActionAt: 0, ropeRebound: 0, finisherPrimed: false, climbStage: 0, recoveryOrientation: 'back',
  fallReason: null, lastFallReason: null, fallSequence: 0,
  body: createBodyDynamics(definition),
  });
};

const initialProps = (enabled: boolean): PropRuntime[] => enabled ? [
  { id: 'chair-1', kind: 'chair', position: { x: -7.1, z: 2.8 }, durability: 3, stress: 0, failureStage: 'intact', heldBy: null, broken: false },
  { id: 'sign-1', kind: 'sign', position: { x: 7, z: -2.4 }, durability: 2, stress: 0, failureStage: 'intact', heldBy: null, broken: false },
  { id: 'trash-1', kind: 'trash', position: { x: 8.35, z: 5.5 }, durability: 4, stress: 0, failureStage: 'intact', heldBy: null, broken: false },
  { id: 'bell-1', kind: 'bell', position: { x: 4.9, z: -5.25 }, durability: 2, stress: 0, failureStage: 'intact', heldBy: null, broken: false },
  { id: 'table-1', kind: 'table', position: { x: VOLT_DOME.commentaryTable.x, z: VOLT_DOME.commentaryTable.z }, durability: 1, stress: 0, failureStage: 'intact', heldBy: null, broken: false },
] : [{ id: 'table-1', kind: 'table', position: { x: VOLT_DOME.commentaryTable.x, z: VOLT_DOME.commentaryTable.z }, durability: 1, stress: 0, failureStage: 'intact', heldBy: null, broken: false }];

export const createMatch = (playerId: FighterId, opponentId: FighterId, ruleset: Ruleset, difficulty: Difficulty, seed = 1337, playerBeers = 0, opponentBeers = 0, matchMode: MatchMode = 'singles'): MatchModel => {
  const resolvedOpponentId = matchMode === 'battle_royale' && opponentId === playerId ? FIGHTERS.find(({ id }) => id !== playerId)?.id ?? opponentId : opponentId;
  const remaining = FIGHTERS.map(({ id }) => id).filter((id) => id !== playerId && id !== resolvedOpponentId);
  const rivalIds = [remaining[0] ?? 'vex', remaining[1] ?? 'brick', remaining[2] ?? 'chad'] as const;
  const playerStats = EMPTY_STATS(); const opponentStats = EMPTY_STATS();
  const fighterStats: Record<FighterSlot, MatchStats> = { player: playerStats, opponent: opponentStats, rival1: EMPTY_STATS(), rival2: EMPTY_STATS(), rival3: EMPTY_STATS() };
  const props = initialProps(ruleset === 'chaos'); const propsById = Object.fromEntries(props.map((p) => [p.id, p]));
  return {
    toyTestMode: false, labMode: false, matchMode, ruleset, difficulty, elapsed: 0, paused: false, physicsAuthority: false, networkAuthority: false, resolved: false,
    player: createFighterRuntime(playerId, { x: -3.25, z: 0 }, playerBeers), opponent: createFighterRuntime(resolvedOpponentId, { x: 3.25, z: 0 }, opponentBeers),
    rival1: createFighterRuntime(rivalIds[0], { x: 0, z: -2.45 }), rival2: createFighterRuntime(rivalIds[1], { x: -1.85, z: 2.35 }), rival3: createFighterRuntime(rivalIds[2], { x: 1.85, z: 2.35 }),
    targets: { player: 'opponent', opponent: 'player', rival1: 'rival3', rival2: 'rival1', rival3: 'rival2' }, playerTargetLock: 0, eliminations: [], falls: [], fallSequence: 0, unstableWithoutCauseSeconds: 0,
    hype: 8, props, propsById, chaosEvent: null, nextChaosAt: 38, lastImpact: null, impactSequence: 0,
    announcement: matchMode === 'battle_royale' ? 'BATTLE ROYALE — TOTAL FREE FOR ALL!' : 'ROUND ONE — FIGHT!', announcementTimer: 2.2, hitStop: 0, slowMotion: 0, result: null,
    playerStats, opponentStats, fighterStats, aiThinkTimer: .35, aiIntent: null, aiMovement: { x: 0, z: 0 }, aiRunning: false, aiBlockTimer: 0,
    aiControllers: Object.fromEntries(AI_FIGHTER_SLOTS.map((slot, index) => [slot, { thinkTimer: .24 + index * .07, intent: null, movement: { x: 0, z: 0 }, running: false, blockTimer: 0 }])) as MatchModel['aiControllers'],
    grapple: null, replayFrames: [], replaySampleTimer: 0, highlights: [], runtimeId: seed, seed,
  };
};

export const activeFighterSlots = (model: MatchModel): readonly FighterSlot[] => model.matchMode === 'battle_royale' ? FIGHTER_SLOTS : ['player', 'opponent'];

export const targetSlotFor = (model: MatchModel, actor: FighterSlot): FighterSlot => model.targets[actor];

export const cyclePlayerTarget = (model: MatchModel, direction = 1): boolean => {
  if (model.matchMode !== 'battle_royale' || model.resolved || ['defeated', 'victorious'].includes(model.player.state)) return false;
  const candidates = FIGHTER_SLOTS.filter((slot) => slot !== 'player' && !['defeated', 'victorious'].includes(model[slot].state));
  if (candidates.length === 0) return false;
  const currentIndex = candidates.indexOf(model.targets.player);
  const step = direction < 0 ? -1 : 1;
  const nextIndex = currentIndex < 0 ? (step < 0 ? candidates.length - 1 : 0) : (currentIndex + step + candidates.length) % candidates.length;
  const nextTarget = candidates[nextIndex];
  if (!nextTarget) return false;
  model.targets.player = nextTarget;
  model.playerTargetLock = 5;
  model.announcement = `TARGET LOCK — ${fighterById(model[nextTarget].definitionId).name}`;
  model.announcementTimer = 1.05;
  return true;
};

export const resetTransientState = (model: MatchModel): MatchModel => {
  const reset = createMatch(model.player.definitionId, model.opponent.definitionId, model.ruleset, model.difficulty, model.seed + 97, model.player.beersDrunk, model.opponent.beersDrunk, model.matchMode);
  reset.labMode = model.labMode; reset.toyTestMode = model.toyTestMode; return reset;
};

export const getAttackPhase = (move: MoveDefinition, elapsed: number): 'anticipation' | 'active' | 'recovery' | null => {
  if (elapsed < move.anticipationDuration) return 'anticipation';
  if (elapsed < move.anticipationDuration + move.activeDuration) return 'active';
  if (elapsed < move.anticipationDuration + move.activeDuration + move.recoveryDuration) return 'recovery';
  return null;
};

export const canStartMove = (actor: FighterRuntime, target: FighterRuntime, move: MoveDefinition): boolean => {
  const targetDistance = distance(actor.position, target.position);
  // Keep a small input-sampling envelope for a fighter already stepping into
  // range. It only admits the motion task; damage still requires Rapier limb
  // contact during the active phase.
  // A raised physical guard holds gloves/forearms in front of the torso and
  // can separate the two centres before a punch starts. Admit that reachable
  // glove-to-glove lane without widening ordinary body-hit range.
  const strikeReachAssist = target.state === 'blocking' && (move.category === 'quick' || move.category === 'heavy') ? 1.3
    : ['quick', 'heavy', 'ground', 'prop'].includes(move.category) ? .12 : 0;
  const maximumInputRange = move.category === 'grapple' ? Math.max(move.maximumRange, GRAPPLE_ACQUISITION_RANGE) : move.maximumRange + strikeReachAssist;
  // Strikes always author their complete motion. Distance decides whether the
  // active limb can meet a collider; it must never decide whether a button
  // press animates at all. Grapples, finishers, aerials, and contextual utility
  // actions still require their real acquisition/workflow range.
  const motionCanWhiff = ['quick', 'heavy', 'ground', 'prop'].includes(move.category);
  return move.requiredActorStates.includes(actor.state)
    && actor.stamina >= move.staminaCost
    && (motionCanWhiff || targetDistance >= move.minimumRange)
    && (motionCanWhiff || targetDistance <= maximumInputRange)
    && (motionCanWhiff || !move.requiredTargetStates || move.requiredTargetStates.includes(target.state));
};

export const startMove = (actor: FighterRuntime, target: FighterRuntime, move: MoveDefinition): boolean => {
  if (!canStartMove(actor, target, move)) return false;
  const turnbuckleTaunt = actor.state === 'climbing' && move.id === 'taunt';
  actor.state = move.category === 'grapple' ? 'grappling' : turnbuckleTaunt ? 'climbing' : 'attacking';
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
  moveId?: string;
  sourceFighter?: FighterSlot;
  targetFighter?: FighterSlot;
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
    moveId: metadata.moveId,
    sourceFighter: metadata.sourceFighter,
    targetFighter: metadata.targetFighter,
  };
  if (metadata.highlight) {
    model.highlights = [...model.highlights.slice(-23), {
      impactId: model.impactSequence,
      time: model.elapsed,
      ...metadata.highlight,
    }];
  }
  model.hitStop = Math.max(model.hitStop, intensity * .09);
};

const varietyMultiplier = (actor: FighterRuntime, moveId: string): number => {
  const repeats = actor.recentMoves.filter((recent) => recent === moveId).length;
  return repeats === 0 ? 1 : repeats === 1 ? .55 : .12;
};

export const applyMoveHit = (model: MatchModel, actorKey: FighterSlot, targetKey: FighterSlot, move: MoveDefinition, contact?: BodyWorksContact): boolean => {
  const actor = model[actorKey];
  const target = model[targetKey];
  const targetPreHealth = target.health;
  const inSingles = model.matchMode === 'singles';
  const isComboFinisher = inSingles && actor.comboStep >= 2 && (move.category === 'heavy' || move.category === 'grapple' || move.category === 'prop' || move.category === 'aerial');
  if (['defeated', 'victorious'].includes(actor.state) || ['defeated', 'victorious'].includes(target.state)) return false;
  const impactPosition = contact?.point ? { x: contact.point[0], z: contact.point[2] } : target.position;
  const hitToken = contact ? `${targetKey}:${actor.attackInstanceId}` : targetKey;
  const isPhysicalLanding = contact?.isLanding === true && (move.category === 'grapple' || move.category === 'finisher');
  // Physics and rules publish on adjacent fixed-step boundaries. Preserve the
  // phase stamped by the solved manifold so a real last-active-frame contact
  // is not discarded merely because the rules model entered recovery before
  // React consumed it. The attack instance and bounded age are revalidated in
  // applyPhysicalContact before this path can score.
  const capturedActiveContact = contact ? contactCapturedDuringActiveWindow(model, contact) : false;
  if ((!isPhysicalLanding && actor.attackPhase !== 'active' && !capturedActiveContact) || (!move.multiHit && actor.hitTargets.includes(hitToken))) return false;
  if (target.invulnerability > 0 || (!contact && distance(actor.position, target.position) > move.maximumRange + .4)) return false;

  const targetDefinition = fighterById(target.definitionId);
  const actorDefinition = fighterById(actor.definitionId);
  const majorImpactMove = move.category === 'finisher' || move.category === 'heavy' || move.category === 'grapple' || move.category === 'prop' || move.category === 'aerial';
  const contactQuality = contact ? clamp(contact.relativeSpeed * .22 + contact.maximumForce / 950, .28, 1.35) : 1;
  const actorClutch = inSingles && actor.health < 35;
  const clutchDamageMultiplier = actorClutch ? 1.15 : 1.0;
  let comboDamageMultiplier = 1.0;
  if (inSingles && actor.comboStep >= 2) {
    if (move.category === 'quick') {
      comboDamageMultiplier = 1.0 + Math.min(0.5, (actor.comboStep - 1) * 0.1);
    } else if (isComboFinisher) {
      comboDamageMultiplier = 1.2;
    }
  }
  const scaledDamage = move.damage * BALANCE.damageScale * (.78 + actorDefinition.stats.power / 250) * (1.08 - targetDefinition.stats.stamina / 900) * contactQuality * clutchDamageMultiplier * comboDamageMultiplier;
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
    const isPerfectParry = inSingles && target.stateElapsed <= PERFECT_PARRY_WINDOW_SECONDS && move.category !== 'aerial';
    if (isPerfectParry) {
      actor.hitTargets.push(hitToken);
      actor.state = 'staggered'; actor.stateElapsed = 0; actor.moveId = null; actor.attackPhase = null; actor.climbStage = 0;
      target.momentum = clamp(target.momentum + 15, 0, 100);
      model.hype = clamp(model.hype + 12, 0, 100);
      model.announcement = 'PERFECT PARRY!'; model.announcementTimer = 1.0;
      addImpact(model, impactPosition, 'counter', 1.1, { region: calculatedImpact.region, force: calculatedImpact.force * 0.5, torque: calculatedImpact.torque, outcome: 'stagger', moveId: move.id, sourceFighter: targetKey, targetFighter: actorKey });
      return true;
    }
    if (move.category === 'aerial' && target.stamina > Math.max(6, move.damage * .45)) {
      actor.hitTargets.push(hitToken);
      target.stamina = clamp(target.stamina - Math.max(6, move.damage * .45), 0, target.staminaCap);
      target.state = 'attacking'; target.moveId = 'counter'; target.attackPhase = 'active'; target.phaseElapsed = getMove('counter').anticipationDuration; target.stateElapsed = 0;
      actor.state = 'downed'; actor.stateElapsed = 0; actor.downTimer = 1.1 + (100 - actor.health) / 120; actor.moveId = null; actor.attackPhase = null; actor.climbStage = 0;
      beginFall(model, actorKey, FALL_REASONS.KnockdownMove);
      actor.body.verticalOffset = 0; actor.body.verticalVelocity = 0; actor.recoveryOrientation = 'back';
      model.hype = clamp(model.hype + 12, 0, 100);
      model.announcement = 'BLOCK CATCH!'; model.announcementTimer = .95;
      addImpact(model, impactPosition, 'counter', 1.05, { region: calculatedImpact.region, force: calculatedImpact.force * .84, torque: calculatedImpact.torque, outcome: 'spin', moveId: move.id, sourceFighter: targetKey, targetFighter: actorKey });
      return true;
    }
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
      addImpact(model, impactPosition, 'heavy', 1.15, { region: calculatedImpact.region, force: guardedImpact.force, torque: guardedImpact.torque, outcome: 'stagger', moveId: move.id, sourceFighter: actorKey, targetFighter: targetKey });
    } else {
      addImpact(model, impactPosition, 'blocked', .72, { region: calculatedImpact.region, force: guardedImpact.force, torque: guardedImpact.torque, outcome: 'absorbed', moveId: move.id, sourceFighter: actorKey, targetFighter: targetKey });
    }
    if (!model.toyTestMode && target.health <= 0 && (majorImpactMove || model.matchMode === 'battle_royale')) resolveMatch(model, actorKey, 'KNOCKOUT', targetKey);
    return true;
  }
  if (!model.toyTestMode) target.health = clamp(target.health - damage, 0, 100);
  actor.hitTargets.push(hitToken);
  target.comboStep = 0; // reset opponent combo streak on hit
  const variety = varietyMultiplier(actor, move.id);
  const surge = model.chaosEvent?.type === 'CROWD SURGE' ? 1.6 : 1;
  const stats = model.fighterStats[actorKey];
  if (!model.toyTestMode) {
    const comboMomentumMultiplier = inSingles && actor.comboStep >= 2 && move.category === 'quick'
      ? 1.0 + Math.min(0.6, (actor.comboStep - 1) * 0.15)
      : 1.0;
    actor.momentum = clamp(actor.momentum + move.momentumGain * variety * (model.ruleset === 'chaos' ? 1.2 : 1) * surge * comboMomentumMultiplier, 0, 100);
    model.hype = clamp(model.hype + move.hypeValue * variety * BALANCE.hypeScale, 0, 100);
    actor.recentMoves = [...actor.recentMoves.slice(-4), move.id];
    stats.damageDealt = Math.round((stats.damageDealt + damage) * 10) / 10;
    if (move.category === 'grapple') stats.grapples += 1;
    if (move.category === 'finisher') stats.finishers += 1;
    if (move.category === 'prop') stats.propImpacts += 1;
  }
  if (move.category === 'prop' && (actor.heldPropId || contact?.sourceObjectId)) {
    const propId = actor.heldPropId ?? contact?.sourceObjectId; const prop = propId ? model.propsById[propId] : undefined;
    if (prop) {
      prop.durability -= 1;
      if (prop.durability <= 0) { prop.broken = true; prop.heldBy = null; actor.heldPropId = null; }
    }
  }

  const impact = model.chaosEvent?.type === 'OVERDRIVE ROPES' && actor.ropeRebound > 0
    ? { ...calculatedImpact, force: calculatedImpact.force * 1.18 }
    : calculatedImpact;
  const collisionOutcome = applyLocalizedImpact(target, impact);
  if (move.id === 'stiff_arm' || move.id === 'rebound' || move.id === 'spear') target.recoveryOrientation = 'back';
  const targetForward = { x: Math.sin(target.facing), z: Math.cos(target.facing) }; const targetRight = { x: Math.cos(target.facing), z: -Math.sin(target.facing) };
  const forwardImpact = impact.direction.x * targetForward.x + impact.direction.z * targetForward.z; const sideImpact = impact.direction.x * targetRight.x + impact.direction.z * targetRight.z;
  target.recoveryOrientation = Math.abs(sideImpact) > Math.abs(forwardImpact) * .82 ? sideImpact > 0 ? 'right' : 'left' : forwardImpact > 0 ? 'front' : 'back';
  if (model.grapple && model.grapple.attacker === actorKey) releaseGrapple(model, 'staggered');
  const lowHealthBonus = target.health < 35 ? .28 : 0;
  const physicalFall = ['trip', 'fall', 'launch'].includes(collisionOutcome);
  const guaranteedRunningKnockdown = move.id === 'stiff_arm' || move.id === 'rebound';
  const majorKnockdownMove = move.category === 'grapple' || move.category === 'finisher' || move.category === 'aerial' || move.category === 'prop';
  const balanceBrokenByContact = physicalFall && target.body.balance < 22;
  // Solver force still controls recoil and balance loss, but one unusually
  // energetic hand manifold cannot turn every jab into a knockdown. Routine
  // strikes stay standing until a wrestler is genuinely balance-broken; only
  // authored major offense and high-knockdown moves bypass that requirement.
  const shouldKnockDown = guaranteedRunningKnockdown || majorKnockdownMove || move.knockdownStrength + lowHealthBonus >= .78 || balanceBrokenByContact;
  if (shouldKnockDown) {
    // Pure rules tests and non-WebGL simulations retain a bounded deterministic
    // flight proxy. The shipping match never enters this branch: Rapier owns the
    // victim's height and the contact bridge resolves the real mat landing.
    if (!model.physicsAuthority && (move.category === 'grapple' || move.category === 'finisher')) {
      target.body.verticalOffset = Math.max(target.body.verticalOffset, .34);
      target.body.verticalVelocity = Math.min(target.body.verticalVelocity, -3.1);
    }
    const stillAirborne = target.body.verticalOffset > .08 || Math.abs(target.body.verticalVelocity) > 1.2;
    target.state = stillAirborne ? 'airborne' : 'downed';
    const fallReason = move.category === 'grapple' || move.category === 'finisher' ? FALL_REASONS.Throw
      : move.category === 'prop' ? FALL_REASONS.RopeOrObject
        : guaranteedRunningKnockdown ? FALL_REASONS.KnockdownMove
          : FALL_REASONS.StrikeImpulse;
    beginFall(model, targetKey, fallReason);
    target.stateElapsed = 0;
    target.downTimer = 1.6 + (100 - target.health) / 75 + (move.category === 'finisher' ? 1.2 : 0);
    target.moveId = null;
    target.attackPhase = null;
    target.finisherPrimed = move.category === 'finisher';
    target.climbStage = 0;
  } else {
    target.state = 'staggered';
    target.stateElapsed = 0;
    target.moveId = null;
    target.attackPhase = null;
    target.climbStage = 0;
  }

  const kind: ImpactEvent['kind'] = move.category === 'finisher' ? 'finisher' : move.category === 'prop' ? 'weapon' : move.category === 'grapple' ? 'grapple' : move.category === 'heavy' || move.category === 'aerial' ? 'heavy' : 'light';
  const highlightKind: HighlightMoment['kind'] = move.category === 'grapple' || move.category === 'finisher' ? 'slam'
    : move.category === 'prop' ? 'weapon' : move.category === 'aerial' ? 'aerial' : move.id === 'rebound' ? 'rope' : 'strike';
  const highlightScore = Math.round((impact.force * 4 + move.hypeValue + (collisionOutcome === 'launch' ? 18 : 0) + (move.category === 'finisher' ? 28 : 0)) * 10) / 10;
  addImpact(model, impactPosition, kind, move.category === 'finisher' ? 2.2 : Math.max(.6, move.damage / 13), {
    region: impact.region,
    force: impact.force,
    torque: impact.torque,
    outcome: collisionOutcome,
    highlight: move.category === 'quick' && impact.force < 7 ? undefined : { label: move.category === 'finisher' ? actorDefinition.signature : move.displayName, score: highlightScore, kind: highlightKind },
    moveId: move.id,
    sourceFighter: actorKey,
    targetFighter: targetKey,
  });
  if (move.category === 'quick' || move.category === 'heavy' || move.category === 'grapple' || move.category === 'aerial') {
    // BLOCKBUSTER: Amplified slowMotion values for heavy, aerial, and grapple moves to feel more blockbuster
    model.slowMotion = Math.max(model.slowMotion, move.category === 'quick' ? .10 : move.category === 'heavy' ? .32 : move.category === 'aerial' ? .38 : .42);
  }
  if (move.category === 'finisher') {
    model.slowMotion = 1.25; // BLOCKBUSTER: increased slowMotion for signature moves
    model.announcement = `${actorDefinition.signature}!`;
    model.announcementTimer = 2.1;
  }
  if (move.category === 'aerial') {
    model.slowMotion = Math.max(model.slowMotion, .45);
    model.announcement = move.displayName.toUpperCase() + '!';
    model.announcementTimer = 1.8;
    model.hitStop = Math.max(model.hitStop, .15);
  }
  if (move.category === 'grapple') {
    if (move.id === 'piledriver') {
      model.slowMotion = Math.max(model.slowMotion, .85); // BLOCKBUSTER: enhanced piledriver slowdown
      model.announcement = 'VOLTAGE PILEDRIVER!'; model.announcementTimer = 2.1;
      model.hitStop = Math.max(model.hitStop, .18);
    } else if (move.id === 'slam') {
      model.slowMotion = Math.max(model.slowMotion, 1.05);
      model.announcement = 'VOLTAGE SLAM!'; model.announcementTimer = 1.6;
      model.hitStop = Math.max(model.hitStop, .14);
    } else if (move.damage >= 18) {
      model.slowMotion = Math.max(model.slowMotion, .48); // BLOCKBUSTER: enhanced slam slowdown
      model.announcement = move.displayName.toUpperCase(); model.announcementTimer = 1.2;
    }
  }
  // Combo streak announcement
  if (!model.toyTestMode && (move.category === 'quick' || move.category === 'heavy') && actor.comboStep >= 2) {
    if (inSingles) {
      if (actor.comboStep === 2) { model.announcement = 'NEON FLARE COMBO!'; model.announcementTimer = .5; }
      else if (actor.comboStep === 3) { model.announcement = 'CHAOS CIRCUIT SPLIT!'; model.announcementTimer = .58; }
      else if (actor.comboStep === 4) { model.announcement = '4× MATRIX HYPER!'; model.announcementTimer = .68; model.hype = clamp(model.hype + 6, 0, 100); }
      else if (actor.comboStep >= 5) { model.announcement = 'OVERDRIVE MATRIX BREAK!'; model.announcementTimer = .88; model.hype = clamp(model.hype + 12, 0, 100); }
    } else {
      if (actor.comboStep === 2) { model.announcement = 'ONE-TWO!'; model.announcementTimer = .5; }
      else if (actor.comboStep === 3) { model.announcement = 'TRIPLE!'; model.announcementTimer = .58; }
      else if (actor.comboStep === 4) { model.announcement = '4× COMBO!'; model.announcementTimer = .68; model.hype = clamp(model.hype + 4, 0, 100); }
      else if (actor.comboStep >= 5) { model.announcement = 'UNSTOPPABLE!'; model.announcementTimer = .88; model.hype = clamp(model.hype + 9, 0, 100); }
    }
  }

  if (isComboFinisher) {
    model.announcement = 'COMBO FINISHER!';
    model.announcementTimer = 1.05;
    model.slowMotion = Math.max(model.slowMotion, 0.35);
    actor.comboStep = 0;
  }
  const exhaustionKnockout = model.elapsed >= BALANCE.knockout.earliestSeconds
    && target.health <= BALANCE.knockout.healthThreshold
    && target.stamina <= BALANCE.knockout.staminaThreshold
    && move.damage >= BALANCE.knockout.minimumMoveDamage;
  if (!model.toyTestMode && ((target.health <= 0 && (majorImpactMove || model.matchMode === 'battle_royale')) || (majorImpactMove && exhaustionKnockout))) resolveMatch(model, actorKey, 'KNOCKOUT', targetKey);

  if (inSingles && targetPreHealth >= 35 && target.health < 35 && target.health > 0) {
    model.announcement = `${targetDefinition.name.toUpperCase()} CLUTCH OVERDRIVE!`;
    model.announcementTimer = 1.8;
    model.slowMotion = Math.max(model.slowMotion, 0.25);
  }

  return true;
};

export const performCounter = (model: MatchModel, defenderKey: FighterSlot, attackerKey: FighterSlot): boolean => {
  const defender = model[defenderKey];
  const attacker = model[attackerKey];
  if (!attacker.moveId || attacker.attackPhase !== 'anticipation' || defender.stamina < 10) return false;
  const incoming = getMove(attacker.moveId);
  if (!incoming.counterWindow || attacker.phaseElapsed < incoming.counterWindow[0] || attacker.phaseElapsed > incoming.counterWindow[1]) return false;
  if (model.grapple) releaseGrapple(model, 'idle');
  attacker.state = 'staggered'; attacker.moveId = null; attacker.attackPhase = null; attacker.climbStage = 0; attacker.stateElapsed = 0;
  defender.state = 'attacking'; defender.moveId = 'counter'; defender.attackPhase = 'active'; defender.phaseElapsed = getMove('counter').anticipationDuration;
  defender.stamina = clamp(defender.stamina - 10, 0, defender.staminaCap); defender.momentum = clamp(defender.momentum + 18, 0, 100);
  const stats = model.fighterStats[defenderKey];
  stats.counters += 1;
  model.hype = clamp(model.hype + 18, 0, 100);
  addImpact(model, attacker.position, 'counter', 1.4, { outcome: 'spin', highlight: { label: `Reversed ${incoming.displayName}`, score: 58 + incoming.damage, kind: 'reversal' } });
  model.announcement = 'FLASH REVERSAL!'; model.announcementTimer = 1.2;
  return true;
};

const startPin = (actor: FighterRuntime, target: FighterRuntime): boolean => {
  if (target.state !== 'downed' || distance(actor.position, target.position) > 1.7) return false;
  actor.state = 'pinning'; actor.pinCount = 0; actor.stateElapsed = 0;
  target.state = 'pinned'; target.pinCount = 0; target.pinEscape = 0; target.stateElapsed = 0;
  return true;
};

const useProp = (model: MatchModel, actorKey: FighterSlot, direction: Vec2): boolean => {
  const actor = model[actorKey];
  const target = model[targetSlotFor(model, actorKey)];
  const resolution = resolvePropAction(model, actorKey, direction);
  if (!resolution.legalState) return false;
  if (resolution.actionId === 'swing_held_prop') return startMove(actor, target, getMove('prop'));
  if (resolution.actionId === 'throw_held_prop' && actor.heldPropId) {
    const prop = actor.heldPropId ? model.propsById[actor.heldPropId] : undefined;
    const started = startMove(actor, target, getMove('prop_throw')); if (!started) return false;
    const throwDirection = normalize(direction);
    if (prop) { prop.heldBy = null; prop.position = { x: actor.position.x + throwDirection.x * 2.5, z: actor.position.z + throwDirection.z * 2.5 }; }
    actor.heldPropId = null;
    model.announcement = 'AIR MAIL — PROP THROWN!'; model.announcementTimer = .9;
    return true;
  }
  if (resolution.actionId === 'drop_held_prop' && actor.heldPropId) {
    if (!startMove(actor, target, getMove('prop_drop'))) return false;
    const prop = actor.heldPropId ? model.propsById[actor.heldPropId] : undefined;
    if (prop) { prop.heldBy = null; prop.position = { x: actor.position.x + Math.sin(actor.facing) * .75, z: actor.position.z + Math.cos(actor.facing) * .75 }; }
    actor.heldPropId = null; model.announcement = 'PROP DROPPED'; model.announcementTimer = .65; return true;
  }
  if (resolution.actionId === 'pick_up_prop' && resolution.target) {
    const prop = resolution.target ? model.propsById[resolution.target] : undefined;
    if (!prop) return false;
    if (!startMove(actor, target, getMove('prop_pickup'))) return false;
    actor.heldPropId = prop.id; prop.heldBy = actorKey; model.announcement = `${prop.kind.toUpperCase()} READY`; model.announcementTimer = .65; return true;
  }
  return false;
};

export const canTransitionThroughRopes = canTraverseRopes;

const startKickUp = (actor: FighterRuntime, target: FighterRuntime): boolean => {
  const move = getMove('kick_up');
  if (!canStartMove(actor, target, move)) return false;
  actor.state = 'recovering'; actor.moveId = move.id; actor.attackPhase = 'anticipation'; actor.phaseElapsed = 0; actor.stateElapsed = 0;
  actor.hitTargets = []; actor.attackInstanceId += 1; actor.downTimer = 0; actor.finisherPrimed = false;
  actor.stamina = clamp(actor.stamina - move.staminaCost, 0, actor.staminaCap); actor.invulnerability = Math.max(actor.invulnerability, .28);
  actor.body.verticalVelocity = Math.max(actor.body.verticalVelocity, 3.8);
  return true;
};

const launchAerial = (model: MatchModel, actor: FighterRuntime, target: FighterRuntime, moveId: 'aerial' | 'aerial_elbow' | 'aerial_kick'): boolean => {
  if (!['defeated', 'victorious'].includes(target.state) && distance(actor.position, target.position) <= getMove(moveId).maximumRange) {
    const started = startMove(actor, target, getMove(moveId));
    if (started) {
      actor.climbStage = 0;
      if (!model.physicsAuthority) {
        actor.body.verticalOffset = Math.max(actor.body.verticalOffset, .92); actor.body.verticalVelocity = 4.2;
        const flight = normalize({ x: target.position.x - actor.position.x, z: target.position.z - actor.position.z });
        actor.velocity = scale(flight, moveId === 'aerial_kick' ? 6.8 : moveId === 'aerial_elbow' ? 5.8 : 6.1);
      }
      model.announcement = getMove(moveId).displayName.toUpperCase(); model.announcementTimer = 1;
    }
    return started;
  }
  return false;
};

export const requestCommand = (model: MatchModel, actorKey: FighterSlot, command: GameCommand, direction: Vec2 = { x: 0, z: 0 }, running = false): boolean => {
  const actor = model[actorKey];
  const targetKey = targetSlotFor(model, actorKey);
  const target = model[targetKey];
  if (actor.state === 'climbing' && actor.climbStage === 3 && (command === 'quick' || command === 'heavy')) {
    return launchAerial(model, actor, target, command === 'quick' ? 'aerial_elbow' : 'aerial_kick');
  }
  if (actor.state === 'climbing' && actor.climbStage === 3 && command === 'jump') {
    return launchAerial(model, actor, target, 'aerial');
  }
  // Mid-lift throw: while opponent is held overhead, quick press hurls them in movement direction
  if (actor.state === 'grappling' && model.grapple?.phase === 'lift' && model.grapple?.attacker === actorKey && command === 'quick') {
    const throwDir = Math.hypot(direction.x, direction.z) > .12
      ? normalize(direction)
      : { x: Math.sin(actor.facing), z: Math.cos(actor.facing) };
    releaseGrapple(model, 'idle');
    target.state = 'airborne'; target.stateElapsed = 0; target.moveId = null; target.attackPhase = null; target.climbStage = 0; target.finisherPrimed = false;
    beginFall(model, targetKey, FALL_REASONS.Throw);
    target.velocity.x = throwDir.x * 8.5; target.velocity.z = throwDir.z * 8.5;
    target.body.verticalVelocity = Math.max(target.body.verticalVelocity, 4.5);
    target.body.verticalOffset = Math.max(target.body.verticalOffset, .7);
    target.downTimer = Math.max(target.downTimer, 1.8 + (100 - target.health) / 80);
    target.recoveryOrientation = 'back';
    model.hype = clamp(model.hype + 18, 0, 100);
    model.announcement = 'HURLED!'; model.announcementTimer = 1.1;
    model.slowMotion = Math.max(model.slowMotion, .18);
    addImpact(model, actor.position, 'heavy', 1.5, { force: 10, outcome: 'launch' });
    return true;
  }
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
    return true;
  }
  if (command === 'interact') return useProp(model, actorKey, direction);
  if (command === 'context') {
    const resolution = resolveContextAction(model, actorKey, direction);
    if (!resolution.legalState) return false;
    if (resolution.actionId === 'kickout') { actor.pinEscape += 18 + actor.stamina * .04; return true; }
    if (resolution.actionId === 'corner_move' || resolution.actionId === 'environmental_wrestling_move') {
      const selected = getMove('corner_smash'); const current = actor.moveId ? getMove(actor.moveId) : selected;
      const extraCost = Math.max(0, selected.staminaCost - current.staminaCost); if (actor.stamina < extraCost) return false;
      actor.stamina = clamp(actor.stamina - extraCost, 0, actor.staminaCap); actor.moveId = selected.id;
      actor.phaseElapsed = Math.min(actor.phaseElapsed, selected.anticipationDuration * .42);
      if (model.grapple?.attacker === actorKey) retargetGrapple(model.grapple, selected.id);
      model.announcement = resolution.actionId === 'corner_move' ? 'CORNER CALL — RAIL SHOT!' : 'DESK SPOT CALLED!'; model.announcementTimer = 1.05;
      return true;
    }
    if (resolution.actionId === 'finisher') {
      const started = startMove(actor, target, getMove('finisher'));
      if (started) {
        target.state = model.physicsAuthority ? 'staggered' : 'grabbed'; target.stateElapsed = 0; target.velocity = scale(target.velocity, .25);
        target.moveId = null; target.attackPhase = null;
        model.grapple = createGrappleRuntime(actorKey, targetKey, 'finisher');
      }
      return started;
    }
    if (resolution.actionId === 'pin') return startPin(actor, target);
    if (resolution.actionId === 'top_rope_aerial') return launchAerial(model, actor, target, 'aerial');
    if (resolution.actionId === 'turnbuckle_climb') {
      if (actor.state === 'climbing') {
        actor.climbStage = (actor.climbStage + 1) as 2 | 3; actor.stateElapsed = 0; return true;
      }
      actor.state = 'climbing'; actor.climbStage = 1; actor.stateElapsed = 0; actor.velocity = { x: 0, z: 0 };
      if (!model.physicsAuthority) actor.position = { x: Math.sign(actor.position.x) * 5.25, z: Math.sign(actor.position.z) * 3.7 };
      return true;
    }
    if (resolution.actionId === 'ring_traversal') {
      const nearXApron = Math.abs(actor.position.x) > 4.62 && Math.abs(actor.position.x) < 6.9 && Math.abs(actor.position.z) < 3.55;
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
  if (command === 'grapple' && !model.grapple && distance(actor.position, target.position) > GRAPPLE_ACQUISITION_RANGE
    && ['idle', 'locomotion'].includes(actor.state)) return startMove(actor, target, getMove('grapple_miss'));
  // A grounded wrestler cannot throw a standing punch, but the button must
  // still produce an honest motion. Primary attack/grapple presses become the
  // existing physical kick-up recovery instead of expiring invisibly.
  if (actor.state === 'downed' && (command === 'quick' || command === 'heavy' || command === 'grapple')) return startKickUp(actor, target);
  if (!isActionLegal(model, command, actorKey)) return false;
  if (command === 'block') {
    // Holding guard sustains the existing defensive window. Restarting its
    // clock every fixed step made every held block an accidental perfect
    // parry, suppressing ordinary blocked-impact feedback and chip damage.
    if (actor.state === 'blocking') return true;
    actor.state = 'blocking'; actor.stateElapsed = 0; actor.velocity = scale(actor.velocity, .15);
    return true;
  }
  if (command === 'dodge') {
    if (actor.state === 'downed') return startKickUp(actor, target);
    if (actor.state === 'climbing') {
      if (actor.climbStage > 1) { actor.climbStage = (actor.climbStage - 1) as 1 | 2; actor.stateElapsed = 0; return true; }
      const inward = normalize({ x: -(Math.sign(actor.position.x) || 1), z: -(Math.sign(actor.position.z) || 1) });
      actor.state = 'locomotion'; actor.climbStage = 0; actor.stateElapsed = 0; actor.invulnerability = .28; actor.velocity = scale(inward, 1.35);
      return true;
    }
    if (performCounter(model, actorKey, targetKey)) return true;
    actor.state = 'locomotion'; actor.climbStage = 0; actor.invulnerability = .32; actor.stamina = clamp(actor.stamina - 8, 0, actor.staminaCap);
    const away = normalize({ x: actor.position.x - target.position.x, z: actor.position.z - target.position.z });
    actor.velocity = scale(away, 3.2); return true;
  }
  if (command === 'jump') {
    actor.state = 'jumping'; actor.stateElapsed = 0; actor.stamina = clamp(actor.stamina - 8, 0, actor.staminaCap);
    actor.body.verticalVelocity = Math.max(actor.body.verticalVelocity, 5.8);
    return true;
  }
  if (command === 'taunt') return startMove(actor, target, getMove('taunt'));
  if (command === 'quick') {
    const moveId = target.state === 'downed' ? 'ground' : selectDirectionalStrike(direction, 'quick', actor.comboStep);
    const started = startMove(actor, target, getMove(moveId));
    if (started) actor.comboStep += 1;
    return started;
  }
  if (command === 'heavy') {
    const moveId = actor.heldPropId ? 'prop'
      : actor.ropeRebound > 0 ? direction.x < 0 ? 'rebound' : 'stiff_arm'
        : running && Math.hypot(actor.velocity.x, actor.velocity.z) > 3.6 ? 'stiff_arm'
          : selectDirectionalStrike(direction, 'heavy', actor.comboStep);
    return startMove(actor, target, getMove(moveId));
  }
  if (running && Math.hypot(actor.velocity.x, actor.velocity.z) > 3.75 && target.state !== 'downed') return startMove(actor, target, getMove('spear'));
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
  const moveId = selectGrappleEntryMove(direction);
  const started = startMove(actor, target, getMove(moveId));
  if (started) {
    actor.comboStep += 1; target.state = model.physicsAuthority ? 'staggered' : 'grabbed'; target.stateElapsed = 0; target.velocity = scale(target.velocity, .3);
    target.moveId = null; target.attackPhase = null;
    model.grapple = createGrappleRuntime(actorKey, targetKey, moveId);
  }
  return started;
};

/** All non-legacy callers cross this semantic boundary before combat resolution. */
export const requestAction = (model: MatchModel, actorKey: FighterSlot, event: ActionEvent, running = false): boolean => {
  if (event.phase === 'released' || event.action === 'move' || event.action === 'run' || event.action === 'pause') return false;
  const command = actionToGameCommand(event.action);
  if (!command) return false;
  return requestCommand(model, actorKey, command, actionDirectionToVec2(event.direction), running);
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

const unwindPinState = (model: MatchModel, eliminated: FighterSlot | null): void => {
  for (const slot of activeFighterSlots(model)) {
    const fighter = model[slot];
    const wasPinning = fighter.state === 'pinning'; const wasPinned = fighter.state === 'pinned';
    if (wasPinning && slot !== eliminated) {
      fighter.state = 'idle'; fighter.stateElapsed = 0;
    } else if (wasPinned && slot !== eliminated) {
      fighter.state = 'downed'; fighter.stateElapsed = 0; fighter.downTimer = Math.max(fighter.downTimer, .8);
      beginFall(model, slot, FALL_REASONS.KnockdownMove);
    }
    if (wasPinning || wasPinned || slot === eliminated) {
      fighter.pinCount = 0; fighter.pinEscape = 0;
    }
  }
};

export const resolveMatch = (model: MatchModel, winner: FighterSlot, method: MatchResult['method'], loser = targetSlotFor(model, winner)): void => {
  if (model.resolved || model.toyTestMode) return;
  // A Battle Royale elimination must release both sides of the global pin
  // pair. Leaving the winner in `pinning` or a third-party target in `pinned`
  // freezes advanceMatch even though the rest of the ring should stay live.
  unwindPinState(model, loser);
  if (model.matchMode === 'battle_royale') {
    if (model[loser].state === 'defeated') return;
    model[loser].state = 'defeated'; model[loser].moveId = null; model[loser].attackPhase = null; model[loser].health = 0;
    model.eliminations.push({ fighter: loser, by: winner, method, time: model.elapsed });
    if (model.grapple && (model.grapple.attacker === loser || model.grapple.defender === loser)) model.grapple = null;
    const remaining = activeFighterSlots(model).filter((slot) => model[slot].state !== 'defeated');
    for (const slot of remaining) if (model.targets[slot] === loser) {
      model.targets[slot] = remaining.filter((candidate) => candidate !== slot).sort((a, b) => distance(model[slot].position, model[a].position) - distance(model[slot].position, model[b].position))[0] ?? slot;
    }
    if (remaining.length > 1) {
      model.announcement = `${fighterById(model[loser].definitionId).name} ELIMINATED — ${remaining.length} REMAIN!`; model.announcementTimer = 2.2;
      if (method !== 'FORFEIT') addImpact(model, model[loser].position, method === 'KNOCKOUT' ? 'ko' : 'finisher', 2.1);
      return;
    }
    winner = remaining[0] ?? winner;
  } else {
    model[loser].state = 'defeated'; model[loser].moveId = null; model[loser].attackPhase = null;
    if (model.grapple && (model.grapple.attacker === loser || model.grapple.defender === loser)) model.grapple = null;
  }
  model.resolved = true;
  model[winner].state = 'victorious';
  model.result = { winner, method, duration: model.elapsed, hype: model.hype, grade: scoreGrade(model.hype), playerStats: { ...model.playerStats }, highlights: summarizeHighlights(model.highlights) };
  model.announcement = method === 'FORFEIT' ? 'MATCH ENDS BY FORFEIT' : model.matchMode === 'battle_royale' ? 'LAST WRESTLER STANDING!' : method === 'KNOCKOUT' ? 'KNOCKOUT!' : 'THREE!'; model.announcementTimer = 4;
  if (method !== 'FORFEIT') addImpact(model, model[winner].position, method === 'KNOCKOUT' ? 'ko' : 'finisher', 2.4);
};

const updatePin = (model: MatchModel, dt: number, playerInput: FrameInput): void => {
  const slots = activeFighterSlots(model); const pinningKey = slots.find((slot) => model[slot].state === 'pinning') ?? null;
  const pinnedKey = slots.find((slot) => model[slot].state === 'pinned') ?? null;
  if (!pinningKey || !pinnedKey) {
    if (pinningKey || pinnedKey) unwindPinState(model, null);
    return;
  }
  const pinning = model[pinningKey]; const pinned = model[pinnedKey];
  pinning.stateElapsed += dt; pinned.stateElapsed += dt;
  if (pinnedKey === 'player') {
    // Any recovery action contributes — Space (dodge), J (quick), K (heavy) all help.
    const inputCommands = commandsForInput(playerInput);
    if (inputCommands.includes('dodge')) pinned.pinEscape += 16 + pinned.stamina * .04;
    if (inputCommands.includes('quick')) pinned.pinEscape += 10 + pinned.stamina * .022;
    if (inputCommands.includes('heavy')) pinned.pinEscape += 7 + pinned.stamina * .016;
    if (inputCommands.includes('context')) pinned.pinEscape += 18 + pinned.stamina * .04;
    // PIN REVERSAL: press F (context) in the first second with 38+ stamina
    if (inputCommands.includes('context') && pinned.stamina > 38 && pinning.stateElapsed < 1.05 && Math.floor(pinning.stateElapsed) === 0) {
      pinned.stamina = clamp(pinned.stamina - 30, 0, pinned.staminaCap);
      // Swap pinner / pinned in place
      pinned.state = 'pinning'; pinned.stateElapsed = 0; pinned.pinCount = 0; pinned.pinEscape = 0;
      pinning.state = 'pinned'; pinning.stateElapsed = 0; pinning.pinCount = 0; pinning.pinEscape = 0;
      model.slowMotion = Math.max(model.slowMotion, .44); model.hitStop = Math.max(model.hitStop, .16);
      model.hype = clamp(model.hype + 28, 0, 100);
      model.announcement = 'PIN REVERSAL!'; model.announcementTimer = 2.0;
      addImpact(model, model[pinnedKey].position, 'counter', 2.0, { outcome: 'spin' });
      return;
    }
  }
  if (pinnedKey !== 'player') {
    const difficultyFactor = model.difficulty === 'hard' ? 1.08 : .92;
    pinned.pinEscape += dt * (9 + pinned.health * .2 + pinned.stamina * .08) * difficultyFactor;
  }
  const count = Math.min(3, Math.floor(pinning.stateElapsed) + 1);
  if (count !== pinning.pinCount) {
    pinning.pinCount = count; pinned.pinCount = count;
    model.announcement = count === 1 ? 'ONE' : count === 2 ? 'TWO' : 'THREE';
    model.announcementTimer = count === 3 ? 1.4 : .85;
    if (count === 2) model.slowMotion = Math.max(model.slowMotion, .16);
    if (count === 3) { model.slowMotion = Math.max(model.slowMotion, .54); model.hitStop = Math.max(model.hitStop, .18); }
  }
  const threshold = 76 + (100 - pinned.health) * .36 + (pinned.finisherPrimed ? 14 : 0);
  if (pinned.pinEscape >= threshold && count < 3) {
    pinning.state = 'idle'; pinned.state = 'downed'; beginFall(model, pinnedKey, FALL_REASONS.KnockdownMove); pinned.downTimer = .8; pinning.pinCount = 0; pinned.pinCount = 0; pinned.pinEscape = 0;
    model.fighterStats[pinningKey].nearFalls += 1;
    model.slowMotion = Math.max(model.slowMotion, .36); model.hitStop = Math.max(model.hitStop, .14);
    model.hype = clamp(model.hype + 16, 0, 100); model.announcement = `${count}.9 — KICKOUT!`; model.announcementTimer = 1.6;
    addImpact(model, pinned.position, 'nearfall', 1.9);
  } else if (count >= 3 && pinning.stateElapsed >= 2.85) {
    if (model.toyTestMode) {
      pinning.state = 'idle'; pinned.state = 'downed'; beginFall(model, pinnedKey, FALL_REASONS.KnockdownMove); pinned.downTimer = .8; pinning.pinCount = 0; pinned.pinCount = 0; pinned.pinEscape = 0;
    } else resolveMatch(model, pinningKey, 'PINFALL', pinnedKey);
  }
};

const updateFighter = (model: MatchModel, actorKey: FighterSlot, dt: number, movement: Vec2, run: boolean, blockingHeld: boolean): void => {
  const actor = model[actorKey];
  const target = model[targetSlotFor(model, actorKey)];
  const definition = fighterById(actor.definitionId);
  actor.stateElapsed += dt;
  actor.invulnerability = Math.max(0, actor.invulnerability - dt);
  actor.ropeRebound = Math.max(0, actor.ropeRebound - dt);
  auditFallState(model, actorKey, dt);
  const landing = stepBodyDynamics(actor, dt);
  if (!model.physicsAuthority && landing.landed && landing.landingEnergy > 2.2) {
    addImpact(model, actor.position, 'grapple', clamp(landing.landingEnergy / 7, .55, 1.8), {
      region: 'chest', force: landing.landingEnergy, outcome: 'fall',
    });
  }
  if (!model.physicsAuthority && landing.landed && actor.state === 'airborne') {
    actor.state = 'downed'; actor.stateElapsed = 0;
    actor.downTimer = Math.max(actor.downTimer, 1.25 + (100 - actor.health) / 90);
  }

  if (actor.state === 'climbing') {
    actor.velocity = scale(actor.velocity, Math.exp(-dt * 12));
    actor.stamina = clamp(actor.stamina + dt * 4, 0, actor.staminaCap);
    actor.facing = Math.atan2(target.position.x - actor.position.x, target.position.z - actor.position.z);
    const inward = { x: -(Math.sign(actor.position.x) || 1), z: -(Math.sign(actor.position.z) || 1) };
    if (!actor.moveId && actor.stateElapsed > .28 && movement.x * inward.x + movement.z * inward.z > .25) {
      actor.state = 'locomotion'; actor.climbStage = 0; actor.stateElapsed = 0;
      actor.velocity = scale(normalize(inward), 1.6);
    } else if (!actor.moveId) return;
  }

  if (actor.state === 'grabbed') {
    const holding = model.grapple?.defender === actorKey && model.grapple.attacker !== actorKey;
    if (!holding) {
      actor.state = 'idle'; actor.stateElapsed = 0;
    } else {
      actor.stamina = clamp(actor.stamina + dt * 3.2, 0, actor.staminaCap);
      if (!model.physicsAuthority) {
        actor.position.x += actor.velocity.x * dt;
        actor.position.z += actor.velocity.z * dt;
      }
      actor.velocity = scale(actor.velocity, Math.exp(-dt * 1.2));
      return;
    }
  }

  if (!model.physicsAuthority && actor.state === 'airborne' && actor.body.verticalOffset <= .001 && actor.body.verticalVelocity <= .01) {
    actor.state = 'downed'; actor.stateElapsed = 0;
    actor.downTimer = Math.max(actor.downTimer, 1.25 + (100 - actor.health) / 90);
  }
  if (actor.state === 'jumping' && actor.body.verticalOffset <= .001 && Math.abs(actor.body.verticalVelocity) <= .45 && actor.stateElapsed > .12) {
    actor.state = 'recovering'; actor.stateElapsed = 0;
  }
  if (actor.state === 'downed') {
    actor.downTimer -= dt; actor.stamina = clamp(actor.stamina + dt * 10, 0, actor.staminaCap);
    if (actor.downTimer <= 0) { actor.state = 'recovering'; actor.stateElapsed = 0; }
  } else if (actor.state === 'recovering' && !actor.moveId && actor.stateElapsed > .7 && (!model.physicsAuthority || actor.body.balance >= 70 && Math.abs(actor.body.verticalVelocity) <= .45)) {
    actor.state = 'idle'; actor.stateElapsed = 0; actor.finisherPrimed = false;
  } else if (actor.state === 'staggered' && actor.stateElapsed > .55 + (100 - actor.health) / 200) {
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
    if (!model.physicsAuthority && move.category === 'aerial' && actor.phaseElapsed > move.anticipationDuration * .22) {
      const chase = normalize({ x: target.position.x - actor.position.x, z: target.position.z - actor.position.z });
      actor.velocity.x += chase.x * dt * 6.5;
      actor.velocity.z += chase.z * dt * 6.5;
    }
    // Attack phases author movement only. Damage is resolved exclusively by
    // applyPhysicalContact after Rapier reports a solved limb/body manifold.
    if (!actor.attackPhase) {
      const completedTurnbuckleTaunt = move.id === 'taunt' && actor.state === 'climbing';
      if (move.id === 'taunt' && !model.toyTestMode) {
        const variety = varietyMultiplier(actor, move.id); const surge = model.chaosEvent?.type === 'CROWD SURGE' ? 1.6 : 1;
        actor.momentum = clamp(actor.momentum + move.momentumGain * variety * (model.ruleset === 'chaos' ? 1.2 : 1) * surge, 0, 100);
        model.hype = clamp(model.hype + move.hypeValue * variety * BALANCE.hypeScale, 0, 100);
        actor.recentMoves = [...actor.recentMoves.slice(-4), move.id];
        if (variety >= .65) { model.announcement = `${fighterById(actor.definitionId).name} — CROWD CALL!`; model.announcementTimer = .9; }
      }
      if (model.grapple?.attacker === actorKey) releaseGrapple(model, 'idle');
      actor.moveId = null; actor.state = completedTurnbuckleTaunt ? 'climbing' : 'idle'; actor.stateElapsed = 0; actor.finisherPrimed = false;
    }
  }

  const canMove = ['idle', 'locomotion'].includes(actor.state);
  const inputLength = Math.hypot(movement.x, movement.z);
  if (canMove) {
    const running = run && actor.stamina > 3 && inputLength > .08;
    integrateLocomotion(actor, definition, movement, running, dt);
    const targetDistance = distance(actor.position, target.position);
    const physicalSpeed = Math.hypot(actor.velocity.x, actor.velocity.z);
    if (actor.ropeRebound > 0 && physicalSpeed > 1.2) actor.facing = Math.atan2(actor.velocity.x, actor.velocity.z);
    else if (!running && targetDistance < 4.8) {
      const desiredFacing = Math.atan2(target.position.x - actor.position.x, target.position.z - actor.position.z);
      const facingError = Math.atan2(Math.sin(desiredFacing - actor.facing), Math.cos(desiredFacing - actor.facing));
      actor.facing += clamp(facingError, -dt * 7.5, dt * 7.5);
    }
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
  actor.position.x = clamp(actor.position.x, -VOLT_DOME.playable.halfWidth, VOLT_DOME.playable.halfWidth);
  actor.position.z = clamp(actor.position.z, -VOLT_DOME.playable.halfDepth, VOLT_DOME.playable.halfDepth);
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
  if (model.elapsed < model.nextChaosAt || activeFighterSlots(model).some((slot) => model[slot].state === 'pinning')) return;
  const types = ['PROP DROP', 'CROWD SURGE', 'OVERDRIVE ROPES', 'SPOTLIGHT SHOWDOWN'] as const;
  const [roll, nextSeed] = seededRandom(model.seed); model.seed = nextSeed;
  const type = types[Math.floor(roll * types.length)] ?? 'PROP DROP';
  model.chaosEvent = { type, remaining: type === 'PROP DROP' ? 5 : 14 };
  model.nextChaosAt = model.elapsed + 35 + roll * 20;
  model.announcement = `CHAOS EVENT — ${type}`; model.announcementTimer = 2.5;
  if (type === 'PROP DROP') {
    const kind: PropRuntime['kind'] = roll > .68 ? 'chair' : roll > .34 ? 'trash' : 'sign';
    const newProp: PropRuntime = { id: `${kind}-${model.impactSequence + 9}`, kind, position: { x: (roll - .5) * 8, z: -5.6 }, durability: kind === 'trash' ? 4 : 2, stress: 0, failureStage: 'intact', heldBy: null, broken: false };
    model.props.push(newProp); model.propsById[newProp.id] = newProp;
  }
};

const replayFighterFrame = (fighter: FighterRuntime): ReplayFighterFrame => ({
  definitionId: fighter.definitionId,
  position: { ...fighter.position },
  velocity: { ...fighter.velocity },
  facing: fighter.facing,
  state: fighter.state,
  stateElapsed: fighter.stateElapsed,
  moveId: fighter.moveId,
  attackPhase: fighter.attackPhase,
  phaseElapsed: fighter.phaseElapsed,
  health: fighter.health,
  stamina: fighter.stamina,
  staminaCap: fighter.staminaCap,
  momentum: fighter.momentum,
  climbStage: fighter.climbStage,
  recoveryOrientation: fighter.recoveryOrientation,
  body: {
    verticalOffset: fighter.body.verticalOffset,
    leanForward: fighter.body.leanForward,
    leanSide: fighter.body.leanSide,
    twist: fighter.body.twist,
    headSnap: fighter.body.headSnap,
    pelvisDrop: fighter.body.pelvisDrop,
    muscle: fighter.body.muscle,
    gaitPhase: fighter.body.gaitPhase,
    stride: fighter.body.stride,
    leftFoot: { ...fighter.body.leftFoot, offset: { ...fighter.body.leftFoot.offset } },
    rightFoot: { ...fighter.body.rightFoot, offset: { ...fighter.body.rightFoot.offset } },
  },
});

const sampleReplay = (model: MatchModel, dt: number): void => {
  model.replaySampleTimer += dt;
  if (model.replaySampleTimer < 1 / 15) return;
  model.replaySampleTimer %= 1 / 15;
  model.replayFrames.push({ time: model.elapsed, player: replayFighterFrame(model.player), opponent: replayFighterFrame(model.opponent) });
  if (model.replayFrames.length > 75) model.replayFrames.splice(0, model.replayFrames.length - 75);
};

const retargetFighters = (model: MatchModel): void => {
  const active = activeFighterSlots(model).filter((slot) => !['defeated', 'victorious'].includes(model[slot].state));
  for (const slot of active) {
    if (slot === 'player' && model.playerTargetLock > 0) continue;
    // Prevent AIs from retargeting mid-move (when attacking, grappling, grabbed, pinning, or pinned)
    if (slot !== 'player' && ['attacking', 'grappling', 'grabbed', 'pinning', 'pinned'].includes(model[slot].state)) continue;

    const candidates = active.filter((candidate) => candidate !== slot);
    if (candidates.length === 0) continue;

    // Prioritize targeting opponents who are currently pinning someone, creating dramatic pin breaks!
    if (slot !== 'player') {
      const pinners = candidates.filter((candidate) => model[candidate].state === 'pinning');
      if (pinners.length > 0) {
        const nearestPinner = pinners.sort((a, b) => distance(model[slot].position, model[a].position) - distance(model[slot].position, model[b].position))[0];
        if (nearestPinner) {
          model.targets[slot] = nearestPinner;
          continue;
        }
      }
    }

    const nearest = candidates.sort((a, b) => distance(model[slot].position, model[a].position) - distance(model[slot].position, model[b].position))[0];
    if (!nearest) continue;
    const current = model.targets[slot]; const currentValid = candidates.includes(current);
    const currentDistance = currentValid ? distance(model[slot].position, model[current].position) : Number.POSITIVE_INFINITY;
    const nearestDistance = distance(model[slot].position, model[nearest].position);
    // Use target persistence buffer (1.35m) for AI to reduce target flicking, while player gets 0.72m
    const buffer = slot === 'player' ? 0.72 : 1.35;
    if (!currentValid || nearestDistance + buffer < currentDistance) model.targets[slot] = nearest;
  }
};

export const advanceMatch = (model: MatchModel, dt: number, playerInput: FrameInput): MatchModel => {
  if (model.paused || model.resolved) return model;
  if (model.hitStop > 0) {
    model.hitStop = Math.max(0, model.hitStop - dt);
    // A one-on-one impact can briefly stop the shared stage. In a five-way
    // match, unrelated hits happen continuously; freezing the whole rules and
    // input simulation for every collision made ten wall-clock seconds advance
    // only a few match seconds and felt exactly like dropped controls.
    if (model.matchMode !== 'battle_royale') return model;
  }
  const slowMotionScale = model.slowMotion > 0 ? model.matchMode === 'battle_royale' ? .82 : .36 : 1;
  const step = dt * slowMotionScale; model.slowMotion = Math.max(0, model.slowMotion - dt);
  model.elapsed += step; model.announcementTimer = Math.max(0, model.announcementTimer - step); if (model.announcementTimer === 0) model.announcement = null;
  model.playerTargetLock = Math.max(0, model.playerTargetLock - step);
  updateChaos(model, step);
  retargetFighters(model);
  updatePin(model, step, playerInput);
  if (activeFighterSlots(model).some((slot) => model[slot].state === 'pinned')) return model;

  if (playerInput.block) requestCommand(model, 'player', 'block', playerInput.move, playerInput.run);
  for (const event of playerInput.actions ?? []) if (event.phase === 'started') requestAction(model, 'player', event, playerInput.run);
  for (const command of playerInput.commands ?? []) requestCommand(model, 'player', command, playerInput.move, playerInput.run);
  const active = activeFighterSlots(model);
  const openingBell = model.matchMode === 'battle_royale' && model.elapsed < BATTLE_ROYALE_OPENING_BELL_SECONDS;
  for (const slot of AI_FIGHTER_SLOTS) {
    const controller = model.aiControllers[slot];
    if (!active.includes(slot) || model[slot].state === 'defeated') { controller.movement = { x: 0, z: 0 }; controller.running = false; controller.intent = null; continue; }
    controller.blockTimer = Math.max(0, controller.blockTimer - step); controller.thinkTimer -= step;
    if (model.labMode || model.toyTestMode || openingBell) {
      controller.movement = { x: 0, z: 0 }; controller.running = false; controller.intent = null; controller.blockTimer = 0;
      if (openingBell) controller.thinkTimer = Math.max(controller.thinkTimer, BATTLE_ROYALE_OPENING_BELL_SECONDS - model.elapsed);
    } else if (model.networkAuthority) {
      // The remote wrestler is driven by authoritative snapshots. Running the
      // local utility AI here creates a second, conflicting opponent on every
      // browser and makes contact diverge between clients.
      controller.intent = null;
    } else if (controller.thinkTimer <= 0) {
      const decision = chooseAiDecision(model, fighterById(model[slot].definitionId), slot);
      model.seed = decision.nextSeed; controller.intent = decision.command; controller.movement = decision.move; controller.running = decision.run;
      controller.thinkTimer = (model.difficulty === 'hard' ? .13 : .22) + (slot === 'opponent' ? 0 : .025 * Number(slot.slice(-1)));
      if (decision.command) {
        requestAction(model, slot, createActionEvent(gameCommandToAction(decision.command), { source: 'ai', timestamp: model.elapsed * 1_000, direction: decision.move }), controller.running);
        if (decision.command === 'block') controller.blockTimer = model.difficulty === 'hard' ? .72 : .48;
      }
    }
  }
  const opponentController = model.aiControllers.opponent;
  model.aiThinkTimer = opponentController.thinkTimer; model.aiIntent = opponentController.intent; model.aiMovement = { ...opponentController.movement }; model.aiRunning = opponentController.running; model.aiBlockTimer = opponentController.blockTimer;
  const grappleAi = model.grapple && model.grapple.attacker !== 'player' ? model.aiControllers[model.grapple.attacker] : model.grapple && model.grapple.defender !== 'player' ? model.aiControllers[model.grapple.defender] : opponentController;
  const grappleStep = model.physicsAuthority ? { broken: false, liftEnergy: 0 } : stepGrappleDynamics(model, step, playerInput.move, grappleAi.movement);
  if (grappleStep.broken) {
    releaseGrapple(model, 'staggered');
    model.announcement = 'GRIP BROKEN — SCRAMBLE!'; model.announcementTimer = .9;
    model.hype = clamp(model.hype + 4, 0, 100);
  }
  updateFighter(model, 'player', step, playerInput.move, playerInput.run, playerInput.block);
  for (const slot of AI_FIGHTER_SLOTS) if (active.includes(slot)) {
    const controller = model.aiControllers[slot]; updateFighter(model, slot, step, controller.movement, controller.running, controller.blockTimer > 0);
  }
  sampleReplay(model, step);
  for (const slot of active) {
    const target = model[model.targets[slot]]; const threat = target.moveId ? getMove(target.moveId) : null;
    model[slot].counterWindow = threat?.counterWindow && target.attackPhase === 'anticipation' && distance(model[slot].position, target.position) < threat.maximumRange + .3 && target.phaseElapsed >= threat.counterWindow[0] && target.phaseElapsed <= threat.counterWindow[1] ? .1 : 0;
  }
  return model;
};

const expectedContactSegment = (move: MoveDefinition, segment: string): boolean => {
  if (move.id === 'headbutt') return segment === 'head';
  if (move.id === 'aerial_elbow') return segment.includes('Forearm') || segment.includes('UpperArm') || segment === 'chest';
  if (move.category === 'aerial' || move.id === 'ground' || move.id === 'front_kick' || move.id === 'low_kick' || move.id === 'high_kick' || move.id === 'roundhouse') return segment.includes('Foot') || segment.includes('Shin') || segment.includes('chest') || move.id === 'aerial' && (segment === 'abdomen' || segment === 'pelvis' || segment.includes('UpperArm') || segment.includes('Forearm') || segment.includes('Hand') || segment.includes('Thigh'));
  if (move.id === 'rebound' || move.id === 'stiff_arm') return segment.includes('Hand') || segment.includes('Forearm') || segment.includes('UpperArm') || segment === 'chest';
  if (move.id === 'spear') return segment === 'chest' || segment.includes('UpperArm');
  if (move.category === 'quick' || move.category === 'heavy' || move.category === 'prop' || move.id === 'counter') return segment.includes('Hand');
  return move.category === 'grapple' || move.category === 'finisher';
};

const applyPhysicalTableStress = (model: MatchModel, contact: BodyWorksContact, move: MoveDefinition): void => {
  if (!contact.isLanding || contact.targetSurface !== 'table') return;
  const table = model.props.find((prop) => prop.kind === 'table' && !prop.broken); if (!table) return;
  // A committed human landing is the table-collapse trigger. The physical
  // force still grades lighter bumps, while a completed slam/finisher supplies
  // the structural impulse needed to break a wrestling commentary table.
  const structuralImpulse = move.category === 'finisher' ? 72 : move.category === 'grapple' ? 58 : move.category === 'aerial' ? 38 : 0;
  const addedStress = contact.maximumForce * .38 + contact.relativeSpeed * 7 + structuralImpulse;
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
  const capturedDuringActiveWindow = contactCapturedDuringActiveWindow(model, contact);
  const legalContactPhase = capturedDuringActiveWindow || (contact.isLanding && (move.category === 'grapple' || move.category === 'finisher'));
  if (!legalContactPhase) return false;
  if (!expectedContactSegment(move, contact.sourceSegment) || contact.relativeSpeed < .28 && contact.maximumForce < 45) return false;
  const applied = applyMoveHit(model, contact.sourceFighter, contact.targetFighter, move, contact);
  if (applied) applyPhysicalTableStress(model, contact, move);
  return applied;
};
