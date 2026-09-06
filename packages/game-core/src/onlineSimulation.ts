import type { ActionEvent, AttackPhase, FighterId, FighterState, MatchEndMethod, Ruleset } from '@frwf/game-protocol';

export interface OnlineFighterState {
  sessionId: string;
  fighterId: FighterId;
  health: number;
  stamina: number;
  momentum: number;
  posX: number;
  posZ: number;
  facing: number;
  velocityX: number;
  velocityZ: number;
  combatState: FighterState;
  moveId: string;
  attackPhase: AttackPhase;
  pinCount: number;
  finisherPrimed: boolean;
  lastCommandSeq: number;
  moveX: number;
  moveZ: number;
  movementLeaseUntil: number;
  running: boolean;
  guarding: boolean;
  phaseElapsed: number;
  attackInstanceId: number;
  hitTargets: Set<string>;
  grappleTarget: string | null;
  downTimer: number;
}

export interface OnlineMatchState {
  elapsed: number;
  hype: number;
  announcement: string;
  announcementTimer: number;
  ruleset: Ruleset;
  resolved: boolean;
  winnerSessionId: string;
  winMethod: MatchEndMethod | '';
  fighters: Map<string, OnlineFighterState>;
  impactSequence: number;
}

export interface OnlineImpact {
  impactId: number;
  sourceSessionId: string;
  targetSessionId: string;
  kind: 'light' | 'heavy' | 'grapple';
  intensity: number;
  posX: number;
  posZ: number;
  moveId: string;
  region: 'head' | 'chest' | 'legs';
}

interface OnlineMove {
  id: string;
  anticipation: number;
  active: number;
  recovery: number;
  stamina: number;
  damage: number;
  momentum: number;
  startReach: number;
  endReach: number;
  colliderRadius: number;
  targetRadius: number;
  region: OnlineImpact['region'];
  kind: OnlineImpact['kind'];
}

const MOVES: Readonly<Record<string, OnlineMove>> = {
  jab: { id: 'jab', anticipation: .12, active: .14, recovery: .22, stamina: 5, damage: 5.5, momentum: 7, startReach: .32, endReach: .94, colliderRadius: .11, targetRadius: .34, region: 'chest', kind: 'light' },
  headbutt: { id: 'headbutt', anticipation: .2, active: .2, recovery: .3, stamina: 9, damage: 9, momentum: 11, startReach: .22, endReach: .64, colliderRadius: .235, targetRadius: .235, region: 'head', kind: 'light' },
  low_kick: { id: 'low_kick', anticipation: .2, active: .2, recovery: .34, stamina: 8, damage: 8, momentum: 9, startReach: .3, endReach: 1.08, colliderRadius: .14, targetRadius: .18, region: 'legs', kind: 'heavy' },
  grapple_miss: { id: 'grapple_miss', anticipation: .16, active: .24, recovery: .25, stamina: 6, damage: 0, momentum: 0, startReach: .3, endReach: .82, colliderRadius: .18, targetRadius: .36, region: 'chest', kind: 'grapple' },
  slam: { id: 'slam', anticipation: .42, active: .14, recovery: .5, stamina: 15, damage: 18, momentum: 20, startReach: .2, endReach: .52, colliderRadius: .32, targetRadius: .36, region: 'chest', kind: 'grapple' },
};

const fighter = (sessionId: string, fighterId: FighterId, x: number, facing: number): OnlineFighterState => ({
  sessionId, fighterId, health: 100, stamina: 100, momentum: 0, posX: x, posZ: 0, facing,
  velocityX: 0, velocityZ: 0, combatState: 'idle', moveId: '', attackPhase: null,
  pinCount: 0, finisherPrimed: false, lastCommandSeq: 0, moveX: 0, moveZ: 0, movementLeaseUntil: 0,
  running: false, guarding: false, phaseElapsed: 0, attackInstanceId: 0,
  hitTargets: new Set(), grappleTarget: null, downTimer: 0,
});

export const createOnlineMatch = (
  players: readonly [{ sessionId: string; fighterId: FighterId }, { sessionId: string; fighterId: FighterId }],
  ruleset: Ruleset = 'standard',
): OnlineMatchState => ({
  elapsed: 0, hype: 8, announcement: 'ROUND ONE — FIGHT!', announcementTimer: 2.2,
  ruleset, resolved: false, winnerSessionId: '', winMethod: '', impactSequence: 0,
  fighters: new Map([
    [players[0].sessionId, fighter(players[0].sessionId, players[0].fighterId, -2.3, Math.PI / 2)],
    [players[1].sessionId, fighter(players[1].sessionId, players[1].fighterId, 2.3, -Math.PI / 2)],
  ]),
});

const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));
const length = (x: number, z: number): number => Math.hypot(x, z);

