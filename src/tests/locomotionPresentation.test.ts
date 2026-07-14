import { describe, expect, it } from 'vitest';
import { locomotionPresentation } from '../game/animation/locomotionPresentation';
import { createFighterRuntime } from '../game/systems/combat';

const moving = (velocity: { x: number; z: number }, state: 'idle' | 'locomotion' = 'locomotion') => {
  const fighter = createFighterRuntime('atlas', { x: 0, z: 0 });
  fighter.facing = 0; fighter.velocity = velocity; fighter.state = state;
  return fighter;
};

describe('directional locomotion presentation', () => {
  it('distinguishes forward, backpedal, and lateral footwork in the fighter basis', () => {
    expect(locomotionPresentation(moving({ x: 0, z: 3 })).state).toBe('forward');
    expect(locomotionPresentation(moving({ x: 0, z: -3 })).state).toBe('backward');
    expect(locomotionPresentation(moving({ x: -3, z: 0 })).state).toBe('strafe-left');
    expect(locomotionPresentation(moving({ x: 3, z: 0 })).state).toBe('strafe-right');
  });

  it('recognizes diagonal, run, braking, and settled idle states', () => {
    expect(locomotionPresentation(moving({ x: 2.5, z: 3 })).state).toBe('diagonal');
    expect(locomotionPresentation(moving({ x: 0, z: 5.2 })).state).toBe('run');
    expect(locomotionPresentation(moving({ x: 0, z: 2.2 }, 'idle')).state).toBe('braking');
    expect(locomotionPresentation(moving({ x: .02, z: .03 }, 'idle')).state).toBe('idle');
  });
});
