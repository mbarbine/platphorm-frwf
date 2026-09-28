import { describe, expect, it } from 'vitest';
import { advanceMatch, createFighterRuntime, createMatch, requestCommand } from '../index.js';

describe('combat simulation API exports', () => {
  it('creates a match with fighters and initial state', () => {
    const match = createMatch('atlas', 'nova');
    expect(match).toBeDefined();
    expect(match.fighters.size).toBe(2);
    expect(match.resolved).toBe(false);
  });

  it('creates a fighter runtime instance with default properties and positions', () => {
    const runtime = createFighterRuntime('atlas', { x: -1.5, z: 2.5 });
    expect(runtime).toEqual({
      sessionId: 'p1',
      fighterId: 'atlas',
      health: 100,
      stamina: 100,
      momentum: 0,
      posX: -1.5,
      posZ: 2.5,
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
      hitTargets: expect.any(Set),
      grappleTarget: null,
      downTimer: 0,
    });
    expect(runtime.hitTargets.size).toBe(0);
  });

  it('advances a match simulation frame', () => {
    const match = createMatch('atlas', 'nova');
    const initialElapsed = match.elapsed;
    advanceMatch(match, 1 / 30, { move: { x: 0, z: 0 }, run: false, block: false });
    expect(match.elapsed).toBeGreaterThan(initialElapsed);
  });

  it('accepts valid commands for fighters', () => {
    const match = createMatch('atlas', 'nova');
    const accepted = requestCommand(match, 'p1', 'quick', { x: 0, z: 0 });
    expect(accepted).toBe(true);
  });
});