const beginMove = (actor: OnlineFighterState, moveId: keyof typeof MOVES): boolean => {
  const move = MOVES[moveId];
  if (!move || actor.stamina < move.stamina || !['idle', 'locomotion', 'blocking', 'grappling'].includes(actor.combatState)) return false;
  actor.stamina -= move.stamina; actor.moveId = move.id; actor.attackPhase = 'anticipation'; actor.phaseElapsed = 0;
  actor.combatState = move.id === 'grapple_miss' || move.id === 'slam' ? 'grappling' : 'attacking';
  actor.attackInstanceId += 1; actor.hitTargets.clear();
  return true;
};

export const applyOnlineAction = (match: OnlineMatchState, sessionId: string, event: ActionEvent, sequence: number): boolean => {
  const actor = match.fighters.get(sessionId);
  if (!actor || match.resolved || sequence <= actor.lastCommandSeq || !Number.isFinite(sequence)) return false;
  actor.lastCommandSeq = sequence;
  const x = clamp(Number.isFinite(event.direction.x) ? event.direction.x : 0, -1, 1);
  const z = clamp(Number.isFinite(event.direction.y) ? event.direction.y : 0, -1, 1);
  if (event.action === 'move') {
    if (event.phase === 'released') { actor.moveX = 0; actor.moveZ = 0; actor.movementLeaseUntil = match.elapsed; }
    else { const magnitude = Math.max(1, length(x, z)); actor.moveX = x / magnitude; actor.moveZ = z / magnitude; actor.movementLeaseUntil = match.elapsed + .24; }
    return true;
  }
  if (event.action === 'run') { actor.running = event.phase !== 'released'; return true; }
  if (event.action === 'guard') {
    actor.guarding = event.phase !== 'released';
    if (!actor.moveId && actor.downTimer <= 0) actor.combatState = actor.guarding ? 'blocking' : 'idle';
    return true;
  }
  if (event.phase !== 'started') return true;
  if (event.action === 'quickStrike') return beginMove(actor, z > .45 ? 'headbutt' : 'jab');
  if (event.action === 'heavyStrike') return beginMove(actor, actor.grappleTarget ? 'slam' : 'low_kick');
  if (event.action === 'grapple') return beginMove(actor, actor.grappleTarget ? 'slam' : 'grapple_miss');
  return true;
};

const phaseDuration = (move: OnlineMove, phase: AttackPhase): number => phase === 'anticipation' ? move.anticipation : phase === 'active' ? move.active : move.recovery;

const segmentCircleHit = (
  startX: number, startZ: number, endX: number, endZ: number,
  centerX: number, centerZ: number, radius: number,
): boolean => {
  const dx = endX - startX; const dz = endZ - startZ; const denominator = dx * dx + dz * dz;
  const t = denominator <= 1e-8 ? 0 : clamp(((centerX - startX) * dx + (centerZ - startZ) * dz) / denominator, 0, 1);
  return length(centerX - (startX + dx * t), centerZ - (startZ + dz * t)) <= radius;
};

const otherFighter = (match: OnlineMatchState, sourceId: string): OnlineFighterState | null => {
  for (const candidate of match.fighters.values()) if (candidate.sessionId !== sourceId) return candidate;
  return null;
};

const resolveActiveContact = (match: OnlineMatchState, actor: OnlineFighterState, move: OnlineMove, previousProgress: number, progress: number): OnlineImpact | null => {
  const target = actor.grappleTarget ? match.fighters.get(actor.grappleTarget) ?? null : otherFighter(match, actor.sessionId);
  if (!target || ['defeated', 'victorious'].includes(target.combatState)) return null;
  const token = `${target.sessionId}:${actor.attackInstanceId}`; if (actor.hitTargets.has(token)) return null;
  const forwardX = Math.sin(actor.facing); const forwardZ = Math.cos(actor.facing);
  const startReach = move.startReach + (move.endReach - move.startReach) * previousProgress;
  const endReach = move.startReach + (move.endReach - move.startReach) * progress;
  const hit = segmentCircleHit(
    actor.posX + forwardX * startReach, actor.posZ + forwardZ * startReach,
    actor.posX + forwardX * endReach, actor.posZ + forwardZ * endReach,
    target.posX, target.posZ, move.colliderRadius + move.targetRadius,
  );
  if (!hit) return null;
  actor.hitTargets.add(token);
  if (move.id === 'grapple_miss') {
    actor.grappleTarget = target.sessionId; target.grappleTarget = actor.sessionId;
    actor.combatState = 'grappling'; target.combatState = 'grabbed';
    match.announcement = 'COLLAR-AND-ELBOW CONTACT!'; match.announcementTimer = .8;
    return null;
  }
  const guarded = target.guarding && move.kind !== 'grapple'; const damage = guarded ? move.damage * .18 : move.damage;
  target.health = clamp(target.health - damage, 0, 100); actor.momentum = clamp(actor.momentum + move.momentum, 0, 100);
  match.hype = clamp(match.hype + (guarded ? 2 : move.kind === 'grapple' ? 14 : 5), 0, 100);
  if (move.id === 'slam') {
    actor.grappleTarget = null; target.grappleTarget = null; target.combatState = 'downed'; target.downTimer = 1.8;
  } else if (!guarded) target.combatState = move.kind === 'heavy' && target.health < 55 ? 'downed' : 'staggered';
  match.impactSequence += 1;
  const impact: OnlineImpact = {
    impactId: match.impactSequence, sourceSessionId: actor.sessionId, targetSessionId: target.sessionId,
    kind: move.kind, intensity: guarded ? .4 : clamp(move.damage / 12, .55, 2.2), posX: target.posX, posZ: target.posZ,
    moveId: move.id, region: move.region,
  };
  if (target.health <= 0) {
    target.combatState = 'defeated'; actor.combatState = 'victorious'; match.resolved = true;
    match.winnerSessionId = actor.sessionId; match.winMethod = 'KNOCKOUT'; match.announcement = 'KNOCKOUT!'; match.announcementTimer = 4;
  }
  return impact;
};

