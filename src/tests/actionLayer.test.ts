import { describe, expect, it } from 'vitest';
import { ActionBuffer } from '../game/input/actionBuffer';
import {
  HeldActionTracker,
  KEYBOARD_ACTIONS,
  actionDirectionToVec2,
  actionToGameCommand,
  createActionEvent,
} from '../game/input/actionLayer';
import type { ActionEvent, GameAction } from '../game/input/actionLayer';

const event = (action: GameAction, sequence: number, timestamp = 100): ActionEvent => createActionEvent(action, {
  source: 'keyboard',
  sequence,
  timestamp,
  direction: { x: .25, z: -.75 },
});

describe('semantic game actions', () => {
  it('owns the rescue keyboard grammar in one mapping', () => {
    expect(KEYBOARD_ACTIONS).toMatchObject({
      KeyJ: 'quickStrike', KeyK: 'heavyStrike', KeyL: 'grapple', KeyI: 'guard', Space: 'dodgeCounter', KeyC: 'jump', KeyE: 'propAction', KeyF: 'contextAction', KeyQ: 'taunt', Escape: 'pause',
    });
    expect(actionToGameCommand('quickStrike')).toBe('quick');
    expect(actionToGameCommand('move')).toBeNull();
  });

  it('preserves the requested x/y event contract at the Vec2 boundary', () => {
    const action = event('heavyStrike', 7);
    expect(action).toMatchObject({ phase: 'started', source: 'keyboard', sequence: 7, direction: { x: .25, y: -.75 } });
    expect(actionDirectionToVec2(action.direction)).toEqual({ x: .25, z: -.75 });
  });

  it('emits started, held, and released phases for continuous actions', () => {
    const tracker = new HeldActionTracker();
    expect(tracker.update('guard', true, 'gamepad', { x: 0, z: 0 }, 10)?.phase).toBe('started');
    expect(tracker.update('guard', true, 'gamepad', { x: 0, z: 0 }, 20)?.phase).toBe('held');
    expect(tracker.update('guard', false, 'gamepad', { x: 0, z: 0 }, 30)?.phase).toBe('released');
    expect(tracker.update('guard', false, 'gamepad', { x: 0, z: 0 }, 40)).toBeNull();
  });
});

describe('authoritative action buffer', () => {
  it('executes deterministic sequence order once and measures wait', () => {
    const buffer = new ActionBuffer<string>({ capacity: 4, defaultTtlMs: 160 });
    buffer.push('second', event('heavyStrike', 2), 110);
    buffer.push('first', event('quickStrike', 1), 120);
    const executed: string[] = [];
    expect(buffer.resolveNext(130, () => true, (value) => { executed.push(value); return 'executed'; })).toBe('executed');
    expect(buffer.resolveNext(145, () => true, (value) => { executed.push(value); return 'executed'; })).toBe('executed');
    expect(executed).toEqual(['first', 'second']);
    expect(buffer.metrics).toMatchObject({ buffered: 2, executed: 2, expired: 0, rejected: 0, duplicate: 0, maximumWaitMs: 35 });
    expect(buffer.metrics.averageWaitMs).toBe(22.5);
    expect(buffer.size).toBe(0);
  });

  it('deduplicates same-source action edges inside the bounded window', () => {
    const buffer = new ActionBuffer<string>({ duplicateWindowMs: 48 });
    expect(buffer.push('first', event('grapple', 1), 100)).toBe(true);
    expect(buffer.push('duplicate', event('grapple', 2), 140)).toBe(false);
    expect(buffer.metrics).toMatchObject({ buffered: 1, duplicate: 1 });
    expect(buffer.size).toBe(1);
  });

  it('uses the shorter context window and reports expiry', () => {
    const buffer = new ActionBuffer<string>({ defaultTtlMs: 160, contextTtlMs: 110 });
    buffer.push('context', event('contextAction', 1), 100);
    const expired: string[] = [];
    expect(buffer.resolveNext(211, () => true, () => 'executed', (value) => expired.push(value))).toBeNull();
    expect(expired).toEqual(['context']);
    expect(buffer.metrics.expired).toBe(1);
  });

  it('bounds capacity and counts overflow as an honest rejection', () => {
    const buffer = new ActionBuffer<string>({ capacity: 2 });
    buffer.push('one', event('quickStrike', 1), 100);
    buffer.push('two', event('heavyStrike', 2), 110);
    buffer.push('three', event('grapple', 3), 120);
    expect(buffer.size).toBe(2);
    expect(buffer.metrics).toMatchObject({ buffered: 3, rejected: 1 });
  });
});
