import { NETWORK_MOVE_TIMING } from '@frwf/game-protocol';
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
  quickChainCount: number;
  lastQuickStrikeAt: number;
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
  jab: { id: 'jab', ...NETWORK_MOVE_TIMING.jab, stamina: 5, damage: 5.5, momentum: 7, startReach: .32, endReach: .94, colliderRadius: .11, targetRadius: .34, region: 'chest', kind: 'light' },
  combo: { id: 'combo', anticipation: .11, active: .25, recovery: .26, stamina: 8, damage: 7, momentum: 9, startReach: .34, endReach: 1.18, colliderRadius: .13, targetRadius: .34, region: 'chest', kind: 'light' },
  right_hook: { id: 'right_hook', anticipation: .18, active: .2, recovery: .27, stamina: 9, damage: 9, momentum: 10, startReach: .32, endReach: 1.16, colliderRadius: .16, targetRadius: .36, region: 'head', kind: 'light' },
  left_hook: { id: 'left_hook', anticipation: .18, active: .2, recovery: .27, stamina: 9, damage: 9, momentum: 10, startReach: .32, endReach: 1.16, colliderRadius: .16, targetRadius: .36, region: 'head', kind: 'light' },
  high_punch: { id: 'high_punch', anticipation: .14, active: .24, recovery: .22, stamina: 7, damage: 7, momentum: 9, startReach: .36, endReach: 1.3, colliderRadius: .13, targetRadius: .35, region: 'head', kind: 'light' },
  headbutt: { id: 'headbutt', ...NETWORK_MOVE_TIMING.headbutt, stamina: 9, damage: 9, momentum: 11, startReach: .22, endReach: .64, colliderRadius: .235, targetRadius: .235, region: 'head', kind: 'light' },
  uppercut: { id: 'uppercut', anticipation: .3, active: .24, recovery: .34, stamina: 15, damage: 15, momentum: 15, startReach: .25, endReach: 1.22, colliderRadius: .18, targetRadius: .35, region: 'head', kind: 'heavy' },
  heavy: { id: 'heavy', anticipation: .26, active: .16, recovery: .38, stamina: 17, damage: 13, momentum: 13, startReach: .28, endReach: 1.45, colliderRadius: .18, targetRadius: .34, region: 'head', kind: 'heavy' },
  low_kick: { id: 'low_kick', ...NETWORK_MOVE_TIMING.low_kick, stamina: 8, damage: 8, momentum: 9, startReach: .3, endReach: 1.08, colliderRadius: .14, targetRadius: .18, region: 'legs', kind: 'heavy' },
  front_kick: { id: 'front_kick', anticipation: .22, active: .3, recovery: .36, stamina: 14, damage: 14, momentum: 14, startReach: .35, endReach: 1.65, colliderRadius: .18, targetRadius: .26, region: 'chest', kind: 'heavy' },
  roundhouse: { id: 'roundhouse', anticipation: .3, active: .2, recovery: .48, stamina: 19, damage: 18, momentum: 18, startReach: .4, endReach: 1.82, colliderRadius: .2, targetRadius: .3, region: 'head', kind: 'heavy' },
  high_kick: { id: 'high_kick', anticipation: .26, active: .32, recovery: .42, stamina: 16, damage: 16, momentum: 16, startReach: .36, endReach: 1.62, colliderRadius: .18, targetRadius: .32, region: 'head', kind: 'heavy' },
  suplex: { id: 'suplex', anticipation: 1.12, active: .22, recovery: .78, stamina: 22, damage: 18, momentum: 19, startReach: .22, endReach: .56, colliderRadius: .3, targetRadius: .36, region: 'chest', kind: 'grapple' },
  piledriver: { id: 'piledriver', anticipation: 1.52, active: .26, recovery: .82, stamina: 26, damage: 28, momentum: 26, startReach: .2, endReach: .5, colliderRadius: .32, targetRadius: .36, region: 'chest', kind: 'grapple' },
  side_toss: { id: 'side_toss', anticipation: .86, active: .19, recovery: .58, stamina: 16, damage: 14, momentum: 16, startReach: .2, endReach: .62, colliderRadius: .28, targetRadius: .36, region: 'chest', kind: 'grapple' },
  grapple_miss: { id: 'grapple_miss', ...NETWORK_MOVE_TIMING.grapple_miss, stamina: 6, damage: 0, momentum: 0, startReach: .3, endReach: .82, colliderRadius: .18, targetRadius: .36, region: 'chest', kind: 'grapple' },
  slam: { id: 'slam', ...NETWORK_MOVE_TIMING.slam, stamina: 15, damage: 18, momentum: 20, startReach: .2, endReach: .52, colliderRadius: .32, targetRadius: .36, region: 'chest', kind: 'grapple' },
};

