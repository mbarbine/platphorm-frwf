import { describe, expect, it } from 'vitest';
import { PhysicsReplayBuffer, sampleReplayFrame } from '../game/physics/replayBuffer';

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


describe('recorded pose playback', () => {
  it('interpolates positions by timestamp and takes the shortest quaternion path without mutating recordings', () => {
    const a = { position: { x: 0, y: 2, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
    const b = { position: { x: 4, y: 4, z: 2 }, rotation: { x: 0, y: 0, z: 0, w: -1 } };
    const frames = [{ time: 1, fighters: { player: { pelvis: a } }, props: { chair: a } }, { time: 3, fighters: { player: { pelvis: b } }, props: { chair: b } }];
    const sample = sampleReplayFrame(frames, 2);
    expect(sample?.fighters.player?.pelvis?.position).toEqual({ x: 2, y: 3, z: 1 });
    expect(sample?.fighters.player?.pelvis?.rotation).toEqual(a.rotation);
    expect(sample?.props.chair?.position.x).toBe(2);
    expect(a.position.x).toBe(0); expect(b.rotation.w).toBe(-1);
    expect(sampleReplayFrame(frames, -1)).toBe(frames[0]);
    expect(sampleReplayFrame(frames, 10)).toBe(frames[1]);
    expect(sampleReplayFrame([], 2)).toBeNull();
  });
});
