import { describe, expect, it } from 'vitest';
import { MotionTaskRunner } from '../game/physics/motionTaskRunner';

describe('bounded physical motion tasks', () => {
  it('allows one task per fighter and transfers ownership without leaking grips', () => {
    const runner = new MotionTaskRunner();
    const first = runner.request({ actorId: 'player', targetId: 'opponent', moveId: 'jab', attackInstanceId: 1, maximumDuration: 1, phaseId: 'anticipation' });
    runner.ownGrip('player', 'grip-a'); expect(first.ownedGripIds).toEqual(['grip-a']);
    const second = runner.request({ actorId: 'player', targetId: 'opponent', moveId: 'slam', attackInstanceId: 2, maximumDuration: 2, phaseId: 'reach' });
    expect(first.status).toBe('cancelled'); expect(second.ownedGripIds).toEqual([]); expect(runner.size).toBe(1);
    runner.ownGrip('player', 'grip-b'); runner.releaseGrip('player', 'grip-b'); expect(second.ownedGripIds).toEqual([]);
  });

  it('fails a task at its finite timeout and clears the active slot', () => {
    const runner = new MotionTaskRunner(); runner.request({ actorId: 'opponent', targetId: 'player', moveId: 'slam', attackInstanceId: 8, maximumDuration: .5, phaseId: 'lift' });
    expect(runner.update(.49).timedOut).toHaveLength(0);
    const result = runner.update(.02); expect(result.timedOut).toHaveLength(1); expect(result.timedOut[0]!.status).toBe('failed'); expect(runner.active('opponent')).toBeNull();
  });
});
