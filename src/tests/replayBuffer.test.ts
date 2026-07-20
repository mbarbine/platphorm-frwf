import { describe, expect, it } from 'vitest';
import { PhysicsReplayBuffer } from '../game/physics/replayBuffer';

const frame = (time: number) => ({ time, fighters: { player: {}, opponent: {} }, props: {} });

describe('physics replay buffer', () => {
  it('remains bounded and returns wrapped frames chronologically', () => {
    const buffer = new PhysicsReplayBuffer(3);
    buffer.push(frame(1)); buffer.push(frame(2)); buffer.push(frame(3)); buffer.push(frame(4));
    expect(buffer.size).toBe(3);
    expect(buffer.chronological().map((sample) => sample.time)).toEqual([2, 3, 4]);
  });

  it('clears every recorded transform for a rematch', () => {
    const buffer = new PhysicsReplayBuffer(4); buffer.push(frame(1)); buffer.push(frame(2));
    buffer.clear();
    expect(buffer.size).toBe(0); expect(buffer.chronological()).toEqual([]);
  });
});