export const stepOnlineMatch = (match: OnlineMatchState, dt: number): readonly OnlineImpact[] => {
  if (match.resolved || !Number.isFinite(dt) || dt <= 0) return [];
  const step = clamp(dt, 0, 1 / 15); match.elapsed += step;
  match.announcementTimer = Math.max(0, match.announcementTimer - step); if (match.announcementTimer === 0) match.announcement = '';
  const impacts: OnlineImpact[] = [];
  for (const actor of match.fighters.values()) {
    actor.stamina = clamp(actor.stamina + step * 4.2, 0, 100);
    if (match.elapsed > actor.movementLeaseUntil) { actor.moveX = 0; actor.moveZ = 0; actor.running = false; }
    if (actor.downTimer > 0) {
      actor.downTimer = Math.max(0, actor.downTimer - step);
      if (actor.downTimer === 0 && actor.health > 0) actor.combatState = 'idle';
      actor.velocityX = 0; actor.velocityZ = 0; continue;
    }
    const target = otherFighter(match, actor.sessionId);
    if (target && length(target.posX - actor.posX, target.posZ - actor.posZ) < 4.5) actor.facing = Math.atan2(target.posX - actor.posX, target.posZ - actor.posZ);
    if (!actor.moveId && !actor.grappleTarget) {
      const speed = actor.running ? 5.8 : 3.5; actor.velocityX = actor.moveX * speed; actor.velocityZ = actor.moveZ * speed;
      actor.posX = clamp(actor.posX + actor.velocityX * step, -5.55, 5.55); actor.posZ = clamp(actor.posZ + actor.velocityZ * step, -4.05, 4.05);
      actor.combatState = actor.guarding ? 'blocking' : length(actor.moveX, actor.moveZ) > .05 ? 'locomotion' : 'idle';
      continue;
    }
    actor.velocityX = 0; actor.velocityZ = 0;
    const move = MOVES[actor.moveId]; if (!move) { actor.moveId = ''; actor.attackPhase = null; continue; }
    const phaseBeforeStep = actor.attackPhase; const previousElapsed = actor.phaseElapsed; actor.phaseElapsed += step;
    if (actor.attackPhase === 'anticipation' && actor.phaseElapsed >= move.anticipation) {
      actor.attackPhase = 'active'; actor.phaseElapsed -= move.anticipation;
    }
    if (actor.attackPhase === 'active') {
      const previousActiveElapsed = phaseBeforeStep === 'active' ? previousElapsed : 0;
      const previousProgress = clamp(previousActiveElapsed / Math.max(.001, move.active), 0, 1);
      const progress = clamp(actor.phaseElapsed / Math.max(.001, move.active), 0, 1);
      const impact = resolveActiveContact(match, actor, move, previousProgress, progress); if (impact) impacts.push(impact);
      if (actor.phaseElapsed >= move.active) { actor.attackPhase = 'recovery'; actor.phaseElapsed -= move.active; }
    }
    if (actor.attackPhase === 'recovery' && actor.phaseElapsed >= phaseDuration(move, 'recovery')) {
      actor.moveId = ''; actor.attackPhase = null; actor.phaseElapsed = 0;
      if (actor.combatState !== 'victorious' && actor.combatState !== 'defeated') actor.combatState = actor.grappleTarget ? 'grappling' : actor.guarding ? 'blocking' : 'idle';
    }
  }
  return impacts;
};
