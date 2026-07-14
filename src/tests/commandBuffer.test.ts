import { describe, expect, it } from 'vitest';
import { BoundedCommandBuffer } from '../game/input/commandBuffer';

describe('bounded device command buffer', () => {
  it('preserves fresh press order and drains only once', () => {
    const buffer = new BoundedCommandBuffer(4, 200);
    buffer.push('quick', 100); buffer.push('heavy', 110); buffer.push('grapple', 120);
    expect(buffer.drain(125)).toEqual(['quick', 'heavy', 'grapple']);
    expect(buffer.drain(126)).toEqual([]);
  });

  it('drops the oldest presses at its hard capacity', () => {
    const buffer = new BoundedCommandBuffer(3, 200);
    buffer.push('quick', 100); buffer.push('heavy', 101); buffer.push('grapple', 102); buffer.push('dodge', 103);
    expect(buffer.size).toBe(3);
    expect(buffer.drain(104)).toEqual(['heavy', 'grapple', 'dodge']);
  });

  it('expires stale input before it can fire after recovery', () => {
    const buffer = new BoundedCommandBuffer(4, 160);
    buffer.push('heavy', 100);
    expect(buffer.drain(261)).toEqual([]);
  });
});
