import { FIGHTERS } from '../data/fighters';
import { advanceMatch, createMatch } from '../systems/combat';
import type { FrameInput } from '../systems/combat';
import type { FighterId, FighterSlot, GameCommand, MatchMode, MatchModel, Vec2 } from '../types/game';
import { createActionEvent, gameCommandToAction } from '../input/actionLayer';

export interface AiSoakMatch {
  seed: number;
  player: FighterId;
  opponent: FighterId;
  completed: boolean;
  winner: FighterSlot | null;
  method: 'PINFALL' | 'KNOCKOUT' | null;
  matchMode: MatchMode;
  eliminations: number;
  remaining: readonly FighterSlot[];
  finalStates: Readonly<Record<FighterSlot, string>>;
  finalHealth: Readonly<Record<FighterSlot, number>>;
  finalTargets: Readonly<Record<FighterSlot, FighterSlot>>;
  finalPositions: Readonly<Record<FighterSlot, Vec2>>;
  simulatedSeconds: number;
  steps: number;
  wallMs: number;
}

export interface AiSoakReport {
  requested: number;
  completed: number;
  timedOut: number;
  pinfalls: number;
  knockouts: number;
  averageSimulatedSeconds: number;
  averageStepMs: number;
  p95MatchWallMs: number;
  maximumReplayFrames: number;
  maximumProps: number;
  matches: readonly AiSoakMatch[];
}

const toward = (from: Vec2, to: Vec2): Vec2 => {
  const x = to.x - from.x; const z = to.z - from.z; const magnitude = Math.max(.001, Math.hypot(x, z));
  return { x: x / magnitude, z: z / magnitude };
};

const playerBotInput = (model: MatchModel, step: number): FrameInput => {
  const actor = model.player; const target = model[model.targets.player]; const direction = toward(actor.position, target.position);
  const separation = Math.hypot(target.position.x - actor.position.x, target.position.z - actor.position.z);
  const cadence = step % 11 === 0; let command: GameCommand | null = null;
  if (actor.state === 'pinned' || actor.state === 'downed') command = cadence ? 'dodge' : null;
  else if (actor.state === 'climbing') command = cadence ? 'context' : null;
  else if (actor.state === 'grappling' && actor.attackPhase === 'anticipation') command = actor.phaseElapsed < .18 && cadence ? (step % 3 === 0 ? 'grapple' : 'heavy') : null;
  else if (actor.momentum >= 100 && ['staggered', 'downed'].includes(target.state) && separation < 2.1) command = cadence ? 'context' : null;
  else if (target.state === 'downed' && separation < 1.65) command = cadence ? (model.elapsed > 12 ? 'context' : 'quick') : null;
  else if (separation < 1.72 && cadence) command = step % 44 === 0 ? 'grapple' : step % 33 === 0 ? 'heavy' : 'quick';
  const canAdvance = ['idle', 'locomotion'].includes(actor.state) && separation > 1.28;
  return { move: canAdvance ? direction : { x: 0, z: 0 }, run: canAdvance && separation > 3.4, block: false, actions: command ? [createActionEvent(gameCommandToAction(command), { source: 'ai', timestamp: model.elapsed * 1_000, direction })] : [] };
};

export const runAiSoak = (count = 50, seedBase = 41_000, maximumMatchSeconds = 240, matchMode: MatchMode = 'singles'): AiSoakReport => {
  const matches: AiSoakMatch[] = []; let maximumReplayFrames = 0; let maximumProps = 0; let totalSteps = 0; let totalWallMs = 0;
  const ids = FIGHTERS.map((fighter) => fighter.id);
  for (let index = 0; index < count; index += 1) {
    const seed = seedBase + index * 97; const player = ids[index % ids.length] ?? 'atlas'; const opponent = ids[(index * 3 + 1) % ids.length] ?? 'nova';
    const model = createMatch(player, opponent, index % 3 === 0 ? 'chaos' : 'standard', index % 2 === 0 ? 'normal' : 'hard', seed, index % 3, (index + 1) % 3, matchMode);
    const started = performance.now(); let steps = 0; const maximumSteps = maximumMatchSeconds * 30;
    while (!model.resolved && steps < maximumSteps) {
      advanceMatch(model, 1 / 30, playerBotInput(model, steps)); steps += 1;
      maximumReplayFrames = Math.max(maximumReplayFrames, model.replayFrames.length); maximumProps = Math.max(maximumProps, model.props.length);
    }
    const wallMs = performance.now() - started; totalSteps += steps; totalWallMs += wallMs;
    matches.push({
      seed, player, opponent: model.opponent.definitionId, completed: model.resolved, winner: model.result?.winner ?? null, method: model.result?.method ?? null, matchMode, eliminations: model.eliminations.length,
      remaining: (['player', 'opponent', 'rival1', 'rival2', 'rival3'] as const).filter((slot) => model[slot].state !== 'defeated'),
      finalStates: Object.fromEntries((['player', 'opponent', 'rival1', 'rival2', 'rival3'] as const).map((slot) => [slot, model[slot].state])) as Record<FighterSlot, string>,
      finalHealth: Object.fromEntries((['player', 'opponent', 'rival1', 'rival2', 'rival3'] as const).map((slot) => [slot, model[slot].health])) as Record<FighterSlot, number>,
      finalTargets: { ...model.targets },
      finalPositions: Object.fromEntries((['player', 'opponent', 'rival1', 'rival2', 'rival3'] as const).map((slot) => [slot, { ...model[slot].position }])) as Record<FighterSlot, Vec2>,
      simulatedSeconds: model.elapsed, steps, wallMs,
    });
  }
  const completed = matches.filter((match) => match.completed); const wallSamples = matches.map((match) => match.wallMs).sort((a, b) => a - b);
  return {
    requested: count,
    completed: completed.length,
    timedOut: count - completed.length,
    pinfalls: completed.filter((match) => match.method === 'PINFALL').length,
    knockouts: completed.filter((match) => match.method === 'KNOCKOUT').length,
    averageSimulatedSeconds: matches.reduce((total, match) => total + match.simulatedSeconds, 0) / Math.max(1, matches.length),
    averageStepMs: totalWallMs / Math.max(1, totalSteps),
    p95MatchWallMs: wallSamples[Math.max(0, Math.ceil(wallSamples.length * .95) - 1)] ?? 0,
    maximumReplayFrames,
    maximumProps,
    matches,
  };
};
