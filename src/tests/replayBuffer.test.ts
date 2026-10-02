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

  it('samples replay frames efficiently over many iterations', () => {
    const a = { position: { x: 0, y: 2, z: 0 }, rotation: { x: 0.1, y: 0.2, z: 0.3, w: 0.9 } };
    const b = { position: { x: 4, y: 4, z: 2 }, rotation: { x: 0.2, y: 0.3, z: 0.4, w: 0.8 } };
    const segments = {
      pelvis: a, abdomen: a, chest: a, head: a,
      leftUpperArm: a, rightUpperArm: a, leftForearm: a, rightForearm: a,
      leftHand: a, rightHand: a, leftThigh: a, rightThigh: a,
      leftShin: a, rightShin: a, leftFoot: a, rightFoot: a,
    };
    const segmentsB = {
      pelvis: b, abdomen: b, chest: b, head: b,
      leftUpperArm: b, rightUpperArm: b, leftForearm: b, rightForearm: b,
      leftHand: b, rightHand: b, leftThigh: b, rightThigh: b,
      leftShin: b, rightShin: b, leftFoot: b, rightFoot: b,
    };
    const frames = [
      { time: 1, fighters: { player: segments, opponent: segments }, props: { chair: a, table: a } },
      { time: 3, fighters: { player: segmentsB, opponent: segmentsB }, props: { chair: b, table: b } },
    ];

    const iterations = 50_000;
    const startTime = performance.now();
    for (let i = 0; i < iterations; i++) {
      sampleReplayFrame(frames, 1 + (i % 200) / 100);
    }
    const elapsed = performance.now() - startTime;
    expect(elapsed).toBeLessThan(1_000); // Should run 50,000 samples well under 1 second
  });
});
