import type { ActionEvent, FighterId, GameCommand, Ruleset, Vec2 } from '@frwf/game-protocol';
import { applyOnlineAction, createOnlineMatch, stepOnlineMatch } from '../onlineSimulation.js';
import type { FighterRuntime, FrameInput, MatchModel } from './types.js';

export const createMatch = (
  p1: FighterId,
  p2: FighterId,
  ruleset: Ruleset = 'standard',
): MatchModel => createOnlineMatch([
  { sessionId: 'p1', fighterId: p1 },
  { sessionId: 'p2', fighterId: p2 },
], ruleset);

export const createFighterRuntime = (
  definitionId: FighterId,
  position: Vec2,
): FighterRuntime => ({
  sessionId: 'p1',
  fighterId: definitionId,
  health: 100,
  stamina: 100,
  momentum: 0,
  posX: position.x,
  posZ: position.z,
  facing: 0,
  velocityX: 0,
  velocityZ: 0,
  combatState: 'idle',
  moveId: '',
  attackPhase: null,
  pinCount: 0,
  finisherPrimed: false,
  lastCommandSeq: 0,
  moveX: 0,
  moveZ: 0,
  movementLeaseUntil: 0,
  running: false,
  guarding: false,
  phaseElapsed: 0,
  attackInstanceId: 0,
  hitTargets: new Set(),
  grappleTarget: null,
  downTimer: 0,
});

export const advanceMatch = (
  match: MatchModel,
  dt: number,
  _input?: FrameInput,
): MatchModel => {
  stepOnlineMatch(match, dt);
  return match;
};

export const requestCommand = (
  match: MatchModel,
  actorSessionId: string,
  command: GameCommand,
  direction: Vec2 = { x: 0, z: 0 },
): boolean => {
  const event: ActionEvent = {
    action: command === 'quick' ? 'quickStrike' : command === 'heavy' ? 'heavyStrike' : 'move',
    phase: 'started',
    sequence: (match.fighters.get(actorSessionId)?.lastCommandSeq ?? 0) + 1,
    timestamp: match.elapsed * 1000,
    direction: { x: direction.x, y: direction.z },
    source: 'ai',
  };
  return applyOnlineAction(match, actorSessionId, event, event.sequence);
};