const fighter = (sessionId: string, fighterId: FighterId, x: number, facing: number): OnlineFighterState => ({
  sessionId, fighterId, health: 100, stamina: 100, momentum: 0, posX: x, posZ: 0, facing,
  velocityX: 0, velocityZ: 0, combatState: 'idle', moveId: '', attackPhase: null,
  pinCount: 0, finisherPrimed: false, lastCommandSeq: 0, moveX: 0, moveZ: 0, movementLeaseUntil: 0,
  running: false, guarding: false, phaseElapsed: 0, quickChainCount: 0, lastQuickStrikeAt: -Infinity, attackInstanceId: 0,
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
// OPTIMIZATION: Replacing slow Math.hypot with standard Math.sqrt. Math.hypot scales inputs dynamically to avoid overflow/underflow,
// which is a CPU intensive operation. Since our simulation coordinate space is small and bound, Math.sqrt is completely safe and runs ~8x faster.
const length = (x: number, z: number): number => Math.sqrt(x * x + z * z);

/** Apply bounded acceleration so network input changes intent, not body velocity. */
const approach = (current: number, target: number, maximumDelta: number): number =>
  current < target ? Math.min(current + maximumDelta, target) : Math.max(current - maximumDelta, target);

const separateFighters = (match: OnlineMatchState, minimumDistance = .62): void => {
  const [first, second] = match.fighters.values();
  if (!first || !second || first.grappleTarget === second.sessionId || second.grappleTarget === first.sessionId) return;
  const dx = second.posX - first.posX; const dz = second.posZ - first.posZ;
  const distanceSquared = dx * dx + dz * dz;
  if (distanceSquared >= minimumDistance * minimumDistance) return;
  const distance = Math.sqrt(distanceSquared);
  const nx = distance > .001 ? dx / distance : 1;
  const nz = distance > .001 ? dz / distance : 0;
  const correction = (minimumDistance - distance) * .5;
  first.posX = clamp(first.posX - nx * correction, -5.55, 5.55);
  first.posZ = clamp(first.posZ - nz * correction, -4.05, 4.05);
  second.posX = clamp(second.posX + nx * correction, -5.55, 5.55);
  second.posZ = clamp(second.posZ + nz * correction, -4.05, 4.05);
  const closingSpeed = (second.velocityX - first.velocityX) * nx + (second.velocityZ - first.velocityZ) * nz;
  if (closingSpeed < 0) {
    first.velocityX += nx * closingSpeed * .5;
    first.velocityZ += nz * closingSpeed * .5;
    second.velocityX -= nx * closingSpeed * .5;
    second.velocityZ -= nz * closingSpeed * .5;
  }
};

const beginMove = (actor: OnlineFighterState, moveId: keyof typeof MOVES, linkRecovery = false): boolean => {
  const move = MOVES[moveId];
  const canLink = linkRecovery && actor.combatState === 'attacking' && actor.attackPhase === 'recovery';
  if (!move || actor.stamina < move.stamina || (!canLink && !['idle', 'locomotion', 'blocking', 'grappling'].includes(actor.combatState))) return false;
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
  if (event.action === 'quickStrike') {
    const inChain = match.elapsed - actor.lastQuickStrikeAt <= .85;
    const comboMoves = ['jab', 'right_hook', 'left_hook', 'uppercut'] as const;
    const chainIndex = inChain ? actor.quickChainCount % comboMoves.length : 0;
    const moveId = z > .65 ? 'headbutt' : z < -.65 ? 'uppercut' : x > .65 ? 'right_hook' : x < -.65 ? 'left_hook' : comboMoves[chainIndex] ?? 'jab';
    const linked = actor.combatState === 'attacking' && actor.attackPhase === 'recovery';
    if (!beginMove(actor, moveId, linked)) return false;
    actor.lastQuickStrikeAt = match.elapsed;
    actor.quickChainCount = z > .65 || z < -.65 || Math.abs(x) > .65 ? 0 : chainIndex + 1;
    return true;
  }
  if (event.action === 'heavyStrike') {
    const moveId = actor.grappleTarget
      ? z < -.65 ? 'piledriver' : x > .65 || x < -.65 ? 'side_toss' : 'slam'
      : z < -.65 ? 'uppercut' : z > .65 ? 'front_kick' : x > .65 || x < -.65 ? 'roundhouse' : 'low_kick';
    return beginMove(actor, moveId);
  }
  if (event.action === 'grapple') {
    const moveId = actor.grappleTarget ? (x > .65 || x < -.65 ? 'suplex' : 'slam') : 'grapple_miss';
    return beginMove(actor, moveId);
  }
  return false;
};

const phaseDuration = (move: OnlineMove, phase: AttackPhase): number => phase === 'anticipation' ? move.anticipation : phase === 'active' ? move.active : move.recovery;

// OPTIMIZATION: Utilizing flat squared-magnitude comparisons (diffX * diffX + diffZ * diffZ <= radius * radius)
// completely bypasses the costly square root operations from both Math.hypot and standard Math.sqrt inside the hot contact simulation paths.
const segmentCircleHit = (
  startX: number, startZ: number, endX: number, endZ: number,
  centerX: number, centerZ: number, radius: number,
): boolean => {
  const dx = endX - startX; const dz = endZ - startZ; const denominator = dx * dx + dz * dz;
  const t = denominator <= 1e-8 ? 0 : clamp(((centerX - startX) * dx + (centerZ - startZ) * dz) / denominator, 0, 1);
  // OPTIMIZATION: Using squared distance check to avoid any Math.sqrt or length calculation entirely.
  const px = centerX - (startX + dx * t);
  const pz = centerZ - (startZ + dz * t);
  return (px * px + pz * pz) <= radius * radius;
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
  if (move.kind === 'grapple') {
    actor.grappleTarget = null; target.grappleTarget = null; target.combatState = 'downed'; target.downTimer = 1.8;
  } else if (!guarded) {
    target.combatState = move.kind === 'heavy' && target.health < 55 ? 'downed' : 'staggered';
    target.downTimer = target.combatState === 'downed' ? 1.8 : .32;
    target.moveId = ''; target.attackPhase = null; target.phaseElapsed = 0;
  }
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
    if (target) {
      // OPTIMIZATION: Use squared distance check to avoid Math.sqrt during target proximity evaluation on a hot execution path.
      const dx = target.posX - actor.posX;
      const dz = target.posZ - actor.posZ;
      if (dx * dx + dz * dz < 20.25) actor.facing = Math.atan2(dx, dz);
    }
    if (!actor.moveId && !actor.grappleTarget) {
      const speed = actor.guarding ? 1.1 : actor.running ? 3.15 : 1.85;
      const inputMagnitude = Math.sqrt(actor.moveX * actor.moveX + actor.moveZ * actor.moveZ);
      const targetVelocityX = inputMagnitude > .05 ? actor.moveX * speed : 0;
      const targetVelocityZ = inputMagnitude > .05 ? actor.moveZ * speed : 0;
      const acceleration = (inputMagnitude > .05 ? (actor.running ? 10.5 : 8.5) : 14) * step;
      actor.velocityX = approach(actor.velocityX, targetVelocityX, acceleration);
      actor.velocityZ = approach(actor.velocityZ, targetVelocityZ, acceleration);
      actor.posX = clamp(actor.posX + actor.velocityX * step, -5.55, 5.55); actor.posZ = clamp(actor.posZ + actor.velocityZ * step, -4.05, 4.05);
      const moving = actor.velocityX * actor.velocityX + actor.velocityZ * actor.velocityZ > .0025;
      actor.combatState = actor.guarding ? 'blocking' : moving ? 'locomotion' : 'idle';
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
  separateFighters(match);
  return impacts;
};
